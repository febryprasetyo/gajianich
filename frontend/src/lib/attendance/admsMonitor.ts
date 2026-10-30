export interface AdmsMonitorData {
  server: { ready: boolean; checkedAt: string; message: string };
  summary: { devices: number; online: number; received: number; inserted: number; rejected: number; unmapped: number };
  devices: Array<{
    id: number; name: string; serial: string; groupId: number; online: boolean; enabled: boolean;
    lastSeenAt: string | null; lastSyncAt: string | null; totalLogs: number; unmappedLogs: number; rejectedBatches: number;
  }>;
  receipts: Array<{
    id: string; deviceId: number; deviceName: string; serial: string; source: string; tableName: string;
    outcome: string; errorMessage: string | null; totalReceived: number; totalInserted: number;
    totalUnmapped: number; receivedAt: string; storageTarget: 'MAIN_LEGACY' | 'REVIEW';
  }>;
  pagination: { page: number; limit: number; total: number };
}

export type AdmsMonitorDevice = AdmsMonitorData['devices'][number];
export type DeviceFilter = 'all' | 'online' | 'unmapped';

export function filterMonitorDevices(devices: AdmsMonitorData['devices'], filter: DeviceFilter) {
  return devices.filter(device => filter === 'online' ? device.online : filter === 'unmapped' ? device.unmappedLogs > 0 : true);
}

// Schedule the next poll after completion so a slow server never accumulates requests.
export function startMonitorPolling(run: (signal: AbortSignal) => Promise<void>, interval = 5000) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function poll() {
    try {
      if (!controller.signal.aborted) await run(controller.signal);
    } finally {
      if (!controller.signal.aborted) timer = setTimeout(() => { void poll(); }, interval);
    }
  }
  void Promise.resolve().then(poll);
  return () => {
    controller.abort();
    clearTimeout(timer);
  };
}

