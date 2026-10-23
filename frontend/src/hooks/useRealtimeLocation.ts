'use client';

import { useState, useEffect, useCallback } from 'react';

export interface RealtimeLocationState {
  loading: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  address: string | null;
  error: string | null;
  timestamp: number | null;
  displayText: string;
}

export function useRealtimeLocation(enabled = true) {
  const [location, setLocation] = useState<RealtimeLocationState>({
    loading: true,
    latitude: null,
    longitude: null,
    accuracy: null,
    address: null,
    error: null,
    timestamp: null,
    displayText: 'Mencari lokasi sekarang...',
  });

  const fetchLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocation({
        loading: false,
        latitude: null,
        longitude: null,
        accuracy: null,
        address: null,
        error: 'Browser tidak mendukung lokasi GPS.',
        timestamp: Date.now(),
        displayText: 'Browser tidak mendukung lokasi GPS.',
      });
      return;
    }

    setLocation((prev) => ({
      ...prev,
      loading: true,
      displayText: 'Mengunci lokasi sekarang...',
      error: null,
    }));

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        const acc = Math.round(pos.coords.accuracy);

        let addressText: string | null = null;
        try {
          // Attempt client reverse geocoding for a user-friendly street/area name
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);

          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const road = addr.road || addr.suburb || addr.neighbourhood || '';
            const city = addr.city || addr.town || addr.municipality || addr.county || '';
            if (road || city) {
              addressText = data.display_name || [road, city].filter(Boolean).join(', ');
            }
          }
        } catch {
          // Fallback to coordinates
        }

        const displayText = addressText
          ? `Lokasi Sekarang: ${addressText} (±${acc}m)`
          : 'Lokasi ditemukan. Alamat belum tersedia; titik GPS tetap disimpan.';

        setLocation({
          loading: false,
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          address: addressText,
          error: null,
          timestamp: pos.timestamp,
          displayText,
        });
      },
      (err) => {
        let fallbackMsg = 'Sinyal GPS lemah / belum diizinkan.';
        if (err.code === err.PERMISSION_DENIED) {
          fallbackMsg = 'Izin lokasi HP diblokir. Aktifkan izin lokasi di browser.';
        }

        setLocation({
          loading: false,
          latitude: null,
          longitude: null,
          accuracy: null,
          address: null,
          error: fallbackMsg,
          timestamp: Date.now(),
          displayText: fallbackMsg,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );
  }, []);

  useEffect(() => {
    if (enabled) fetchLocation();
  }, [fetchLocation, enabled]);

  return {
    ...location,
    refetch: fetchLocation,
  };
}
