'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, XCircle, MapPin, ExternalLink } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import AttendanceEventDetails from './AttendanceEventDetails';
import type { MobileAttendanceEvent } from '@/lib/attendance/mobileApi';

export interface DayDetailData {
  events?: MobileAttendanceEvent[];
  id: string;
  dayName: string;
  dateStr: string;
  schedule?: string;
  status: string;
  statusText: string;
  checkIn: string;
  checkOut: string;
  duration?: string;
  note: string;
  serverRef: string;
  employeeName?: string;
  approvalStatus?: 'APPROVED' | 'PENDING' | 'REJECTED' | string | null;
  approvalNote?: string;
  mapUrl?: string | null;
  googleMapsUrl?: string | null;
  address?: string | null;
  photoUrl?: string | null;
}

interface DayDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  data: DayDetailData | null;
  onUpdated?: () => void;
}

export default function DayDetailSheet({ isOpen, onClose, data, onUpdated }: DayDetailSheetProps) {
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsSubmittingCorrection(false);
    }
  }, [isOpen]);

  if (!isOpen || !data) return null;

  const isAbsent = data.status === 'TIDAK_ABSEN' || data.status === 'ABSENT';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      isLoading={isSubmittingCorrection}
      title={data.dayName}
      subtitle={data.dateStr}
      maxWidthClass="max-w-md"
      footer={
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmittingCorrection}
          className="w-full min-h-[48px] py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold text-sm transition active:scale-[0.99] cursor-pointer"
        >
          Tutup Detail
        </button>
      }
    >
      <div className="space-y-4">
        {/* Banner Status Presensi */}
        <div
          className={`p-4 rounded-xl border ${
            isAbsent
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50/50 border-emerald-200/80 text-emerald-900'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider block opacity-75">
            Status Kehadiran Harian
          </span>
          <p className="text-sm font-extrabold mt-0.5">{data.statusText}</p>
        </div>

        {/* HR Review Status Banner */}
        {data.approvalStatus && (
          <div
            className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
              data.approvalStatus === 'APPROVED'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : data.approvalStatus === 'REJECTED'
                ? 'bg-rose-50/80 border-rose-300 text-rose-950'
                : 'bg-amber-50/80 border-amber-200 text-amber-950'
            }`}
          >
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-75">
                Status Review HRD
              </span>
              <p className="text-xs font-extrabold">
                {data.approvalStatus === 'APPROVED'
                  ? 'Disetujui'
                  : data.approvalStatus === 'REJECTED'
                  ? 'Ditolak HRD'
                  : 'Menunggu Persetujuan HRD'}
              </p>
              {data.approvalNote && (
                <p className="text-[11px] opacity-85 leading-tight">{data.approvalNote}</p>
              )}
            </div>
            <div className="shrink-0">
              {data.approvalStatus === 'APPROVED' && (
                <ShieldCheck className="w-5 h-5 text-[#059669]" />
              )}
              {data.approvalStatus === 'PENDING' && (
                <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
              )}
              {data.approvalStatus === 'REJECTED' && (
                <XCircle className="w-5 h-5 text-rose-600" />
              )}
            </div>
          </div>
        )}

        {/* Grid Info */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Nama Karyawan</span>
            <span className="font-bold text-slate-900">{data.employeeName || 'Karyawan'}</span>
          </div>
          {data.schedule && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Jadwal Kerja</span>
              <span className="font-semibold text-slate-800">{data.schedule}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Jam Masuk</span>
            <span className="font-mono font-bold text-slate-900">{data.checkIn}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Jam Pulang</span>
            <span className="font-mono font-bold text-slate-900">{data.checkOut}</span>
          </div>
          {data.duration && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Total Durasi</span>
              <span className="font-mono font-bold text-slate-900">{data.duration}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Referensi Transaksi</span>
            <span className="font-mono font-bold text-slate-800">{data.serverRef}</span>
          </div>
        </div>

        {data.events && (
          <AttendanceEventDetails
            events={data.events}
            onUpdated={onUpdated}
            onBusyChange={setIsSubmittingCorrection}
          />
        )}

        {/* Lokasi & Verifikasi Peta (OpenStreetMap & Google Maps) */}
        {!data.events?.length && (data.address || data.mapUrl || data.googleMapsUrl) && (
          <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-800">
              <MapPin className="w-4 h-4 text-[#059669] shrink-0" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider">
                Lokasi Absensi & Peta Verifikasi
              </span>
            </div>
            {data.address && (
              <p className="text-xs text-slate-700 font-medium pl-5">{data.address}</p>
            )}
            <div className="flex items-center gap-2 pt-1 pl-5">
              {data.mapUrl && (
                <a
                  href={data.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#059669] hover:text-[#047857] bg-white border border-emerald-300 rounded-lg px-2.5 py-1 shadow-2xs transition"
                >
                  <span>Peta OSM</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {data.googleMapsUrl && (
                <a
                  href={data.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1 shadow-2xs transition"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Catatan */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[11px] font-bold uppercase text-slate-500 block">Catatan Detail</span>
          <p className="text-slate-700 mt-1 leading-relaxed text-xs">
            {data.note || 'Presensi mobile tercatat via sistem.'}
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
