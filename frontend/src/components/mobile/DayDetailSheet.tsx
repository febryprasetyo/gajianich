'use client';

import React from "react";
import { X } from "lucide-react";

export interface DayDetailData {
  id: string;
  dayName: string;
  dateStr: string;
  schedule: string;
  status: "TEPAT_WAKTU" | "TERLAMBAT" | "TIDAK_ABSEN" | "BELUM_ABSEN";
  statusText: string;
  checkIn: string;
  checkOut: string;
  duration?: string;
  note: string;
  serverRef: string;
  employeeName?: string;
}

interface DayDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  data: DayDetailData | null;
}

export default function DayDetailSheet({ isOpen, onClose, data }: DayDetailSheetProps) {
  if (!isOpen || !data) return null;

  const isAbsent = data.status === "TIDAK_ABSEN";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dayDetailTitle"
      className="absolute inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-[28px] p-5 border-t border-slate-200 shadow-2xl space-y-4 max-h-[92%] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Detail Presensi Harian
            </span>
            <h3 id="dayDetailTitle" className="text-base font-extrabold text-slate-900 mt-0.5">
              {data.dayName}, {data.dateStr}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail presensi"
            className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs sm:text-sm">
          {/* Status Banner */}
          <div
            className={
              "p-3 rounded-xl border " +
              (isAbsent
                ? "bg-rose-50 border-rose-300 text-rose-900"
                : "bg-emerald-50 border-emerald-200 text-emerald-950")
            }
          >
            <span className="text-[11px] font-bold uppercase tracking-wider block opacity-75">
              Status Kehadiran Harian
            </span>
            <p className="text-sm font-extrabold mt-0.5">{data.statusText}</p>
          </div>

          {/* Grid Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Nama Karyawan</span>
              <span className="font-bold text-slate-900">{data.employeeName || "Febry Prasetyo"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Jadwal Kerja</span>
              <span className="font-semibold text-slate-800">{data.schedule}</span>
            </div>
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

          {/* Catatan */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold uppercase text-slate-500 block">Catatan Detail</span>
            <p className="text-slate-700 mt-1 leading-relaxed">{data.note}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[48px] py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm transition"
        >
          Tutup Detail
        </button>
      </div>
    </div>
  );
}
