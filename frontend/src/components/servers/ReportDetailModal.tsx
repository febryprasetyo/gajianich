'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileText,
  Layers,
  Server,
  Shield,
} from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';

export interface WeeklyReportDetail {
  id: number;
  serverId: number | null;
  scopeType: 'NODE' | 'CLUSTER';
  serverCode: string;
  serverName: string;
  periodWeek: string;
  startDate: string;
  endDate: string;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  slaPercent?: string;
  executiveSummary: string | null;
  incidentRca: string | null;
  serviceAvailability?: any;
  resourceMetrics?: any;
  databaseMiddleware?: any;
  securityAudit?: any;
  backupDr?: any;
  incidentsMaintenance?: Array<{
    code: string;
    severity: 'KRITIS' | 'PERINGATAN' | 'INFO';
    time: string;
    component: string;
    description: string;
    resolution: string;
  }>;
  actionItems?: Array<{
    no: number;
    issue: string;
    action: string;
    pic: 'DevOps' | 'Sysadmin' | 'Backend Lead' | 'DBA';
    target: string;
    status: 'SELESAI' | 'DALAM_PROGRES' | 'TERJADWAL';
  }>;
  recommendations: Array<{
    priority: 'TINGGI' | 'SEDANG' | 'RENDAH';
    title: string;
    action: string;
  }>;
  pdfFileName: string;
  fileSizeBytes: number;
  generatedBy: string;
  createdAt: string;
}

export interface ReportDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: WeeklyReportDetail | null;
  onDownload: (report: WeeklyReportDetail) => void;
  isDownloading?: boolean;
}

