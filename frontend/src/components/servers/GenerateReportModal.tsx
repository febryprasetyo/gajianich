'use client';

import React, { useState } from 'react';
import { FileText, Info, Layers, Loader2, Play, Server } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { api } from '@/lib/api';

export interface ServerOption {
  id: number;
  serverCode: string;
  name: string;
}

export interface GenerateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  servers: ServerOption[];
  onSuccess: () => void;
}

export default function GenerateReportModal({
  isOpen,
  onClose,
  servers,
  onSuccess,
}: GenerateReportModalProps) {
  const [scope, setScope] = useState<'NODE' | 'CLUSTER'>('NODE');
  const [selectedServerId, setSelectedServerId] = useState<string>(
    servers[0]?.id ? String(servers[0].id) : ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload =
        scope === 'CLUSTER'
          ? { scope: 'CLUSTER' }
          : { scope: 'NODE', serverId: selectedServerId ? Number(selectedServerId) : undefined };

      await api.post('/infrastructure/reports/generate', payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal memulai audit laporan mingguan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Audit Infrastruktur Mingguan (On-Demand)"
      subtitle="Jalankan agregasi telemetri 7 hari & pembuatan PDF resmi via background worker"
      icon={
        <div className="p-2 bg-emerald-600 rounded-xl text-white">
          <FileText className="w-5 h-5" />
        </div>
      }
      maxWidthClass="max-w-md"
      isLoading={loading}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Audit Sekarang</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-white border border-slate-200 border-l-4 border-l-rose-600 rounded-xl text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}

        {/* Scope Selector */}
        <div>
          <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Pilih Cakupan Audit (Scope)
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setScope('NODE')}
              aria-pressed={scope === 'NODE'}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 bg-white ${
                scope === 'NODE'
                  ? 'border-emerald-600 ring-2 ring-emerald-500/15 text-slate-900'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-900">
                <Server
                  className={`w-3.5 h-3.5 ${
                    scope === 'NODE' ? 'text-emerald-600' : 'text-slate-500'
                  }`}
                />
                <span>Node Tunggal</span>
              </div>
              <span className="text-[11px] text-slate-500">Audit mendalam per server host</span>
            </button>

            <button
              type="button"
              onClick={() => setScope('CLUSTER')}
              aria-pressed={scope === 'CLUSTER'}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 bg-white ${
                scope === 'CLUSTER'
                  ? 'border-emerald-600 ring-2 ring-emerald-500/15 text-slate-900'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-900">
                <Layers
                  className={`w-3.5 h-3.5 ${
                    scope === 'CLUSTER' ? 'text-emerald-600' : 'text-slate-500'
                  }`}
                />
                <span>Cluster Fleet</span>
              </div>
              <span className="text-[11px] text-slate-500">Konsolidasi seluruh armada server</span>
            </button>
          </div>
        </div>

        {/* Server Selector for Node Mode */}
        {scope === 'NODE' && (
          <div>
            <label
              htmlFor="target-server-select"
              className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
            >
              Pilih Target Server
            </label>
            <select
              id="target-server-select"
              value={selectedServerId}
              onChange={(e) => setSelectedServerId(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.serverCode})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Informasi Proses</span>
          </p>
          <p className="leading-relaxed">
            Proses berjalan <em>non-blocking</em> di latar belakang. Berkas PDF formal (format
            Sophos Enterprise) akan otomatis selesai dalam ~3-5 detik dan muncul pada tabel riwayat.
          </p>
        </div>
      </form>
    </ModalShell>
  );
}
