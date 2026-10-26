<#
.SYNOPSIS
    AMS Accurate 5 Desktop & PC Telemetry Background Agent
.DESCRIPTION
    Script background PowerShell untuk memantau status PC, service Accurate/Firebird,
    serta inventarisasi file database .gdb secara otomatis dan mengirimkan sinyal telemetry ke backend AMS.
.EXAMPLE
    powershell.exe -ExecutionPolicy Bypass -File .\accurate_agent.ps1 -Once
#>

[CmdletBinding()]
param (
    [switch]$Once,
    [string]$ConfigPath
)

if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    $ConfigPath = Join-Path -Path $PSScriptRoot -ChildPath "config.json"
}

$mutexName = "Local\AMS_Accurate_Telemetry_Agent"
$createdMutex = $false
if (-not $Once) {
    $script:AgentMutex = [System.Threading.Mutex]::new($true, $mutexName, [ref]$createdMutex)
    if (-not $createdMutex) {
        Write-Host "[WARN] Agent sudah berjalan di sesi user ini. Proses baru dihentikan."
        exit 0
    }
}

# -----------------------------------------------------------------------------
# Configuration Loader & Logger
# -----------------------------------------------------------------------------
function Load-Config {
    param ([string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Config agent tidak ditemukan: $Path. Salin accurate_agent.config.example.json menjadi config.json."
    }

    try {
        $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
        $config = $raw | ConvertFrom-Json -ErrorAction Stop
    } catch {
        throw "Gagal membaca config agent '$Path': $($_.Exception.Message)"
    }

    $requiredText = @("apiUrl", "apiKey")
    foreach ($field in $requiredText) {
        if ([string]::IsNullOrWhiteSpace([string]$config.$field)) {
            throw "Konfigurasi '$field' wajib diisi pada $Path"
        }
    }
    if (-not $config.scanPaths -or @($config.scanPaths).Count -eq 0) {
        throw "Konfigurasi 'scanPaths' wajib berisi minimal satu folder."
    }
    if ([int]$config.intervalSeconds -lt 10) {
        throw "Konfigurasi 'intervalSeconds' minimal 10 detik."
    }
    if ([int]$config.licenseServerPort -lt 1 -or [int]$config.licenseServerPort -gt 65535) {
        throw "Konfigurasi 'licenseServerPort' tidak valid."
    }

    return $config
}

function Write-Log {
    param (
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] [$Level] $Message"
    Write-Host $logLine

    if ($script:Config.logToFile) {
        try {
            $logFile = $script:Config.logFilePath
            if ([System.IO.Path]::IsPathRooted($logFile) -eq $false) {
                $logFile = Join-Path $PSScriptRoot $logFile
            }
            Add-Content -Path $logFile -Value $logLine -ErrorAction SilentlyContinue
        } catch {}
    }
}

# -----------------------------------------------------------------------------
# 1. Telemetry PC (System Info, Uptime, Network)
# -----------------------------------------------------------------------------
function Get-PcTelemetry {
    $hostname = $env:COMPUTERNAME
    $lastSignal = (Get-Date).ToString("o")
    $os = (Get-WmiObject -Class Win32_OperatingSystem -ErrorAction SilentlyContinue)
    $osName = if ($os) { $os.Caption } else { [System.Environment]::OSVersion.VersionString }

    # Calculate Uptime
    $uptimeSeconds = 0
    $uptimeFormatted = ""
    $bootTimeStr = ""
    if ($os -and $os.LastBootUpTime) {
        try {
            $bootTime = [System.Management.ManagementDateTimeConverter]::ToDateTime($os.LastBootUpTime)
            $bootTimeStr = $bootTime.ToString("yyyy-MM-dd HH:mm:ss")
            $uptimeSeconds = [math]::Round((Get-Date - $bootTime).TotalSeconds)
            $uptimeSpan = New-TimeSpan -Start $bootTime -End (Get-Date)
            $uptimeFormatted = "{0}d {1}h {2}m" -f $uptimeSpan.Days, $uptimeSpan.Hours, $uptimeSpan.Minutes
        } catch {}
    }

    if ($uptimeSeconds -le 0) {
        $tickCount64Property = [Environment].GetProperty("TickCount64")
        if ($tickCount64Property) {
            $tickMs = [Environment]::TickCount64
        } else {
            $tickMs = [int64][Environment]::TickCount
            if ($tickMs -lt 0) {
                $tickMs += 4294967296
            }
        }

        $uptimeSpan = [TimeSpan]::FromMilliseconds($tickMs)
        $bootTime = (Get-Date).Subtract($uptimeSpan)
        $bootTimeStr = $bootTime.ToString("yyyy-MM-dd HH:mm:ss")
        $uptimeSeconds = [math]::Round($uptimeSpan.TotalSeconds)
        $uptimeFormatted = "{0}d {1}h {2}m" -f $uptimeSpan.Days, $uptimeSpan.Hours, $uptimeSpan.Minutes
    }

    # Get Primary IP & MAC Address
    $ipAddress = "127.0.0.1"
    $macAddress = ""
    try {
        $net = Get-WmiObject -Class Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue | 
               Where-Object {
                   $_.IPEnabled -eq $true -and
                   $_.IPAddress -ne $null -and
                   ($_.IPAddress | Where-Object { $_ -match '^\d{1,3}(\.\d{1,3}){3}$' -and $_ -ne "127.0.0.1" -and $_ -notlike "169.254.*" })
               } |
               Select-Object -First 1
        if ($net) {
            $wmiIp = ($net.IPAddress | Where-Object { $_ -match '^\d{1,3}(\.\d{1,3}){3}$' -and $_ -ne "127.0.0.1" -and $_ -notlike "169.254.*" } | Select-Object -First 1)
            if ($wmiIp) {
                $ipAddress = $wmiIp
            }
            if ($net.MACAddress) {
                $macAddress = $net.MACAddress
            }
        }
    } catch {}

    if ($ipAddress -eq "127.0.0.1" -or [string]::IsNullOrWhiteSpace($macAddress)) {
        try {
            $adapterBlocks = @()
            $currentBlock = New-Object System.Collections.Generic.List[string]
            $ipConfigLines = ipconfig.exe /all 2>$null

            foreach ($line in $ipConfigLines) {
                if ($line -match '^\S.*adapter .+:\s*$') {
                    if ($currentBlock.Count -gt 0) {
                        $adapterBlocks += ($currentBlock -join "`n")
                        $currentBlock.Clear()
                    }
                }

                if ($currentBlock.Count -gt 0 -or $line -match '^\S.*adapter .+:\s*$') {
                    $currentBlock.Add($line)
                }
            }

            if ($currentBlock.Count -gt 0) {
                $adapterBlocks += ($currentBlock -join "`n")
            }

            $selectedBlock = $null

            foreach ($adapterBlock in $adapterBlocks) {
                if (
                    $adapterBlock -match "Physical Address[^\:]*:\s*([0-9A-Fa-f-]{17})" -and
                    $adapterBlock -match "IPv4 Address[^\:]*:\s*(\d{1,3}(\.\d{1,3}){3})" -and
                    $adapterBlock -match "Default Gateway[^\:]*:\s*\d"
                ) {
                    $selectedBlock = $adapterBlock
                    break
                }
            }

            if (-not $selectedBlock) {
                $selectedBlock = $adapterBlocks |
                    Where-Object {
                        $_ -match "Physical Address[^\:]*:\s*([0-9A-Fa-f-]{17})" -and
                        $_ -match "IPv4 Address[^\:]*:\s*(\d{1,3}(\.\d{1,3}){3})"
                    } |
                    Select-Object -First 1
            }

            if ($selectedBlock) {
                if ($selectedBlock -match "IPv4 Address[^\:]*:\s*(\d{1,3}(\.\d{1,3}){3})") {
                    $ipAddress = $Matches[1]
                }
                if ($selectedBlock -match "Physical Address[^\:]*:\s*([0-9A-Fa-f-]{17})") {
                    $macAddress = $Matches[1]
                }
            }
        } catch {}
    }

    if ($ipAddress -eq "127.0.0.1") {
        try {
            $dnsIp = [System.Net.Dns]::GetHostAddresses($hostname) |
                Where-Object { $_.AddressFamily -eq "InterNetwork" -and $_.IPAddressToString -ne "127.0.0.1" -and $_.IPAddressToString -notlike "169.254.*" } |
                Select-Object -First 1
            if ($dnsIp) {
                $ipAddress = $dnsIp.IPAddressToString
            }
        } catch {}
    }

    if ([string]::IsNullOrWhiteSpace($macAddress)) {
        try {
            $macLine = getmac.exe /fo csv /nh 2>$null |
                Where-Object { $_ -match '([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}' } |
                Select-Object -First 1
            if ($macLine -match '([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}') {
                $macAddress = $Matches[0]
            }
        } catch {}
    }

    return [PSCustomObject]@{
        hostname      = $hostname
        ipAddress     = $ipAddress
        macAddress    = $macAddress
        os            = $osName
        uptimeSeconds = $uptimeSeconds
        uptime        = $uptimeFormatted
        bootTime      = $bootTimeStr
        status        = "Online"
        lastSignal    = $lastSignal
        timestamp     = $lastSignal
    }
}

# -----------------------------------------------------------------------------
# 2. Status Service & Process Accurate / Firebird
# -----------------------------------------------------------------------------
function Get-AccurateServices {
    $servicesResult = @()
    $processesResult = @()

    # Known Accurate/Firebird Service Names
    $targetServices = @(
        "FirebirdServerMAGENTA", 
        "FirebirdServer25", 
        "FirebirdGuardianMAGENTA", 
        "FirebirdGuardian25", 
        "AccurateLicenseServer",
        "FirebirdServerDefaultInstance"
    )

    # Check Windows Services
    try {
        $allServices = Get-Service -ErrorAction SilentlyContinue
        foreach ($svcName in $targetServices) {
            $found = $allServices | Where-Object { $_.Name -ieq $svcName -or $_.DisplayName -like "*Firebird*" -or $_.DisplayName -like "*Accurate*" }
            if ($found) {
                foreach ($s in $found) {
                    $servicesResult += [PSCustomObject]@{
                        serviceName = $s.Name
                        displayName = $s.DisplayName
                        status      = $s.Status.ToString()
                        isStarted   = ($s.Status -eq 'Running')
                    }
                }
            }
        }
    } catch {
        Write-Log "Error checking services: $_" "WARN"
    }

    # Remove duplicate services if any
    $servicesResult = $servicesResult | Select-Object -Unique serviceName, displayName, status, isStarted

    # Check Running Processes
    $targetProcesses = @("FBServer", "FBGuard", "Accurate", "Accurate5", "AccurateLicenseServer")
    try {
        $allProcesses = Get-Process -ErrorAction SilentlyContinue
        foreach ($procName in $targetProcesses) {
            $procs = $allProcesses | Where-Object { $_.ProcessName -ieq $procName }
            foreach ($p in $procs) {
                $processesResult += [PSCustomObject]@{
                    processName = $p.ProcessName
                    processId   = $p.Id
                    workingSetMb= [math]::Round($p.WorkingSet64 / 1MB, 2)
                    startTime   = try { $p.StartTime.ToString("yyyy-MM-dd HH:mm:ss") } catch { "" }
                }
            }
        }
    } catch {
        Write-Log "Error checking processes: $_" "WARN"
    }

    # Evaluate Overall Service Active Status
    $startedServices = @($servicesResult | Where-Object { $_.isStarted -eq $true })
    $firebirdServices = @($startedServices | Where-Object { $_.serviceName -match "Firebird|FBServer|FBGuard" -or $_.displayName -match "Firebird" })
    $firebirdProcesses = @($processesResult | Where-Object { $_.processName -match "^(FBServer|FBGuard)$" })
    $accurateServices = @($startedServices | Where-Object { $_.serviceName -match "Accurate|Acc5" -or $_.displayName -match "Accurate|Accurate 5" })
    $accurateProcesses = @($processesResult | Where-Object { $_.processName -match "^(Accurate|Accurate5|AccurateLicenseServer)$" })

    $isFirebirdRunning = ($firebirdServices.Count -gt 0) -or ($firebirdProcesses.Count -gt 0)
    $isAccurateRunning = ($accurateServices.Count -gt 0) -or ($accurateProcesses.Count -gt 0)

    return [PSCustomObject]@{
        isFirebirdActive = $isFirebirdRunning
        isAccurateActive = $isAccurateRunning
        overallStatus    = if ($isFirebirdRunning -or $isAccurateRunning) { "ACTIVE" } else { "INACTIVE" }
        services         = @($servicesResult)
        processes        = @($processesResult)
    }
}


# -----------------------------------------------------------------------------
# 3. Path, Name & Size Database .gdb Accurate
# -----------------------------------------------------------------------------
function Get-GdbDatabases {
    param (
        [string[]]$Paths,
        [int]$MaxDepth = 3
    )

    # Gunakan koleksi eksplisit agar hasil tetap berupa array, bahkan bila hanya
    # satu database ditemukan. Ini mencegah serialisasi JSON berubah menjadi object.
    $gdbFiles = [System.Collections.Generic.List[object]]::new()
    $visitedFiles = @{}
    $visitedDirectories = @{}
    $maxAllowedDepth = [Math]::Max(0, $MaxDepth)

    foreach ($targetPath in $Paths) {
        if ([string]::IsNullOrWhiteSpace($targetPath)) { continue }
        if (-not (Test-Path -LiteralPath $targetPath -PathType Container)) {
            Write-Log "Path scan tidak tersedia: $targetPath" "WARN"
            continue
        }

        $directories = [System.Collections.Generic.Queue[object]]::new()
        $directories.Enqueue([PSCustomObject]@{ Path = $targetPath; Depth = 0 })
        $foundInPath = 0

        while ($directories.Count -gt 0) {
            $current = $directories.Dequeue()
            try {
                $items = Get-ChildItem -LiteralPath $current.Path -Force -ErrorAction Stop
            } catch {
                Write-Log "Tidak dapat membaca folder '$($current.Path)': $($_.Exception.Message)" "WARN"
                continue
            }

            foreach ($item in $items) {
                if ($item.PSIsContainer) {
                    if ($current.Depth -lt $maxAllowedDepth -and -not $visitedDirectories.ContainsKey($item.FullName)) {
                        $visitedDirectories[$item.FullName] = $true
                        $directories.Enqueue([PSCustomObject]@{ Path = $item.FullName; Depth = $current.Depth + 1 })
                    }
                    continue
                }
                if ($item.Extension -ine '.gdb' -or $visitedFiles.ContainsKey($item.FullName)) { continue }

                $visitedFiles[$item.FullName] = $true
                $sizeBytes = $item.Length
                $sizeMb = [math]::Round($sizeBytes / 1MB, 2)
                $sizeGb = [math]::Round($sizeBytes / 1GB, 2)
                $formattedSize = if ($sizeGb -ge 1.0) { "$sizeGb GB" } else { "$sizeMb MB" }
                $gdbFiles.Add([PSCustomObject]@{
                    fileName          = $item.Name
                    filePath          = $item.FullName
                    fileSizeBytes     = $sizeBytes
                    fileSizeMb        = $sizeMb
                    fileSizeFormatted = $formattedSize
                    lastModified      = $item.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
                    createdAt         = $item.CreationTime.ToString("yyyy-MM-dd HH:mm:ss")
                })
                $foundInPath++
            }
        }
        Write-Log "Scan selesai: $targetPath - ditemukan $foundInPath file .gdb (kedalaman maks. $maxAllowedDepth)." "INFO"
    }

    return ,@($gdbFiles.ToArray())
}


# -----------------------------------------------------------------------------
# 4. Transmit Telemetry Signal to AMS Backend
# -----------------------------------------------------------------------------
function Send-TelemetrySignal {
    param (
        [PSCustomObject]$Payload
    )

    $jsonPayload = $Payload | ConvertTo-Json -Depth 6 -Compress
    $apiUrl = $script:Config.apiUrl
    $apiKey = $script:Config.apiKey

    Write-Log "Sending telemetry signal to $apiUrl..." "INFO"

    $headers = @{
        "Content-Type"  = "application/json"
        "X-Agent-Key"   = $apiKey
    }

    # Enable TLS 1.2
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    try {
        $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $jsonPayload -Headers $headers -TimeoutSec 15 -ErrorAction Stop
        Write-Log "Sinyal telemetry BERHASIL dikirim! Respons: $($response | ConvertTo-Json -Compress)" "INFO"
        return $true
    } catch {
        Write-Log "Gagal mengirim sinyal telemetry ke ${apiUrl}: $_" "ERROR"
        return $false
    }

}

# -----------------------------------------------------------------------------
# Main Execution Loop
# -----------------------------------------------------------------------------
try {
    $script:Config = Load-Config -Path $ConfigPath
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)"
    exit 1
}

