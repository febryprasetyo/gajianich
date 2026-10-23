'use client';

import React, { useState } from "react";
import ModalShell from "@/components/ui/ModalShell";
import { KeyRound, Copy, Check, ShieldCheck, AlertTriangle } from "lucide-react";

interface TemporaryPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    username: string;
    email: string;
    temporaryPassword: string;
    isReset?: boolean;
  } | null;
}

export default function TemporaryPasswordModal({
  isOpen,
  onClose,
  data,
}: TemporaryPasswordModalProps) {
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback if clipboard API is restricted
      const textArea = document.createElement("textarea");
      textArea.value = data.temporaryPassword;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={data.isReset ? "Password Berhasil Direset" : "Akun Pengguna Berhasil Dibuat"}
      subtitle="Berikan kredensial temporary berikut kepada pengguna"
      icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
      maxWidthClass="max-w-md"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
        >
          Selesai & Tutup
        </button>
      }
    >
      <div className="space-y-4">
        {/* Security Alert */}
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-bold">Password Sekali Pakai (1x):</span> Pengguna wajib langsung membuat password baru saat pertama kali login menggunakan password temporary ini.
          </div>
        </div>

        {/* Credentials Box */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold block mb-0.5">
              Username
            </span>
            <p className="text-xs font-mono font-bold text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200/80">
              {data.username}
            </p>
          </div>

          {data.email && !data.email.endsWith("@ams.internal") && (
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold block mb-0.5">
                Email
              </span>
              <p className="text-xs font-mono text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200/80">
                {data.email}
              </p>
            </div>
          )}

          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold block mb-1">
              Temporary Password
            </span>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3.5 py-2.5 bg-white border-2 border-emerald-200 rounded-xl font-mono text-sm font-bold text-emerald-600 tracking-wider select-all break-all shadow-inner">
                {data.temporaryPassword}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className={`px-3.5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                  copied
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
