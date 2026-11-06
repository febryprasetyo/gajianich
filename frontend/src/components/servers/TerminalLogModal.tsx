'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal, X } from 'lucide-react';
import { api } from '@/lib/api';
import { TerminalLogEntry } from '@/types/serverMonitoring';

interface TerminalLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverIdOrHost: string | number;
  hostname: string;
  serviceName?: string;
}

export default function TerminalLogModal({
  isOpen,
  onClose,
  serverIdOrHost,
  hostname,
  serviceName,
}: TerminalLogModalProps) {
  const [logs, setLogs] = useState<TerminalLogEntry[]>([]);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [autoFollow, setAutoFollow] = useState(true);
  const streamRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const query = serviceName ? `?service=${encodeURIComponent(serviceName)}` : '';
    const fetchLiveLogs = () => {
      api
        .get<{ logs: TerminalLogEntry[] }>(
          `/infrastructure/servers/${encodeURIComponent(String(serverIdOrHost))}/logs${query}`,
        )
        .then((res) => {
          if (!cancelled && Array.isArray(res?.logs)) {
            setLogs(res.logs);
          }
        })
        .catch(() => {
          // Keep existing logs on transient network error
        });
    };

    fetchLiveLogs();
    const interval = setInterval(fetchLiveLogs, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOpen, serverIdOrHost, hostname, serviceName]);

  useEffect(() => {
    if (autoFollow && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [logs, severityFilter, autoFollow]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((entry) => severityFilter === 'ALL' || entry.lvl === severityFilter);

  const getBadgeStyle = (lvl: 'INFO' | 'WARN' | 'ERROR') => {
    if (lvl === 'WARN') return 'text-amber-800 bg-amber-50 border-amber-200';
    if (lvl === 'ERROR') return 'text-rose-700 bg-rose-50 border-rose-200 font-semibold';
    return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Live Terminal Log Stream"
    >
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Terminal Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onClose}
                className="w-3 h-3 rounded-full bg-rose-400 hover:bg-rose-500 transition-colors cursor-pointer inline-block"
                title="Tutup Terminal"
                aria-label="Tutup Terminal"
              />
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-slate-800">
              <Terminal className="w-4 h-4 text-emerald-600" />
              <span className="font-bold">
                {serviceName ? `${hostname} / ${serviceName}` : `${hostname} — Live Kernel & Daemon Log`}
              </span>
              <span className="text-slate-400 text-[11px] hidden sm:inline">&bull; live tail stream</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              aria-label="Filter Log Severity"
              className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-1 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="ALL">LOG: ALL</option>
              <option value="INFO">LOG: INFO</option>
              <option value="WARN">LOG: WARN</option>
              <option value="ERROR">LOG: ERROR</option>
            </select>

            <label className="flex items-center gap-1.5 text-xs font-mono text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoFollow}
                onChange={(e) => setAutoFollow(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-0"
              />
              <span>Follow</span>
            </label>

            <button
              type="button"
              onClick={() => setLogs([])}
              className="text-xs font-mono px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Tutup"
              aria-label="Tutup"
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Log Output Screen */}
        <div
          ref={streamRef}
          className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1 bg-slate-50/70 text-slate-800 leading-relaxed min-h-[340px] max-h-[55vh]"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-slate-400 py-8 text-center italic">[Menunggu stream log dari agent {hostname}...]</div>
          ) : (
            filteredLogs.map((line, index) => (
              <div
                key={`${line.time}-${index}`}
                className="flex items-start gap-2.5 py-1 px-1.5 rounded-lg border-b border-slate-100/80 hover:bg-white transition font-mono text-[11px]"
              >
                <span className="text-slate-400 select-none shrink-0 font-medium">[{line.time}]</span>
                <span
                  className={`px-1.5 rounded border text-[9px] font-bold select-none shrink-0 ${getBadgeStyle(line.lvl)}`}
                >
                  {line.lvl}
                </span>
                <span
                  className={`break-all ${
                    line.lvl === 'ERROR'
                      ? 'text-rose-800 font-medium'
                      : line.lvl === 'WARN'
                        ? 'text-amber-900'
                        : 'text-slate-800'
                  }`}
                >
                  {line.msg}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Terminal Footer */}
        <div className="bg-white px-4 py-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>stdout/stderr real-time agent stream ({hostname})</span>
          </div>
          <div>
            Buffered: <span className="text-slate-800 font-bold">{logs.length}</span> entries
          </div>
        </div>
      </div>
    </div>
  );
}
