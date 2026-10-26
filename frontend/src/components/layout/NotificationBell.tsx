'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Bell, CalendarCheck, ScanFace, CheckCircle2 } from 'lucide-react';

interface BadgeData {
  pendingAttendance: number;
  pendingPhotos: number;
  totalPending: number;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [data, setData] = useState<BadgeData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if user has permission to verify approvals
  const canVerify = Boolean(
    user?.permissions?.includes('*') ||
    user?.permissions?.includes('attendance.mobile.verify') ||
    user?.permissions?.includes('attendance.manage') ||
    ['superadmin', 'admin'].includes((user?.roleName || '').toLowerCase().replace(/[\s_-]+/g, ''))
  );

  const fetchBadge = useCallback(async () => {
    if (!canVerify) return;
    try {
      const res = await apiFetch<{ success: boolean; data: BadgeData }>('/attendance/mobile/badge-count');
      if (res.data) {
        setData(res.data);
      }
    } catch {
      // Silent error on polling to avoid disturbing user
    }
  }, [canVerify]);

  useEffect(() => {
    if (!canVerify) return;

    void fetchBadge();

    // Poll every 60s when page is visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void fetchBadge();
      }
    }, 60000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchBadge();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [canVerify, fetchBadge]);

  // Click outside and Esc listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!canVerify) return null;

  const total = data?.totalPending || 0;
  const pendingAttendance = data?.pendingAttendance || 0;
  const pendingPhotos = data?.pendingPhotos || 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) void fetchBadge();
        }}
        aria-label={`Notifikasi persetujuan: ${total} menunggu review`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
      >
        <Bell className="w-5 h-5" />
        {total > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Pusat Notifikasi Persetujuan"
          className="absolute right-0 mt-2 w-80 sm:w-88 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Persetujuan Menunggu Review</span>
              {total > 0 && (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                  {total} baru
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void fetchBadge()}
              className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
            >
              Cek status
            </button>
          </div>

          <div className="py-2 space-y-2">
            {total === 0 ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-800">Semua Beres!</p>
                <p className="text-[11px] text-slate-500">Tidak ada pengajuan yang membutuhkan peninjauan saat ini.</p>
              </div>
            ) : (
              <>
                <Link
                  href="/dashboard/attendance/approvals"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <CalendarCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        Persetujuan Absensi
                      </p>
                      <p className="text-[11px] text-slate-500">Log kehadiran mandiri / geofence</p>
                    </div>
                  </div>
                  {pendingAttendance > 0 ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                      {pendingAttendance}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">0</span>
                  )}
                </Link>

                <Link
                  href="/dashboard/attendance/approvals/photos"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <ScanFace className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        Persetujuan Foto Wajah
                      </p>
                      <p className="text-[11px] text-slate-500">Permohonan update foto profil</p>
                    </div>
                  </div>
                  {pendingPhotos > 0 ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                      {pendingPhotos}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">0</span>
                  )}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
