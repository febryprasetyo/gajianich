export interface AttendanceDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  commKey: number;
  deviceNumber: number;
  serialNumber?: string;
  location: string;
  connectionType: 'Ethernet' | 'WiFi' | 'RS485';
  status: 'connected' | 'disconnected' | 'error';
  lastSyncAt: string | null;
  totalLogs?: number;
}

export interface RawAttendanceLog {
  id: string;
  deviceIp: string;
  deviceName: string;
  pin: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  timestamp: string; // YYYY-MM-DD HH:mm:ss
  verifyMode: 'Fingerprint' | 'Face' | 'Password' | 'Card';
  inOutState: 'Masuk' | 'Pulang' | 'Scan Antara';
  workDate: string; // YYYY-MM-DD
}

export interface ProcessedAttendanceRecord {
  id: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  workDate: string;
  shiftName: string;
  shiftIn: string;
  shiftOut: string;
  scanIn: string | null;
  scanOut: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  status: 'Hadir Tepat Waktu' | 'Terlambat' | 'Pulang Cepat' | 'Tidak Hadir' | 'Belum Scan Pulang';
  rawPunchesCount: number;
}

export interface UnassignedShiftRecord {
  id: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  workDate: string;
  scanIn: string | null;
  scanOut: string | null;
  rawPunchesCount: number;
}

export const DEFAULT_DEVICES: AttendanceDevice[] = [
  {
    id: 'dev-1',
    name: 'Solution X900 Utama',
    ip: '192.168.10.224',
    port: 4370,
    commKey: 0,
    deviceNumber: 1,
    serialNumber: 'WAE4242900026',
    location: 'Lobby Kantor Pusat',
    connectionType: 'Ethernet',
    status: 'disconnected',
    lastSyncAt: '2026-10-27 08:30:15',
    totalLogs: 142,
  },
  {
    id: 'dev-2',
    name: 'Solution X900 MGM',
    ip: '192.168.10.4',
    port: 4370,
    commKey: 0,
    deviceNumber: 2,
    serialNumber: 'WAE4242300038',
    location: 'Pintu Masuk MGM',
    connectionType: 'Ethernet',
    status: 'disconnected',
    lastSyncAt: '2026-10-27 08:15:22',
    totalLogs: 88,
  },
  {
    id: 'dev-3',
    name: 'Solution Gudang 2 (VPN Cabang)',
    ip: '192.168.0.80',
    port: 4370,
    commKey: 0,
    deviceNumber: 3,
    serialNumber: 'WAE4242100099',
    location: 'Gudang Logistik Barat',
    connectionType: 'Ethernet',
    status: 'disconnected',
    lastSyncAt: '2026-10-26 17:05:00',
    totalLogs: 45,
  },
];

export const INITIAL_RAW_LOGS: RawAttendanceLog[] = [
  { id: 'raw-1', deviceIp: '192.168.10.224', deviceName: 'Solution X900 Utama', pin: '1001', employeeCode: 'EMP001', employeeName: 'Ahmad Dahlan', department: 'IT Support', timestamp: '2026-10-27 07:54:12', verifyMode: 'Fingerprint', inOutState: 'Masuk', workDate: '2026-10-27' },
  { id: 'raw-2', deviceIp: '192.168.10.224', deviceName: 'Solution X900 Utama', pin: '1001', employeeCode: 'EMP001', employeeName: 'Ahmad Dahlan', department: 'IT Support', timestamp: '2026-10-27 07:55:04', verifyMode: 'Fingerprint', inOutState: 'Scan Antara', workDate: '2026-10-27' },
  { id: 'raw-3', deviceIp: '192.168.10.224', deviceName: 'Solution X900 Utama', pin: '1001', employeeCode: 'EMP001', employeeName: 'Ahmad Dahlan', department: 'IT Support', timestamp: '2026-10-27 12:15:30', verifyMode: 'Face', inOutState: 'Scan Antara', workDate: '2026-10-27' },
  { id: 'raw-4', deviceIp: '192.168.10.224', deviceName: 'Solution X900 Utama', pin: '1001', employeeCode: 'EMP001', employeeName: 'Ahmad Dahlan', department: 'IT Support', timestamp: '2026-10-27 17:05:22', verifyMode: 'Fingerprint', inOutState: 'Pulang', workDate: '2026-10-27' },
  { id: 'raw-5', deviceIp: '192.168.10.224', deviceName: 'Solution X900 Utama', pin: '1002', employeeCode: 'EMP002', employeeName: 'Budi Santoso', department: 'Finance', timestamp: '2026-10-27 08:14:50', verifyMode: 'Face', inOutState: 'Masuk', workDate: '2026-10-27' },
  { id: 'raw-6', deviceIp: '192.168.10.224', deviceName: 'Solution X900 Utama', pin: '1002', employeeCode: 'EMP002', employeeName: 'Budi Santoso', department: 'Finance', timestamp: '2026-10-27 17:01:10', verifyMode: 'Face', inOutState: 'Pulang', workDate: '2026-10-27' },
  { id: 'raw-7', deviceIp: '192.168.10.4', deviceName: 'Solution X900 MGM', pin: '1003', employeeCode: 'EMP003', employeeName: 'Citra Kirana', department: 'Marketing', timestamp: '2026-10-27 08:02:18', verifyMode: 'Face', inOutState: 'Masuk', workDate: '2026-10-27' },
  { id: 'raw-8', deviceIp: '192.168.10.224', deviceName: 'Solution X900 Utama', pin: '1004', employeeCode: 'EMP004', employeeName: 'Doni Pratama (Magang)', department: 'Operasional', timestamp: '2026-10-27 07:48:10', verifyMode: 'Fingerprint', inOutState: 'Masuk', workDate: '2026-10-27' },
  { id: 'raw-9', deviceIp: '192.168.10.224', deviceName: 'Solution X900 Utama', pin: '1004', employeeCode: 'EMP004', employeeName: 'Doni Pratama (Magang)', department: 'Operasional', timestamp: '2026-10-27 16:55:00', verifyMode: 'Fingerprint', inOutState: 'Pulang', workDate: '2026-10-27' },
];

