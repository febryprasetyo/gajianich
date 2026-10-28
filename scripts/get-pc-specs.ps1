<#
.SYNOPSIS
    Mendapatkan detail spesifikasi hardware PC / Laptop untuk registrasi GAJIANICH.
.DESCRIPTION
    Script ini mengekstrak Processor, RAM, Jumlah Slot RAM, Disk 1, Disk 2,
    Serial Number, dan Model Perangkat dalam format yang siap dimasukkan ke GAJIANICH.
#>

$ErrorActionPreference = "SilentlyContinue"

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "   GAJIANICH IT ASSET HARDWARE SPECIFICATION EXTRACTOR" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

# 1. Device Model & Manufacturer
$cs = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS
$model = "$($cs.Manufacturer) $($cs.Model)".Trim()
$serial = $bios.SerialNumber.Trim()

# 2. Processor (CPU)
$cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name.Trim()
# Bersihkan spasi ganda jika ada
$cpu = $cpu -replace '\s+', ' '

# 3. RAM Size & Slots
$ramModules = Get-CimInstance Win32_PhysicalMemory
$totalRamBytes = ($ramModules | Measure-Object -Property Capacity -Sum).Sum
$totalRamGb = [Math]::Round($totalRamBytes / 1GB)

$memoryArray = Get-CimInstance Win32_PhysicalMemoryArray | Select-Object -First 1
$ramSlots = if ($memoryArray.MemoryDevices) { $memoryArray.MemoryDevices } else { $ramModules.Count }

# 4. Storage (Disks)
$disks = Get-CimInstance Win32_DiskDrive | Where-Object { $_.MediaType -match 'Fixed|SSD|Hard' -or $_.InterfaceType -match 'SCSI|IDE|NVMe|USB' } | Sort-Object Index
$disk1Gb = if ($disks.Count -ge 1) { [Math]::Round($disks[0].Size / 1GB) } else { 0 }
$disk2Gb = if ($disks.Count -ge 2) { [Math]::Round($disks[1].Size / 1GB) } else { "" }

# Tampilkan Hasil Terstruktur
Write-Host "--- RINGKASAN UNTUK FORM GAJIANICH / EXCEL IMPORT ---" -ForegroundColor Yellow
Write-Host "Model / Asset Name : " -NoNewline; Write-Host $model -ForegroundColor Green
Write-Host "Serial Number      : " -NoNewline; Write-Host $serial -ForegroundColor Green
Write-Host "Processor (CPU)    : " -NoNewline; Write-Host $cpu -ForegroundColor Green
Write-Host "RAM Size (GB)      : " -NoNewline; Write-Host "$totalRamGb" -ForegroundColor Green
Write-Host "RAM Slot Count     : " -NoNewline; Write-Host "$ramSlots" -ForegroundColor Green
Write-Host "Disk 1 Size (GB)   : " -NoNewline; Write-Host "$disk1Gb" -ForegroundColor Green
if ($disk2Gb) {
    Write-Host "Disk 2 Size (GB)   : " -NoNewline; Write-Host "$disk2Gb" -ForegroundColor Green
} else {
    Write-Host "Disk 2 Size (GB)   : " -NoNewline; Write-Host "(Tidak ada / Kosong)" -ForegroundColor Gray
}

Write-Host "`n--- FORMAT COPY-PASTE TAB (EXCEL TEMPLATE LAPTOP-PC) ---" -ForegroundColor Yellow
$tsvLine = "$model`t$serial`t$cpu`t$totalRamGb`t$ramSlots`t$disk1Gb`t$disk2Gb"
Write-Host $tsvLine -ForegroundColor White
Write-Host "`n========================================================`n" -ForegroundColor Cyan
