'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
export default function AttendancePhoto({
  url,
  alt,
  className = 'max-h-60 max-w-full rounded-xl object-contain',
}: {
  url: string | null;
  alt: string;
  className?: string;
}) {
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setImage('');
    setError('');
    if (url) {
      apiFetch<{ dataUrl: string }>(url)
        .then((data) => {
          if (!cancelled) setImage(data.dataUrl);
        })
        .catch(() => {
          if (!cancelled) setError('Foto tidak tersedia.');
        });
    }
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (!url) return <p className="text-xs text-slate-500">Foto tidak tersedia.</p>;
  if (error) return <p className="text-xs text-slate-500">{error}</p>;
  return image ? (
    <img src={image} alt={alt} className={className} />
  ) : (
    <p role="status" className="text-xs text-slate-400">
      Memuat foto...
    </p>
  );
}