export const KNOWN_SHIFTS: Record<string, { shiftName: string; shiftIn: string; shiftOut: string }> = {
  EMP001: { shiftName: 'Reguler Pagi (08:00 - 17:00)', shiftIn: '08:00', shiftOut: '17:00' },
  EMP002: { shiftName: 'Reguler Pagi (08:00 - 17:00)', shiftIn: '08:00', shiftOut: '17:00' },
  EMP003: { shiftName: 'Shift Siang (09:00 - 18:00)', shiftIn: '09:00', shiftOut: '18:00' },
  // EMP004 intentionally missing to demonstrate unassigned shift handling
};

export function calculateRecordsFromRawLogs(
  logs: RawAttendanceLog[],
  shiftAssignments: Record<string, { shiftName: string; shiftIn: string; shiftOut: string }> = KNOWN_SHIFTS
): { processed: ProcessedAttendanceRecord[]; unassigned: UnassignedShiftRecord[] } {
  const groups: Record<string, RawAttendanceLog[]> = {};
  logs.forEach((log) => {
    const key = `${log.employeeCode}_${log.workDate}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(log);
  });

  const processed: ProcessedAttendanceRecord[] = [];
  const unassigned: UnassignedShiftRecord[] = [];

  Object.values(groups).forEach((punchList) => {
    punchList.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const firstPunch = punchList[0];
    const lastPunch = punchList[punchList.length - 1];
    const scanInTime = firstPunch.timestamp.substring(11, 16);
    const scanOutTime = punchList.length > 1 ? lastPunch.timestamp.substring(11, 16) : null;

    const shift = shiftAssignments[firstPunch.employeeCode];
    if (!shift) {
      unassigned.push({
        id: `unassigned-${firstPunch.employeeCode}-${firstPunch.workDate}`,
        employeeCode: firstPunch.employeeCode,
        employeeName: firstPunch.employeeName,
        department: firstPunch.department,
        workDate: firstPunch.workDate,
        scanIn: scanInTime,
        scanOut: scanOutTime,
        rawPunchesCount: punchList.length,
      });
      return;
    }

    const [schedInH, schedInM] = shift.shiftIn.split(':').map(Number);
    const [scanInH, scanInM] = scanInTime.split(':').map(Number);
    const late = Math.max(0, (scanInH * 60 + scanInM) - (schedInH * 60 + schedInM));

    let early = 0;
    if (scanOutTime) {
      const [schedOutH, schedOutM] = shift.shiftOut.split(':').map(Number);
      const [scanOutH, scanOutM] = scanOutTime.split(':').map(Number);
      early = Math.max(0, (schedOutH * 60 + schedOutM) - (scanOutH * 60 + scanOutM));
    }

    let status: ProcessedAttendanceRecord['status'] = 'Hadir Tepat Waktu';
    if (late > 0) status = 'Terlambat';
    else if (early > 0) status = 'Pulang Cepat';
    if (!scanOutTime) status = 'Belum Scan Pulang';

    processed.push({
      id: `proc-${firstPunch.employeeCode}-${firstPunch.workDate}`,
      employeeCode: firstPunch.employeeCode,
      employeeName: firstPunch.employeeName,
      department: firstPunch.department,
      workDate: firstPunch.workDate,
      shiftName: shift.shiftName,
      shiftIn: shift.shiftIn,
      shiftOut: shift.shiftOut,
      scanIn: scanInTime,
      scanOut: scanOutTime,
      lateMinutes: late,
      earlyMinutes: early,
      status,
      rawPunchesCount: punchList.length,
    });
  });

  return { processed, unassigned };
}
