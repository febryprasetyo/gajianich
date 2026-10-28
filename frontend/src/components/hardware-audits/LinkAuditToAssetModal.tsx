'use client';

import React, { useState, useEffect } from 'react';
import ModalShell from '@/components/ui/ModalShell';
import { api } from '@/lib/api';
import { HardwareAuditItem, AllAssetOption, isGenericOrPlaceholderSerial } from '@/lib/hardware-audits/types';
import { Link2, Printer, AlertCircle, Loader2 } from 'lucide-react';

interface LinkAuditToAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  audit: HardwareAuditItem | null;
  allAssets: AllAssetOption[];
  onSuccess: (message: string) => void;
}

export default function LinkAuditToAssetModal({
  isOpen,
  onClose,
  audit,
  allAssets,
  onSuccess,
}: LinkAuditToAssetModalProps) {
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [updateSerial, setUpdateSerial] = useState(true);
  const [updateSpecs, setUpdateSpecs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (audit) {
      if (audit.candidateAssets && audit.candidateAssets.length > 0) {
        setSelectedAssetId(audit.candidateAssets[0].id);
      } else {
        setSelectedAssetId(null);
      }
      setUpdateSerial(!isGenericOrPlaceholderSerial(audit.serialNumber));
      setUpdateSpecs(true);
      setError(null);
    }
  }, [audit]);

  if (!isOpen || !audit) return null;

  const handleClose = () => {
    if (!submitting) {
      setError(null);
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!selectedAssetId) {
      setError('Pilih aset terlebih dahulu.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res: any = await api.post(`/hardware-audits/${audit.id}/link`, {
        assetId: selectedAssetId,
        updateSerialNumber: updateSerial,
        updateSpecs: updateSpecs,
      });

      onSuccess(res.message || 'Spesifikasi berhasil ditautkan ke aset!');
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menautkan spesifikasi';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Link2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Tautkan Spesifikasi ke Aset Terdaftar
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Pilih aset di database GAJIANICH untuk diisikan spesifikasi hardware hasil scan ini.
            </p>
          </div>
        </div>
      }
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-5">
        {/* Scanned specs preview pill */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono space-y-1.5">
          <div className="font-bold text-slate-900 flex items-center justify-between">
            <span>
              Perangkat: {[audit.manufacturer, audit.model].filter(Boolean).join(' ') || 'Laptop'}
            </span>
            <span className="text-slate-500 font-normal">
              User: <strong>{audit.custodianName}</strong>
            </span>
          </div>
          <div className="text-slate-600">
            Serial Number:{' '}
            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              {audit.serialNumber || '(Kosong)'}
            </span>
          </div>
          <div className="text-slate-600">
            Spesifikasi: {audit.cpuName} | RAM {audit.ramSizeGb} GB | Disk {audit.disk1SizeGb} GB{' '}
            {audit.disk2SizeGb ? `+ ${audit.disk2SizeGb} GB` : ''}
          </div>
          {audit.peripherals && audit.peripherals.length > 0 && (
            <div className="pt-2 border-t border-slate-200/80 space-y-1">
              <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-emerald-600" />
                <span>Periferal Terkait ({audit.peripherals.length} unit akan ditautkan):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {audit.peripherals.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 bg-white rounded-lg border border-slate-200 text-[11px] flex items-center justify-between"
                  >
                    <span className="font-semibold text-slate-800">
                      {p.category}: {p.brandModel}
                    </span>
                    <span className="text-slate-500 font-mono">
                      {p.serialNumber ? `S/N: ${p.serialNumber}` : '(Tanpa S/N)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Candidate Asset Selector */}
        <div className="space-y-3">
          {/* Kandidat rekomendasi jika ada */}
          {audit.candidateAssets && audit.candidateAssets.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-mono font-bold text-amber-700 uppercase tracking-wider">
                ★ Rekomendasi Aset Milik {audit.custodianName}:
              </p>
              <div className="space-y-2">
                {audit.candidateAssets.map((cand) => (
                  <label
                    key={cand.id}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      selectedAssetId === cand.id
                        ? 'bg-red-50/60 border-red-500 ring-2 ring-red-500/20 text-slate-900 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="selectedAsset"
                        checked={selectedAssetId === cand.id}
                        onChange={() => setSelectedAssetId(cand.id)}
                        className="text-red-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div>
                        <div className="font-bold text-xs font-mono text-slate-900 flex items-center gap-2">
                          <span>{cand.assetCode}</span>
                          <span className="text-slate-500 font-normal">— {cand.name}</span>
                          {!cand.hasComputerSpecs && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                              Belum ada spek
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          Holder: {cand.custodianName || 'Belum ditugaskan'}{' '}
                          {cand.serialNumber ? `(S/N: ${cand.serialNumber})` : '(Tanpa S/N)'}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Atau pilih dari seluruh aset */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider block">
              Pilih Aset dari Database ({allAssets.length} Aset Terdaftar):
            </label>
            <select
              value={selectedAssetId || ''}
              onChange={(e) => setSelectedAssetId(Number(e.target.value) || null)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">-- Pilih Manual dari Seluruh Aset --</option>
              {allAssets.map((asset) => {
                const holder = asset.custodianName || asset.assignedEmployeeName || 'Tanpa Pemegang';
                return (
                  <option key={asset.id} value={asset.id}>
                    {asset.assetCode} - {asset.name} [{holder}] {asset.serialNumber ? `(SN: ${asset.serialNumber})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Sync Options Checkboxes */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono space-y-2">
          <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            Opsi Pembaruan Data:
          </p>
          <label className="flex items-center gap-2.5 text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={updateSpecs}
              onChange={(e) => setUpdateSpecs(e.target.checked)}
              className="rounded text-red-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span>Perbarui Spesifikasi Komputer (CPU, RAM, Storage, Periferal)</span>
          </label>
          <label className="flex items-center gap-2.5 text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={updateSerial}
              onChange={(e) => setUpdateSerial(e.target.checked)}
              className="rounded text-red-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span>
              Perbarui Serial Number Aset ({audit.serialNumber || 'Kosong'})
            </span>
          </label>
          {isGenericOrPlaceholderSerial(audit.serialNumber) && (
            <p className="text-[11px] text-amber-700 pl-6">
              ⚠️ Serial number hasil scan terdeteksi nilai generic/placeholder BIOS. Centang hanya jika Anda yakin ingin menimpanya.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2.5 text-xs font-mono font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedAssetId || submitting}
            className="px-5 py-2.5 text-xs font-mono font-bold bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Tautkan &amp; Perbarui Aset</span>
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
