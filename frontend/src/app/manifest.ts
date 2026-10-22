import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GAJIANICH — Presensi Mobile',
    short_name: 'GAJIANICH',
    description: 'Presensi Karyawan, Riwayat Kehadiran, dan Profil Mandiri',
    start_url: '/m/beranda',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#059669',
    icons: [
      {
        src: '/branding/gajianich-cat-favicon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/branding/gajianich-cat.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
