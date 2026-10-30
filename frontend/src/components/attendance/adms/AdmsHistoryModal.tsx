'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Download } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { apiFetch } from '@/lib/api';
import {
  validateAdmsHistoryRequest,
  withMonitorDeadline,
  type AdmsMonitorDevice,
} from '@/lib/attendance/admsMonitor';

interface AdmsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (feedback: string) => void;
  devices: AdmsMonitorDevice[];
  selectedGroupId: number | null;
  revision?: number;
}

const selectClass =
  'min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

export default function AdmsHistoryModal({
  isOpen,
  onClose,
  onSuccess,
  devices,
  selectedGroupId,
  revision = 0,
}: AdmsHistoryModalProps) {
  const [historyDevice, setHistoryDevice] = useState('');
  const [historyStart, setHistoryStart] = useState('');
  const [historyEnd, setHistoryEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), [revision]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setHistoryDevice(devices.find(d => d.serial)?.id ? String(devices.find(d => d.serial)!.id) : '');
      const today = new Date().toISOString().slice(0, 10);
      setHistoryStart(today);
      setHistoryEnd(today);
    }
  }, [isOpen, devices]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || requestRef.current) return;

    const validation = validateAdmsHistoryRequest(selectedGroupId, historyDevice, historyStart, historyEnd);
    if (validation) {
      setError(validation);
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setSubmitting(true);
    setError(null);

    try {
      const result = await withMonitorDeadline(
        signal =>
          apiFetch<{
            success: boolean;
            data: { id: string; status: string; createdAt: string; expiresAt: string; message: string };
          }>(`/attendance/devices/adms/${historyDevice}/history`, {
            method: 'POST',
            signal,
            body: JSON.stringify({ startDate: historyStart, endDate: historyEnd }),
          }),
        controller.signal
      );

      if (!result.success || !result.data) {
        throw new Error('Permintaan belum dapat dikonfirmasi oleh server.');
      }

      if (!controller.signal.aborted) {
        onSuccess(`${result.data.message} ID Permintaan: ${result.data.id}.`);
        onClose();
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setError(
          err instanceof Error && err.name !== 'TimeoutError'
            ? err.message
            : 'Permintaan baca log belum dapat dikonfirmasi. Periksa status antrian sebelum mencoba kembali.'
        );
      }
    } finally {
      if (!controller.signal.aborted) setSubmitting(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      isLoading={submitting}
      title="Minta Log Historis ADMS"
      subtitle="Kirim perintah baca data absensi lama dari mesin fisik (maksimal 31 hari)"
      icon={<Download className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
      footer={
        <>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            form="adms-history-form"
            disabled={submitting || selectedGroupId === null}
            className="min-h-10 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Mengirim…' : 'Kirim Permintaan'}
          </button>
        </>
      }
    >
      <form id="adms-history-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
        <label className="block space-y-1 font-medium text-slate-700">
          <span>Pilih Mesin ADMS</span>
          <select
            required
            disabled={submitting}
            className={selectClass}
            value={historyDevice}
            onChange={event => {
              setHistoryDevice(event.target.value);
              setError(null);
            }}
          >
            <option value="">-- Pilih Mesin Berdasarkan Nomor Seri --</option>
            {devices
              .filter(device => device.serial)
              .map(device => (
                <option key={device.id} value={device.id}>
                  {device.name} · SN: {device.serial}
                </option>
              ))}
          </select>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1 font-medium text-slate-700">
            <span>Tanggal Mulai</span>
            <input
              required
              disabled={submitting}
              className={`${selectClass} cursor-pointer`}
              type="date"
              value={historyStart}
              max={historyEnd || undefined}
              onClick={e => {
                try {
                  e.currentTarget.showPicker?.();
                } catch {}
              }}
              onChange={event => {
                setHistoryStart(event.target.value);
                setError(null);
              }}
            />
          </label>
          <label className="block space-y-1 font-medium text-slate-700">
            <span>Tanggal Akhir</span>
            <input
              required
              disabled={submitting}
              className={`${selectClass} cursor-pointer`}
              type="date"
              value={historyEnd}
              min={historyStart || undefined}
              onClick={e => {
                try {
                  e.currentTarget.showPicker?.();
                } catch {}
              }}
              onChange={event => {
                setHistoryEnd(event.target.value);
                setError(null);
              }}
            />
          </label>
        </div>

        <p className="text-[11px] text-slate-500">
          Rentang maksimal 31 hari. Mesin yang online akan membalas dan mengirimkan salinan log yang diminta secara otomatis.
        </p>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {error}
          </p>
        )}
      </form>
    </ModalShell>
  );
}
