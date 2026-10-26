'use client';

import React, { useState } from 'react';
import { LogIn, LogOut, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';

export interface SmartClockSelectionResult {
  eventType: 'IN' | 'OUT';
  isDirectOut: boolean;
  notes?: string;
}

interface SmartClockSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTimeStr?: string;
  scheduleIn?: string;
  scheduleOut?: string;
  onConfirm: (result: SmartClockSelectionResult) => void;
}

export default function SmartClockSelectionModal({
  isOpen,
  onClose,
  currentTimeStr,
  scheduleIn = '08:00',
  scheduleOut = '17:00',
  onConfirm,
}: SmartClockSelectionModalProps) {
  const [selectedOption, setSelectedOption] = useState<'IN' | 'DIRECT_OUT'>('DIRECT_OUT');
  const [directOutNotes, setDirectOutNotes] = useState('');
  const [errorText, setErrorText] = useState('');

  if (!isOpen) return null;

  const handleProceed = () => {
    setErrorText('');
    if (selectedOption === 'DIRECT_OUT') {
      const trimmed = directOutNotes.trim();
      if (!trimmed || trimmed.length < 3) {
        setErrorText('Keterangan wajib diisi (minimal 3 karakter) untuk klarifikasi lupa absen masuk.');
        return;
      }
      onConfirm({
        eventType: 'OUT',
        isDirectOut: true,
        notes: trimmed,
      });
    } else {
      onConfirm({
        eventType: 'IN',
        isDirectOut: false,
      });
    }
  };

  const isDirectOutInvalid = selectedOption === 'DIRECT_OUT' && directOutNotes.trim().length < 3;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Konfirmasi Kehadiran Hari Ini"
      maxWidthClass="max-w-md"
      footer={
        <div className="flex flex-col gap-2 w-full">
          {errorText && (
            <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5 font-medium flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorText}</span>
            </p>
          )}
          <button
            type="button"
            onClick={handleProceed}
            disabled={isDirectOutInvalid}
            className="w-full min-h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] px-4 py-3 text-sm font-bold text-white shadow-sm transition disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Lanjutkan Presensi</span>
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Info Banner */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-slate-800">
          <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
            <Clock className="w-4 h-4 text-amber-700" />
            <span>Waktu Saat Ini: {currentTimeStr || 'Sore Hari'}</span>
          </div>
          <p className="text-xs text-slate-700 mt-1 leading-relaxed">
            Jadwal shift Anda adalah <strong className="font-semibold text-slate-900">{scheduleIn} – {scheduleOut}</strong>. Anda belum memiliki catatan presensi masuk hari ini.
          </p>
        </div>

        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Pilih Status Kehadiran Anda
        </p>

        {/* Option 1: Direct OUT */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedOption('DIRECT_OUT')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedOption('DIRECT_OUT');
            }
          }}
          className={`cursor-pointer rounded-2xl border p-3.5 transition text-left space-y-2 ${
            selectedOption === 'DIRECT_OUT'
              ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  selectedOption === 'DIRECT_OUT'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                  Langsung Absen Pulang
                </h4>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full inline-block mt-0.5">
                  Lupa Presensi Pagi
                </span>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                selectedOption === 'DIRECT_OUT'
                  ? 'border-emerald-700 bg-emerald-700'
                  : 'border-slate-300 bg-white'
              }`}
            >
              {selectedOption === 'DIRECT_OUT' && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-snug pl-11">
            Gunakan opsi ini jika Anda sudah hadir bekerja sejak pagi namun lupa absen masuk. Presensi akan langsung dicatat sebagai jam pulang dan wajib ditinjau oleh HRD.
          </p>

          {/* Mandatory note textarea if direct out is selected */}
          {selectedOption === 'DIRECT_OUT' && (
            <div className="pt-2 pl-11 space-y-1.5" onClick={(e) => e.stopPropagation()}>
              <label htmlFor="direct-out-notes" className="block text-xs font-bold text-slate-800">
                Keterangan Kehadiran Pagi <span className="text-rose-600">*</span>
              </label>
              <textarea
                id="direct-out-notes"
                required
                rows={2}
                maxLength={255}
                value={directOutNotes}
                onChange={(e) => {
                  setDirectOutNotes(e.target.value);
                  if (errorText) setErrorText('');
                }}
                placeholder="Contoh: Hadir pukul 08:00, lupa membuka aplikasi di pagi hari..."
                className="w-full text-xs rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
              />
              <p className="text-[11px] text-slate-500">
                Wajib diisi sebagai klarifikasi bagi HRD yang memverifikasi.
              </p>
            </div>
          )}
        </div>

        {/* Option 2: Late Check In */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedOption('IN')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedOption('IN');
            }
          }}
          className={`cursor-pointer rounded-2xl border p-3.5 transition text-left space-y-2 ${
            selectedOption === 'IN'
              ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  selectedOption === 'IN'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <LogIn className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                  Absen Masuk (Terlambat)
                </h4>
                <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                  Baru Tiba di Kantor
                </span>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                selectedOption === 'IN'
                  ? 'border-emerald-700 bg-emerald-700'
                  : 'border-slate-300 bg-white'
              }`}
            >
              {selectedOption === 'IN' && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-snug pl-11">
            Gunakan opsi ini jika Anda memang baru tiba di lokasi kerja saat ini dan ingin memulai shift kerja Anda.
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
