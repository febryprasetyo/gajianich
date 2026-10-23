// The complete dataset preserves Asia/Jayapura; the merged default can return Asia/Tokyo.
import { find } from 'geo-tz/dist/find-all';
export const zoneLabels: Record<string, string> = {
  'Asia/Jakarta': 'WIB',
  'Asia/Pontianak': 'WIB',
  'Asia/Makassar': 'WITA',
  'Asia/Jayapura': 'WIT',
};

export function zoneAtLocation(latitude?: number | null, longitude?: number | null): string {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    throw new Error('Lokasi GPS valid diperlukan untuk presensi.');
  }

  const zone = find(latitude, longitude)[0];
  if (!zoneLabels[zone]) throw new Error('Lokasi presensi harus berada pada zona waktu Indonesia.');
  return zone;
}

export function localAttendanceTime(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    workDate: `${value('year')}-${value('month')}-${value('day')}`,
    scanTime: `${value('hour')}:${value('minute')}`,
  };
}

export const minuteValue = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

export function attendanceMetrics(scheduleIn: string, scheduleOut: string, scanIn: string | null, scanOut: string | null, outDayOffset = 0) {
  const start = minuteValue(scheduleIn);
  const end = minuteValue(scheduleOut) + (minuteValue(scheduleOut) <= start ? 1440 : 0);
  const actualEnd = scanOut ? minuteValue(scanOut) + outDayOffset * 1440 : null;
  return {
    lateMinutes: scanIn ? Math.max(0, minuteValue(scanIn) - start) : 0,
    earlyMinutes: actualEnd === null ? 0 : Math.max(0, end - actualEnd),
    overtimeMinutes: actualEnd === null ? 0 : Math.max(0, actualEnd - end),
  };
}