Write-Log "=== AMS Accurate Background Telemetry Agent Dimulai ===" "INFO"
Write-Log "Server API: $($script:Config.apiUrl)" "INFO"
Write-Log "Interval : $($script:Config.intervalSeconds) detik" "INFO"

do {
    try {
        Write-Log "Mengumpulkan data telemetry PC, Service Accurate, & Database .gdb..." "INFO"
        
        $pcData = Get-PcTelemetry
        $serviceData = Get-AccurateServices
        $dbData = Get-GdbDatabases -Paths $script:Config.scanPaths -MaxDepth $script:Config.maxDepth

        $payload = [PSCustomObject]@{
            agentVersion    = "1.1.0"
            timestamp       = (Get-Date).ToString("o")
            licenseServerUrl= "http://$($pcData.ipAddress):$($script:Config.licenseServerPort)"

            pc              = $pcData
            accurateService = $serviceData
            databasesCount  = $dbData.Count
            databases       = $dbData
        }

        # Print JSON Summary to Console if -Once switch specified
        if ($Once) {
            Write-Host "`n--- PAYLOAD JSON TELEMETRY ---" -ForegroundColor Cyan
            Write-Host ($payload | ConvertTo-Json -Depth 6) -ForegroundColor Yellow
            Write-Host "------------------------------`n" -ForegroundColor Cyan
        }

        $sent = Send-TelemetrySignal -Payload $payload

    } catch {
        Write-Log "Unhandled Agent Exception: $_" "ERROR"
    }

    if ($Once) {
        Write-Log "Mode -Once aktif. Agent selesai." "INFO"
        break
    }

    Write-Log "Sleeping for $($script:Config.intervalSeconds) seconds..." "INFO"
    Start-Sleep -Seconds $script:Config.intervalSeconds

} while ($true)
