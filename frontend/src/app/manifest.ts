import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GAJIANICH',
    short_name: 'GAJIANICH',
    description: 'Administrasi Perusahaan dan Presensi Karyawan',
    start_url: '/',
    id: '/m/beranda',
    scope: '/',
    display: 'fullscreen',
    display_override: ['fullscreen', 'standalone'],
    background_color: '#F8FAFC',
    theme_color: '#059669',
    icons: [
      {
        src: '/branding/gajianich-pwa-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/branding/gajianich-pwa-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
