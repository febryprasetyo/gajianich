'use client';

import React, { useEffect } from 'react';
import { LogOut } from 'lucide-react';

interface LogoutSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function LogoutSheet({ isOpen, onClose, onConfirm }: LogoutSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Konfirmasi keluar akun"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xl w-full space-y-4 text-center max-w-sm sm:max-w-[360px] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <LogOut className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-extrabold text-slate-900">Keluar dari Akun GAJIANICH?</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Apakah Anda yakin ingin mengakhiri sesi akun pada perangkat ini? Anda perlu login kembali untuk mengakses data.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition active:scale-95"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[46px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm transition active:scale-95"
          >
            Ya, Keluar
          </button>
        </div>
      </div>
    </div>
  );
}
