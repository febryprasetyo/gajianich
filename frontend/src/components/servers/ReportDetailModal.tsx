'use client';

import React from 'react';
import { Download, ExternalLink, FileText } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';

export interface WeeklyReportDetail {
  id: number;
  serverId: number;
  serverCode: string;
  serverName: string;
  periodWeek: string;
  startDate: string;
  endDate: string;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  executiveSummary: string | null;
  incidentRca: string | null;
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
  if (!report) return null;

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
        </div>
      }
      subtitle={`Laporan Audit Mingguan Periode ${report.periodWeek} (${report.startDate} s/d ${report.endDate})`}
      icon={
        <div className="p-2 bg-emerald-600 rounded-xl text-white">
          <FileText className="w-5 h-5" />
        </div>
      }
      maxWidthClass="max-w-2xl"
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
        {/* Status Pill & Metadata */}
        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Status Audit:</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
              {report.status}
            </span>
          </div>
          <div className="text-xs text-slate-500">
            Diterbitkan: <span className="font-semibold text-slate-700">{new Date(report.createdAt).toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-xs">
          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 text-emerald-700">
            <ExternalLink className="w-3.5 h-3.5" />
            Ringkasan Eksekutif (AI Summary)
          </h4>
          <p className="text-xs text-slate-700 leading-relaxed text-justify">
            {report.executiveSummary || 'Tidak ada ringkasan yang tersedia.'}
          </p>
        </div>

        {/* RCA If Warning/Critical */}
        {report.incidentRca && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
            <h4 className="text-xs font-extrabold text-rose-800 uppercase tracking-wide">
              ⚠ Analisis Akar Masalah (Root Cause Analysis - RCA)
            </h4>
            <p className="text-xs text-rose-900 leading-relaxed">
              {report.incidentRca}
            </p>
          </div>
        )}

        {/* Recommendations */}
        <div className="space-y-2">
          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
            Rekomendasi Tindakan Teknis ({report.recommendations?.length || 0})
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
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
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
    </ModalShell>
  );
}