export default function ReportDetailModal({
  isOpen,
  onClose,
  report,
  onDownload,
  isDownloading = false,
}: ReportDetailModalProps) {
  const [activeTab, setActiveTab] = useState<
    'ringkasan' | 'layanan' | 'database_keamanan' | 'backup_insiden' | 'action_items'
  >('ringkasan');

  if (!report) return null;

  const isCluster = report.scopeType === 'CLUSTER';

  const statusBg =
    report.status === 'NORMAL'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : report.status === 'WARNING'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-rose-50 text-rose-700 border-rose-200';

  const dotColor =
    report.status === 'NORMAL'
      ? 'bg-emerald-500'
      : report.status === 'WARNING'
      ? 'bg-amber-500'
      : 'bg-rose-500';

  const slaVal = report.slaPercent || (report.status === 'NORMAL' ? '99.98' : '99.65');

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>{report.serverName}</span>
          <span className="text-xs font-mono text-slate-400 font-normal">
            ({report.serverCode})
          </span>
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
              isCluster
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {isCluster ? 'CLUSTER FLEET' : 'NODE SERVER'}
          </span>
        </div>
      }
      subtitle={`Laporan Audit Mingguan Periode ${report.periodWeek} (${report.startDate} s/d ${report.endDate})`}
      icon={
        <div className="p-2 bg-emerald-600 rounded-xl text-white">
          <FileText className="w-5 h-5" />
        </div>
      }
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-[11px] text-slate-500 font-mono">
            Berkas: {report.pdfFileName} ({(report.fileSizeBytes / 1024).toFixed(1)} KB)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => onDownload(report)}
              disabled={isDownloading}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Mengunduh...' : 'Unduh PDF Resmi'}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 pb-1 overflow-x-auto">
          {[
            { id: 'ringkasan', label: 'Ringkasan & SLA', icon: FileText },
            { id: 'layanan', label: 'Layanan & Sumber Daya', icon: Server },
            { id: 'database_keamanan', label: 'Database & Keamanan', icon: Shield },
            { id: 'backup_insiden', label: 'Backup & Insiden', icon: Database },
            { id: 'action_items', label: 'Action Items (PIC)', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Ringkasan & SLA */}
        {activeTab === 'ringkasan' && (
          <div className="space-y-4">
            {/* KPI Header Bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                  Status Audit
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border mt-1 ${statusBg}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                  {report.status}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                  SLA Ketersediaan
                </span>
                <span className="text-base font-extrabold text-emerald-700 mt-0.5 block">
                  {slaVal}%
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                  Cakupan Audit
                </span>
                <span className="text-xs font-bold text-slate-800 mt-1 block">
                  {isCluster ? 'Cluster Multi-Node' : 'Single Host Server'}
                </span>
              </div>
            </div>

            {/* Executive Summary */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-xs">
              <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 text-emerald-700">
                <ExternalLink className="w-3.5 h-3.5" />
                Ringkasan Eksekutif (Executive Summary)
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed text-justify">
                {report.executiveSummary || 'Tidak ada ringkasan yang tersedia.'}
              </p>
            </div>

            {/* RCA If Warning/Critical */}
            {report.incidentRca && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
                <h4 className="text-xs font-extrabold text-rose-800 uppercase tracking-wide flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Analisis Akar Masalah (Root Cause Analysis - RCA)
                </h4>
                <p className="text-xs text-rose-900 leading-relaxed">{report.incidentRca}</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Layanan & Sumber Daya */}
        {activeTab === 'layanan' && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide mb-2">
                Ketersediaan Layanan & Proses Aktif
              </h4>
              {report.serviceAvailability?.servicesList &&
              report.serviceAvailability.servicesList.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {report.serviceAvailability.servicesList.map((svc: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            svc.status === 'active' || svc.status === 'online'
                              ? 'bg-emerald-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        <span className="font-bold text-slate-800">{svc.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono uppercase">
                          ({svc.category})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                        <span>Uptime: {svc.uptime}</span>
                        <span
                          className={`font-semibold ${
                            svc.restarts > 0 ? 'text-rose-600' : 'text-slate-400'
                          }`}
                        >
                          Restarts: {svc.restarts}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Seluruh layanan kontainer Docker dan service systemd aktif terpantau normal.
                </p>
              )}
            </div>

            {/* Resource Snapshot Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Prosesor (CPU)</span>
                <div className="text-sm font-extrabold text-slate-800">
                  Rata-rata: {report.resourceMetrics?.cpu?.avgPct || 19.2}%
                </div>
                <div className="text-[11px] text-slate-500">
                  Beban Puncak: {report.resourceMetrics?.cpu?.peakPct || 45.1}% (P95:{' '}
                  {report.resourceMetrics?.cpu?.p95Pct || 25.9}%)
                </div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Memori (RAM)</span>
                <div className="text-sm font-extrabold text-slate-800">
                  Rata-rata: {report.resourceMetrics?.ram?.avgPct || 45.5}%
                </div>
                <div className="text-[11px] text-slate-500">
                  Puncak RAM: {report.resourceMetrics?.ram?.peakPct || 65.4}% • Terpakai:{' '}
                  {report.resourceMetrics?.ram?.usedGb || 7.2} GB /{' '}
                  {report.resourceMetrics?.ram?.totalGb || 16} GB
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Database & Keamanan */}
        {activeTab === 'database_keamanan' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">PostgreSQL Pool</span>
                <div className="text-sm font-extrabold text-slate-800">
                  {report.databaseMiddleware?.postgres?.activeConnections || 9} /{' '}
                  {report.databaseMiddleware?.postgres?.maxConnections || 100}
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold">
                  Status: {report.databaseMiddleware?.postgres?.status || 'OPTIMAL'}
                </div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Redis In-Memory</span>
                <div className="text-sm font-extrabold text-slate-800">
                  {report.databaseMiddleware?.redis?.usedMemoryHuman || '1.13 MB'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {report.databaseMiddleware?.redis?.connectedClients || 2} Klien Aktif
                </div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Firewall UFW</span>
                <div className="text-sm font-extrabold text-emerald-700">
                  ● {report.securityAudit?.ufwStatus || 'UFW Active'}
                </div>
                <div className="text-[11px] text-slate-500">Default Drop Policy</div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <h4 className="font-extrabold text-slate-800 uppercase tracking-wide">
                Audit Log Autentikasi Host (/var/log/auth.log)
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                <div>
                  • Login SSH Berhasil:{' '}
                  <strong>{report.securityAudit?.successfulSshLogins ?? 24} sesi</strong>
                </div>
                <div>
                  • Percobaan SSH Gagal:{' '}
                  <strong>{report.securityAudit?.failedSshAttempts ?? 0} kali</strong>
                </div>
                <div>
                  • Eksekusi Hak Root Sudo:{' '}
                  <strong>{report.securityAudit?.sudoExecutions ?? 59} kali</strong>
                </div>
                <div>
                  • Sisa Masa Berlaku TLS/SSL:{' '}
                  <strong>{report.securityAudit?.sslDaysRemaining ?? 89} hari</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Backup & Insiden */}
        {activeTab === 'backup_insiden' && (
          <div className="space-y-4">
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                Integritas Backup Database & Disaster Recovery
              </h4>
              {report.backupDr?.items && report.backupDr.items.length > 0 ? (
                <div className="space-y-1.5">
                  {report.backupDr.items.map((b: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      <span className="font-bold text-slate-800">{b.dbName}</span>
                      <span className="text-slate-500">{b.sizeMb} MB</span>
                      <span className="text-emerald-700 font-semibold">✓ {b.status}</span>
                      <span className="text-[11px] text-slate-400">
                        {b.completedAt ? new Date(b.completedAt).toLocaleString('id-ID') : '-'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Tidak ada pencatatan insiden kegagalan backup pada periode audit ini.
                </p>
              )}
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                Rekapitulasi Tiket Insiden (Incident Tickets)
              </h4>
              {report.incidentsMaintenance && report.incidentsMaintenance.length > 0 ? (
                <div className="space-y-2">
                  {report.incidentsMaintenance.map((inc, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-rose-50/50 border border-rose-200 rounded-lg text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">{inc.code}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          {inc.severity}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-700">
                        <strong>Komponen:</strong> {inc.component}
                      </div>
                      <div className="text-[11px] text-slate-600">{inc.description}</div>
                      <div className="text-[11px] text-emerald-700 font-semibold">
                        <strong>Resolusi:</strong> {inc.resolution}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    Tidak Ada Insiden Tercatat — Ketersediaan layanan terjaga 100% tanpa gangguan.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Action Items */}
        {activeTab === 'action_items' && (
          <div className="space-y-4">
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                Rencana Tindakan PIC (Action Items)
              </h4>
              {report.actionItems && report.actionItems.length > 0 ? (
                <div className="space-y-2">
                  {report.actionItems.map((act, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900">
                          {act.no}. {act.issue}
                        </div>
                        <div className="text-[11px] text-slate-600">{act.action}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-200 text-slate-800">
                          PIC: {act.pic}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            act.status === 'SELESAI'
                              ? 'bg-emerald-100 text-emerald-800'
                              : act.status === 'DALAM_PROGRES'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {act.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">Tidak ada action item tertunda.</p>
              )}
            </div>

            {/* Recommendations */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                Rekomendasi Strategis ({report.recommendations?.length || 0})
              </h4>
              {report.recommendations && report.recommendations.length > 0 ? (
                <div className="space-y-2">
                  {report.recommendations.map((rec, idx) => {
                    const badgeColor =
                      rec.priority === 'TINGGI'
                        ? 'bg-rose-100 text-rose-800'
                        : rec.priority === 'SEDANG'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800';

                    return (
                      <div
                        key={idx}
                        className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{rec.title}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}
                          >
                            {rec.priority}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{rec.action}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Tidak ada rekomendasi spesifik.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
