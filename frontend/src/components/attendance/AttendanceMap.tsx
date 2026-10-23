'use client';
export default function AttendanceMap({ latitude, longitude, label = 'Peta titik presensi' }: { latitude: string | number | null; longitude: string | number | null; label?: string }) {
  if (latitude === null || longitude === null) return <p className="text-xs text-slate-600">Titik lokasi tidak tersedia.</p>;
  const lat = Number(latitude); const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return <p className="text-xs text-slate-600">Titik lokasi tidak valid.</p>;
  const bbox = [lon - 0.004, lat - 0.003, lon + 0.004, lat + 0.003].join(',');
  return <iframe title={label} src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lon}`} className="h-52 w-full rounded-xl border border-slate-200 bg-slate-100" referrerPolicy="no-referrer" />;
}
