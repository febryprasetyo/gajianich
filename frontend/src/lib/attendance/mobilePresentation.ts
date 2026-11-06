export function mobileGreeting(at: Date, timeZone = 'Asia/Jakarta', completed = false) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(at));
  const salutation = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  return { salutation, message: completed ? 'Terima kasih untuk kerja hari ini.' : 'Semoga harimu lancar.' };
}

export type ReviewFilter = 'ALL' | 'PENDING' | 'REJECTED';
interface SearchableRecord { approvalStatus?: string; statusText?: string; dateStr: string; workDate: string; approvalNote?: string }
export function filterMobileHistory<T extends SearchableRecord>(records: T[], filter: ReviewFilter, search: string): T[] {
  const query = search.trim().toLocaleLowerCase('id-ID');
  return records.filter(row => (filter === 'ALL' || row.approvalStatus === filter) &&
    [row.dateStr, row.workDate, row.statusText, row.approvalNote].filter(Boolean).join(' ').toLocaleLowerCase('id-ID').includes(query));
}

export function canCaptureAttendance(state: { online: boolean; enrolled: boolean; cameraReady: boolean; busy: boolean; locationLoading: boolean; latitude: number | null; longitude: number | null; locationError: string | null }) {
  return state.online && state.enrolled && state.cameraReady && !state.busy && !state.locationLoading &&
    state.latitude !== null && state.longitude !== null && !state.locationError;
}

export function attendanceReviewPresentation(status?: string | null, recorded = false) {
  if (status === 'APPROVED' || status === 'PENDING' || status === 'REJECTED') {
    return {
      title: 'Pengajuan luar kantor',
      label: status === 'APPROVED' ? 'Disetujui' : status === 'REJECTED' ? 'Ditolak' : 'Menunggu HRD',
      variant: status === 'APPROVED' ? 'success' as const : status === 'REJECTED' ? 'danger' as const : 'warning' as const,
      description: 'Pengajuan presensi luar kantor mengikuti pemeriksaan HRD.',
    };
  }
  return recorded ? {
    title: 'Presensi kantor tercatat', label: 'Tercatat', variant: 'success' as const,
    description: 'Kehadiran Anda sudah tercatat di sistem kantor. Tidak perlu mengajukan presensi mobile untuk absensi tersebut.',
  } : {
    title: 'Presensi luar kantor', label: 'Belum ada catatan', variant: 'slate' as const,
    description: 'Gunakan aplikasi ketika bertugas di luar kantor. Absensi melalui mesin kantor akan tampil setelah tersinkron ke sistem.',
  };
}