// Race the deadline as well as aborting fetch: a transport ignoring abort must not stall monitoring.
export async function withMonitorDeadline<T>(request: (signal: AbortSignal) => Promise<T>, lifecycle: AbortSignal, timeout = 10000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: () => void = () => {};
  const deadline = new Promise<never>((_, reject) => {
    abort = () => {
      reject(new DOMException('Monitoring dihentikan.', 'AbortError'));
      controller.abort();
    };
    lifecycle.addEventListener('abort', abort, { once: true });
    if (lifecycle.aborted) abort();
    timer = setTimeout(() => {
      reject(new DOMException('Batas waktu monitoring terlampaui.', 'TimeoutError'));
      controller.abort();
    }, timeout);
  });
  try {
    if (lifecycle.aborted) return await deadline;
    return await Promise.race([request(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
    lifecycle.removeEventListener('abort', abort);
  }
}


export interface AdmsReviewLogsData {
  logs: Array<{
    id: string; deviceId: number; deviceName: string; serial: string; pin: string;
    timestamp: string; verifyMode: string; inOutState: string; source: string;
    employeeName: string | null;
  }>;
  pagination: { page: number; limit: number; total: number };
}

export function buildAdmsReviewQuery(filters: { deviceId: string; startDate: string; endDate: string; pin: string; unmapped?: boolean | string | null; page: number }) {
  const query = new URLSearchParams({ page: String(filters.page), limit: '20' });
  for (const field of ['deviceId', 'startDate', 'endDate', 'pin'] as const) {
    if (filters[field]) query.set(field, filters[field]);
  }
  if (filters.unmapped !== undefined && filters.unmapped !== null && filters.unmapped !== '') {
    query.set('unmapped', String(filters.unmapped));
  }
  return query.toString();
}

export function validateAdmsReviewRange(startDate: string, endDate: string) {
  return startDate && endDate && startDate > endDate ? 'Tanggal mulai harus sebelum atau sama dengan tanggal akhir.' : null;
}

export function formatAdmsLocalTimestamp(value: string) {
  const local = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.\d+)?$/.exec(value);
  return local ? `${local[3]}/${local[2]}/${local[1]} ${local[4]}` : value;
}

export type AdmsReadCommandStatus = 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'UNSUPPORTED' | 'FAILED' | 'EXPIRED';

export interface AdmsReadCommandsData {
  commands: Array<{
    id: string; deviceId: number; deviceName: string; serial: string; status: AdmsReadCommandStatus;
    startAt: string; endAt: string; createdAt: string; sentAt: string | null; completedAt: string | null;
    expiresAt: string; returnCode: number | null;
  }>;
}

export function validateAdmsHistoryRequest(groupId: number | null, deviceId: string, startDate: string, endDate: string) {
  if (groupId === null) return 'Pilih kelompok organisasi terlebih dahulu untuk meminta log historis.';
  if (!/^\d+$/.test(deviceId) || Number(deviceId) < 1) return 'Pilih mesin ADMS yang akan diminta lognya.';
  if (!startDate || !endDate) return 'Isi tanggal mulai dan tanggal akhir.';
  const dates = [startDate, endDate].map(value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
  });
  if (dates.some(value => !Number.isFinite(value))) return 'Tanggal permintaan tidak valid.';
  if (dates[1] < dates[0]) return 'Tanggal mulai harus sebelum atau sama dengan tanggal akhir.';
  if ((dates[1] - dates[0]) / 86400000 + 1 > 31) return 'Rentang permintaan maksimal 31 hari, termasuk tanggal mulai dan akhir.';
  return null;
}

export function admsReadCommandStatus(status: AdmsReadCommandStatus) {
  const statuses = {
    PENDING: { label: 'Menunggu mesin', variant: 'warning' },
    SENT: { label: 'Menunggu balasan mesin', variant: 'warning' },
    ACKNOWLEDGED: { label: 'Permintaan diterima mesin', variant: 'info' },
    UNSUPPORTED: { label: 'Firmware tidak mendukung', variant: 'warning' },
    FAILED: { label: 'Permintaan gagal', variant: 'danger' },
    EXPIRED: { label: 'Permintaan kedaluwarsa', variant: 'slate' },
  } as const;
  return statuses[status] ?? { label: 'Status belum diketahui', variant: 'slate' as const };
}

export interface AdmsCandidateDevice {
  id: number;
  name: string;
  serialNumber: string | null;
  ip: string;
  port: number;
  connectionType: 'Ethernet' | 'ADMS';
  isEnabled: boolean;
  groupId?: number | null;
  groupName?: string | null;
  admsRegistered: boolean;
  admsEnabled: boolean;
  allowedNetwork: string | null;
  lastSeenAt: string | null;
  lastDataAt: string | null;
}

export function validateCidrInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'IP / CIDR allowlist harus diisi.';
  const parts = trimmed.split('/');
  if (parts.length > 2) return 'Format IP / CIDR tidak valid.';
  const ip = parts[0].trim();
  const octets = ip.split('.');
  if (octets.length !== 4) return 'Format IP tidak valid (contoh: 192.168.10.224).';
  for (const oct of octets) {
    if (!/^\d{1,3}$/.test(oct) || Number(oct) < 0 || Number(oct) > 255) {
      return 'Nilai oktet IP harus antara 0 dan 255.';
    }
  }
  if (ip === '0.0.0.0') return 'Alamat 0.0.0.0 tidak diperbolehkan.';
  if (parts[1] !== undefined) {
    const mask = Number(parts[1].trim());
    if (!/^\d{1,2}$/.test(parts[1].trim()) || mask < 16 || mask > 32) {
      return 'Subnet mask harus antara /16 dan /32 (misal: /32 untuk satu IP, /24 untuk satu subnet).';
    }
  }
  return null;
}

export function validateAdmsRegistration(
  groupId: number | null,
  deviceId: string,
  serial: string,
  sourceCidr: string
): string | null {
  if (groupId === null) return 'Pilih kelompok organisasi terlebih dahulu.';
  if (!/^\d+$/.test(deviceId) || Number(deviceId) < 1) return 'Pilih mesin absensi yang akan didaftarkan.';
  if (!serial.trim() || !/^[A-Za-z0-9_-]{1,100}$/.test(serial.trim())) {
    return 'Nomor seri (SN) harus alfanumerik 1-100 karakter.';
  }
  return validateCidrInput(sourceCidr);
}

export function validateNewAdmsDevice(
  groupId: number | null,
  name: string,
  ip: string,
  port: string | number,
  serial: string,
  sourceCidr: string
): string | null {
  if (groupId === null) return 'Pilih kelompok unit / cabang organisasi terlebih dahulu.';
  if (!name.trim()) return 'Nama mesin absensi harus diisi.';
  if (!ip.trim()) return 'Alamat IP mesin harus diisi.';
  const octets = ip.trim().split('.');
  if (octets.length !== 4 || octets.some(o => !/^\d{1,3}$/.test(o) || Number(o) < 0 || Number(o) > 255)) {
    return 'Format IP mesin tidak valid (contoh: 192.168.10.50).';
  }
  const portNum = Number(port);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    return 'Port harus berupa angka antara 1 dan 65535 (default: 4370).';
  }
  if (!serial.trim() || !/^[A-Za-z0-9_-]{1,100}$/.test(serial.trim())) {
    return 'Nomor seri (SN) harus alfanumerik 1-100 karakter.';
  }
  return validateCidrInput(sourceCidr || `${ip.trim()}/32`);
}
