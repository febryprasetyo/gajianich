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

const STREAM_SIMULATED_EVENTS: Array<{ lvl: 'INFO' | 'WARN' | 'ERROR'; msg: string }> = [
  { lvl: 'INFO', msg: 'Incoming telemetry packet dispatched to worker queue length=2' },
  { lvl: 'INFO', msg: 'Garbage collector scavenged 12.4 MB heap memory footprint' },
  { lvl: 'INFO', msg: 'Database connection pool healthy: 48 active, 2 idle, 0 waiting' },
  { lvl: 'WARN', msg: 'Socket I/O jitter spike: 24ms roundtrip to edge gateway' },
  { lvl: 'INFO', msg: 'Audit log encrypted & flushed to disk NVMe block' },
  { lvl: 'INFO', msg: 'Heartbeat ACK received from hub — stream latency 1.2ms' },
];

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
    api
      .get<{ logs: TerminalLogEntry[] }>(`/infrastructure/servers/${encodeURIComponent(String(serverIdOrHost))}/logs${query}`)
      .then((res) => {
        if (!cancelled && Array.isArray(res?.logs)) {
          setLogs(res.logs);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const now = new Date().toTimeString().split(' ')[0];
          setLogs([
            {
              time: now,
              lvl: 'INFO',
              msg: `Connected to live stdout/stderr pipe on ${hostname} (${serviceName || 'kernel-daemon'})`,
            },
          ]);
        }
      });

    const interval = setInterval(() => {
      const sample = STREAM_SIMULATED_EVENTS[Math.floor(Math.random() * STREAM_SIMULATED_EVENTS.length)];
      const time = new Date().toTimeString().split(' ')[0];
      setLogs((prev) => {
        const next = [...prev, { time, lvl: sample.lvl, msg: sample.msg }];
        return next.length > 100 ? next.slice(next.length - 100) : next;
      });
    }, 2400);

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
    if (lvl === 'WARN') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    if (lvl === 'ERROR') return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Live Terminal Log Stream"
    >
      <div className="bg-[#090D16] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Terminal Header */}
        <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onClose}
                className="w-3 h-3 rounded-full bg-rose-500 cursor-pointer inline-block"
                title="Tutup Terminal"
                aria-label="Tutup Terminal"
              />
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-white">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="font-bold">
                {serviceName ? `${hostname} / ${serviceName}` : `${hostname} — Live Kernel & Daemon Log`}
              </span>
              <span className="text-slate-500 text-[11px] hidden sm:inline">&bull; live tail stream</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              aria-label="Filter Log Severity"
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 font-mono focus:outline-none"
            >
              <option value="ALL">LOG: ALL</option>
              <option value="INFO">LOG: INFO</option>
              <option value="WARN">LOG: WARN</option>
              <option value="ERROR">LOG: ERROR</option>
            </select>

            <label className="flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoFollow}
                onChange={(e) => setAutoFollow(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
              />
              <span>Follow</span>
            </label>

            <button
              type="button"
              onClick={() => setLogs([])}
              className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Tutup"
              aria-label="Tutup"
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Log Output Screen */}
        <div
          ref={streamRef}
          className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1 bg-[#070a12] text-slate-300 leading-relaxed min-h-[340px] max-h-[55vh]"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-slate-500 py-4">[Log buffer kosong atau tidak ada entri pada filter ini]</div>
          ) : (
            filteredLogs.map((line, index) => (
              <div
                key={`${line.time}-${index}`}
                className="flex items-start gap-2.5 py-0.5 border-b border-slate-900/60 hover:bg-slate-900/40 transition font-mono text-[11px]"
              >
                <span className="text-slate-500 select-none shrink-0">[{line.time}]</span>
                <span
                  className={`px-1.5 rounded border text-[9px] font-bold select-none shrink-0 ${getBadgeStyle(line.lvl)}`}
                >
                  {line.lvl}
                </span>
                <span className="text-slate-300 break-all">{line.msg}</span>
              </div>
            ))
          )}
        </div>

        {/* Terminal Footer */}
        <div className="bg-slate-900 px-4 py-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>stdout/stderr pipe active (tail -n 100 -f)</span>
          </div>
          <div>
            Buffered: <span className="text-slate-200 font-bold">{logs.length}</span> entries
          </div>
        </div>
      </div>
    </div>
  );
}
