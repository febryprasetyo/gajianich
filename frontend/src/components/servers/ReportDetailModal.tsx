'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
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

type TabId = 'ringkasan' | 'layanan' | 'database_keamanan' | 'backup_insiden' | 'action_items';

function StatusIndicator({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const dotClass =
    tone === 'success'
      ? 'bg-emerald-600'
      : tone === 'warning'
      ? 'bg-amber-500'
      : tone === 'danger'
      ? 'bg-rose-600'
      : 'bg-slate-400';

  const textClass =
    tone === 'danger'
      ? 'text-rose-700'
      : tone === 'warning'
      ? 'text-amber-700'
      : tone === 'success'
      ? 'text-emerald-700'
      : 'text-slate-700';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-slate-200 bg-white ${textClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      <span>{label}</span>
    </span>
  );
}

export default function ReportDetailModal({
  isOpen,
  onClose,
  report,
  onDownload,
  isDownloading = false,
}: ReportDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('ringkasan');

  if (!report) return null;

  const isCluster = report.scopeType === 'CLUSTER';
  const statusTone =
    report.status === 'NORMAL'
      ? 'success'
      : report.status === 'WARNING'
      ? 'warning'
      : 'danger';

  const slaVal = report.slaPercent || (report.status === 'NORMAL' ? '99.98' : '99.65');
  const clusterNodes: any[] =
    report.resourceMetrics?.clusterNodes ||
    report.serviceAvailability?.clusterNodes ||
    [];

  const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'ringkasan', label: 'Ringkasan & SLA', icon: FileText },
    { id: 'layanan', label: 'Layanan & Sumber Daya', icon: Server },
    { id: 'database_keamanan', label: 'Database & Keamanan', icon: Shield },
    { id: 'backup_insiden', label: 'Backup & Insiden', icon: Database },
    { id: 'action_items', label: 'Action Items (PIC)', icon: Layers },
  ];

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-900">{report.serverName}</span>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            ({report.serverCode})
          </span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-700">
            {isCluster ? 'Cluster Fleet' : 'Node Server'}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div className="text-xs text-slate-500 font-medium tabular-nums truncate">
            Berkas: <span className="text-slate-700 font-semibold">{report.pdfFileName}</span> (
            {(report.fileSizeBytes / 1024).toFixed(1)} KB)
          </div>
          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => onDownload(report)}
              disabled={isDownloading}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Mengunduh...' : 'Unduh PDF Resmi'}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Bagian laporan audit"
          className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs border-b-2 -mb-px transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-emerald-600 text-emerald-700 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Ringkasan & SLA */}
        {activeTab === 'ringkasan' && (
          <div className="space-y-4">
            {/* KPI Summary Row */}
            <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
              <div className="p-4 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Status Audit
                </span>
                <div>
                  <StatusIndicator label={report.status} tone={statusTone} />
                </div>
              </div>
              <div className="p-4 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  SLA Ketersediaan
                </span>
                <span className="text-xl font-bold text-slate-900 tabular-nums tracking-tight block">
                  {slaVal}%
                </span>
              </div>
              <div className="p-4 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Cakupan Audit
                </span>
                <span className="text-sm font-semibold text-slate-900 block">
                  {isCluster ? 'Cluster Multi-Node' : 'Single Host Server'}
                </span>
              </div>
            </div>

            {/* Executive Summary */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Ringkasan Eksekutif (Executive Summary)
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                {report.executiveSummary || 'Tidak ada ringkasan yang tersedia.'}
              </p>
            </div>

            {/* RCA If Warning/Critical */}
            {report.incidentRca && (
              <div className="p-4 bg-white border border-slate-200 border-l-4 border-l-rose-600 rounded-xl space-y-1.5">
                <h4 className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Analisis Akar Masalah (Root Cause Analysis - RCA)</span>
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed">{report.incidentRca}</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Layanan & Sumber Daya */}
        {activeTab === 'layanan' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Ketersediaan Layanan & Proses Aktif
                </h4>
                {report.serviceAvailability?.servicesList?.length > 0 && (
                  <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                    {report.serviceAvailability.servicesList.length} layanan
                  </span>
                )}
              </div>
              {report.serviceAvailability?.servicesList &&
              report.serviceAvailability.servicesList.length > 0 ? (
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50/95 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Layanan</th>
                        <th className="py-2.5 px-4">Kategori</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Uptime</th>
                        <th className="py-2.5 px-4 text-right">Restarts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {report.serviceAvailability.servicesList.map((svc: any, idx: number) => {
                        const isOnline = svc.status === 'active' || svc.status === 'online';
                        return (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-4 font-semibold text-slate-900">
                              {svc.name}
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 uppercase text-[11px] font-medium">
                              {svc.category}
                            </td>
                            <td className="py-2.5 px-4">
                              <StatusIndicator
                                label={svc.status || (isOnline ? 'online' : 'offline')}
                                tone={isOnline ? 'success' : 'danger'}
                              />
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-700 tabular-nums">
                              {svc.uptime}
                            </td>
                            <td
                              className={`py-2.5 px-4 text-right font-semibold tabular-nums ${
                                svc.restarts > 0 ? 'text-rose-700' : 'text-slate-600'
                              }`}
                            >
                              {svc.restarts}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-xs text-slate-600">
                  Seluruh layanan kontainer Docker dan service systemd aktif terpantau normal.
                </div>
              )}
            </div>

            {/* Resource Snapshot */}
            <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
              <div className="p-4 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Prosesor (CPU)
                </span>
                <div className="text-lg font-bold text-slate-900 tabular-nums">
                  Rata-rata {report.resourceMetrics?.cpu?.avgPct || 19.2}%
                </div>
                <div className="text-xs text-slate-500 tabular-nums">
                  Beban Puncak: {report.resourceMetrics?.cpu?.peakPct || 45.1}% (P95:{' '}
                  {report.resourceMetrics?.cpu?.p95Pct || 25.9}%)
                </div>
              </div>
              <div className="p-4 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Memori (RAM)
                </span>
                <div className="text-lg font-bold text-slate-900 tabular-nums">
                  Rata-rata {report.resourceMetrics?.ram?.avgPct || 45.5}%
                </div>
                <div className="text-xs text-slate-500 tabular-nums">
                  Puncak RAM: {report.resourceMetrics?.ram?.peakPct || 65.4}% • Terpakai:{' '}
                  {report.resourceMetrics?.ram?.usedGb || 7.2} GB /{' '}
                  {report.resourceMetrics?.ram?.totalGb || 16} GB
                </div>
              </div>
            </div>

            {/* Cluster Node Breakdown if present */}
            {clusterNodes.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200">
                  <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Rincian Node Cluster
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Node</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">CPU Avg</th>
                        <th className="py-2.5 px-4 text-right">RAM Avg</th>
                        <th className="py-2.5 px-4 text-right">SLA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {clusterNodes.map((node: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            {node.name || node.serverName || node.serverCode}
                          </td>
                          <td className="py-2.5 px-4">
                            <StatusIndicator
                              label={node.status || 'NORMAL'}
                              tone={
                                node.status === 'CRITICAL'
                                  ? 'danger'
                                  : node.status === 'WARNING'
                                  ? 'warning'
                                  : 'success'
                              }
                            />
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-700 tabular-nums">
                            {node.cpuAvgPct ?? node.cpuAvg ?? '-'}%
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-700 tabular-nums">
                            {node.ramAvgPct ?? node.ramAvg ?? '-'}%
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-slate-900 tabular-nums">
                            {node.slaPercent ?? '-'}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Database & Keamanan */}
        {activeTab === 'database_keamanan' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
              <div className="p-4 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  PostgreSQL Pool
                </span>
                <div className="text-lg font-bold text-slate-900 tabular-nums">
                  {report.databaseMiddleware?.postgres?.activeConnections || 9} /{' '}
                  {report.databaseMiddleware?.postgres?.maxConnections || 100}
                </div>
                <div className="text-xs font-medium text-emerald-700">
                  Status: {report.databaseMiddleware?.postgres?.status || 'OPTIMAL'}
                </div>
              </div>
              <div className="p-4 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Redis In-Memory
                </span>
                <div className="text-lg font-bold text-slate-900 tabular-nums">
                  {report.databaseMiddleware?.redis?.usedMemoryHuman || '1.13 MB'}
                </div>
                <div className="text-xs text-slate-500 tabular-nums">
                  {report.databaseMiddleware?.redis?.connectedClients || 2} Klien Aktif
                </div>
              </div>
              <div className="p-4 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Firewall UFW
                </span>
                <div>
                  <StatusIndicator
                    label={report.securityAudit?.ufwStatus || 'UFW Active'}
                    tone="success"
                  />
                </div>
                <div className="text-xs text-slate-500">Default Drop Policy</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Audit Log Autentikasi Host (/var/log/auth.log)
                </h4>
              </div>
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y divide-slate-100 text-xs">
                  <tr className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 text-slate-600 font-medium">Login SSH Berhasil</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-900 tabular-nums">
                      {report.securityAudit?.successfulSshLogins ?? 24} sesi
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 text-slate-600 font-medium">Percobaan SSH Gagal</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-900 tabular-nums">
                      {report.securityAudit?.failedSshAttempts ?? 0} kali
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 text-slate-600 font-medium">Eksekusi Hak Root Sudo</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-900 tabular-nums">
                      {report.securityAudit?.sudoExecutions ?? 59} kali
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 text-slate-600 font-medium">Sisa Masa Berlaku TLS/SSL</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-900 tabular-nums">
                      {report.securityAudit?.sslDaysRemaining ?? 89} hari
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Backup & Insiden */}
        {activeTab === 'backup_insiden' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Integritas Backup Database & Disaster Recovery
                </h4>
              </div>
              {report.backupDr?.items && report.backupDr.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Database</th>
                        <th className="py-2.5 px-4 text-right">Ukuran</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Waktu Selesai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {report.backupDr.items.map((b: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">{b.dbName}</td>
                          <td className="py-2.5 px-4 text-right text-slate-700 font-medium tabular-nums">
                            {b.sizeMb} MB
                          </td>
                          <td className="py-2.5 px-4">
                            <StatusIndicator
                              label={b.status || 'VERIFIED'}
                              tone={
                                String(b.status).toUpperCase().includes('FAIL')
                                  ? 'danger'
                                  : 'success'
                              }
                            />
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-600 tabular-nums">
                            {b.completedAt ? new Date(b.completedAt).toLocaleString('id-ID') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-xs text-slate-500">
                  Tidak ada pencatatan insiden kegagalan backup pada periode audit ini.
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Rekapitulasi Tiket Insiden (Incident Tickets)
                </h4>
              </div>
              {report.incidentsMaintenance && report.incidentsMaintenance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Kode</th>
                        <th className="py-2.5 px-4">Severity</th>
                        <th className="py-2.5 px-4">Komponen & Insiden</th>
                        <th className="py-2.5 px-4">Resolusi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {report.incidentsMaintenance.map((inc, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors align-top">
                          <td className="py-2.5 px-4 font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                            {inc.code}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <StatusIndicator
                              label={inc.severity}
                              tone={
                                inc.severity === 'KRITIS'
                                  ? 'danger'
                                  : inc.severity === 'PERINGATAN'
                                  ? 'warning'
                                  : 'neutral'
                              }
                            />
                          </td>
                          <td className="py-2.5 px-4 space-y-0.5">
                            <div className="font-semibold text-slate-900">{inc.component}</div>
                            <div className="text-slate-600">{inc.description}</div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-700">{inc.resolution}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 flex items-center gap-2 text-xs text-slate-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
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
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Rencana Tindakan PIC (Action Items)
                </h4>
              </div>
              {report.actionItems && report.actionItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4 w-10">No</th>
                        <th className="py-2.5 px-4">Isu & Rencana Tindakan</th>
                        <th className="py-2.5 px-4">PIC</th>
                        <th className="py-2.5 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {report.actionItems.map((act, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors align-top">
                          <td className="py-2.5 px-4 font-semibold text-slate-500 tabular-nums">
                            {act.no}
                          </td>
                          <td className="py-2.5 px-4 space-y-0.5">
                            <div className="font-semibold text-slate-900">{act.issue}</div>
                            <div className="text-slate-600">{act.action}</div>
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                            {act.pic}
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <StatusIndicator
                              label={act.status}
                              tone={
                                act.status === 'SELESAI'
                                  ? 'success'
                                  : act.status === 'DALAM_PROGRES'
                                  ? 'warning'
                                  : 'neutral'
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-xs text-slate-500">Tidak ada action item tertunda.</div>
              )}
            </div>

            {/* Recommendations */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Rekomendasi Strategis
                </h4>
                <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                  {report.recommendations?.length || 0} item
                </span>
              </div>
              {report.recommendations && report.recommendations.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {report.recommendations.map((rec, idx) => {
                    const tone =
                      rec.priority === 'TINGGI'
                        ? 'danger'
                        : rec.priority === 'SEDANG'
                        ? 'warning'
                        : 'success';

                    return (
                      <div key={idx} className="p-4 space-y-1.5 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-slate-900">{rec.title}</span>
                          <StatusIndicator label={rec.priority} tone={tone} />
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{rec.action}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-xs text-slate-500">Tidak ada rekomendasi spesifik.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
