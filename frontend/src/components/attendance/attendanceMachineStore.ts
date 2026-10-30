export interface AttendanceDevice {
  id: string | number;
  code?: string;
  name: string;
  ip: string;
  port: number;
  commKey: number;
  deviceNumber: number;
  serialNumber?: string;
  model?: string;
  platform?: string;
  firmware?: string;
  location: string;
  connectionType: "Ethernet" | "WiFi" | "RS485" | "ADMS";
  status: "connected" | "disconnected" | "error" | "online" | "offline";
  lastSyncAt: string | null;
  totalLogs?: number;
  idleSecondsLeft?: number | null;
  admsRegistered?: boolean;
  admsEnabled?: boolean;
  allowedNetwork?: string | null;
}

export interface RawAttendanceLog {
  id: string | number;
  deviceIp: string;
  deviceName: string;
  deviceLocation?: string;
  pin: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  timestamp: string; // YYYY-MM-DD HH:mm:ss
  verifyMode: "Fingerprint" | "Face" | "Password" | "Card";
  inOutState: "Masuk" | "Pulang" | "Scan Antara";
  workDate: string; // YYYY-MM-DD
}

export interface ProcessedAttendanceRecord {
  id: string | number;
  employeeId?: number;
  employeeCode: string;
  employeeName: string;
  department: string;
  workDate: string;
  shiftName: string;
  shiftCode: string;
  shiftIn?: string;
  shiftOut?: string;
  scheduleIn?: string;
  scheduleOut?: string;
  scanIn: string | null;
  scanOut: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  status: "Hadir Tepat Waktu" | "Terlambat" | "Pulang Cepat" | "Tidak Hadir" | "Belum Scan Pulang";
  rawPunchesCount: number;
}

export interface UnassignedShiftRecord {
  id?: string | number;
  employeeId?: number;
  employeeCode: string;
  employeeName: string;
  department: string;
  workDate: string;
  scanIn: string | null;
  scanOut: string | null;
  rawPunchesCount: number;
  suggestedShiftCode?: string;
}
