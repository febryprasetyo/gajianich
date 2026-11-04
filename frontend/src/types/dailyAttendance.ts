export interface DailyAttendanceEmployeeRow {
  no: number;
  employeeId: number;
  employeeName: string;
  jobLevel: string | null;
  position: string | null;
  isHighlighted: boolean;       // Stabilo kuning: otomatis jika Level Jabatan/Posisi = Koordinator / Direktur, atau di-override manual oleh HRD
  isCoordinator?: boolean;
  coordinatorId?: number | null;
  sortOrder?: number;
  locationUpdate: string;       // "Jakarta/ Kantor" (mesin) atau "Kabupaten Serang, Banten" (mobile/dinas luar)
  scanIn: string | null;        // "HH:mm" atau null
  isLate: boolean;              // true jika scanIn > scheduleIn
  lateMinutes: number;
  keterangan: string;           // "TDK ADA ABSEN", "SAKIT (SDH INFO...)", dll.
  attendanceStatus: string;     // 'PRESENT' | 'ALPHA' | 'SAKIT' | 'IZIN' | 'CUTI' | 'DINAS_LUAR'
  sourceType: 'ADMS' | 'MOBILE' | 'LEAVE' | 'MANUAL' | 'NONE';
}

export interface DailyAttendanceDepartmentGroup {
  departmentId: number;
  departmentName: string;
  employees: DailyAttendanceEmployeeRow[];
}

export interface DailyAttendanceReportData {
  workDate: string;             // 'YYYY-MM-DD'
  formattedDate: string;        // '30-Oct-26' / 'Jumat, 30 Oktober 2026'
  departments: DailyAttendanceDepartmentGroup[];
  summary: {
    totalEmployees: number;
    present: number;
    late: number;
    absent: number;
  };
}

export interface UpsertDailyNotePayload {
  workDate: string;
  employeeId: number;
  isHighlighted?: boolean;
  manualNote?: string;
}

export interface DepartmentRosterItem {
  employeeId: number;
  employeeName: string;
  jobLevel: string | null;
  position: string | null;
  sortOrder: number;
  isCoordinator: boolean;
  coordinatorId: number | null;
}

export interface SaveDepartmentRosterPayload {
  departmentId: number;
  items: {
    employeeId: number;
    sortOrder: number;
    isCoordinator: boolean;
    coordinatorId: number | null;
  }[];
}
