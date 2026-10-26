"use client";

import React, { useState } from "react";
import Link from "next/link";
import { TicketDetail as ITicketDetail } from "../types";
import {
  getStatusBadgeConfig,
  getPriorityBadgeConfig,
  formatDelayDays,
  FEEDBACK_SOURCE_LABEL,
} from "../constants";
import TicketComments from "./TicketComments";
import TicketAuditTrail from "./TicketAuditTrail";
import TicketActions from "./TicketActions";
import { uploadTicketAttachment } from "../api";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  FileText,
  Paperclip,
  CheckCircle2,
  Star,
  Upload,
  Download,
  AlertCircle,
  MessageSquare,
  History,
} from "lucide-react";

interface TicketDetailProps {
  ticket: ITicketDetail;
  onRefresh: () => void;
}

export default function TicketDetail({ ticket, onRefresh }: TicketDetailProps) {
  const [activeTab, setActiveTab] = useState<"comments" | "audit">("comments");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const statusCfg = getStatusBadgeConfig(ticket.status);
  const priorityCfg = getPriorityBadgeConfig(ticket.priority);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const delayText = formatDelayDays(ticket.reportedAt, ticket.createdAt);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    try {
      setUploadingFile(true);
      setUploadError(null);
      await uploadTicketAttachment(ticket.id, file);
      onRefresh();
    } catch (err: any) {
      setUploadError(err?.message || "Gagal mengunggah lampiran.");
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/tickets"
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-all shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-900 font-mono tracking-tight">
                  {ticket.ticketNumber}
                </h1>
                {ticket.isInternal && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                    Temuan Internal IT
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{ticket.title}</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusCfg.bgClass} ${statusCfg.textClass}`}
            >
              <span className={`w-2 h-2 rounded-full ${statusCfg.dotClass}`}></span>
              {statusCfg.label}
            </span>

            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${priorityCfg.bgClass} ${priorityCfg.textClass}`}
            >
              Prioritas {priorityCfg.label}
            </span>

            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {ticket.category}
            </span>

            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              Via {ticket.origin}
            </span>
          </div>
        </div>

        {/* Action Controls Bar */}
        <TicketActions ticket={ticket} onUpdate={onRefresh} />
      </div>

      {/* Grid: 3 Identities Cards & Timestamps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Identity 1: Pelapor (Requester) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-2">
              1. Identitas Pelapor (Karyawan HR)
            </div>
            <div className="text-sm font-extrabold text-slate-900">
              {ticket.requesterName || ticket.requester?.nameSnapshot || (ticket.requesterEmployeeId ? `Karyawan #${ticket.requesterEmployeeId}` : `Karyawan Pelapor`)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {ticket.requesterDepartment || ticket.requester?.departmentSnapshot || "Departemen Tidak Terdaftar"}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 truncate">
              {ticket.requesterEmail || "-"}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
            Sumber Data: HR Employee Master
          </div>
        </div>

        {/* Identity 2: Pencatat (Created By) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-2">
              2. Dicatat Oleh (Staf IT)
            </div>
            <div className="text-sm font-extrabold text-slate-900">
              {ticket.createdByName || ticket.createdBy?.nameSnapshot || ticket.createdByUsername || "Staf IT"}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Username: {ticket.createdByUsername || ticket.createdBy?.nameSnapshot || "-"}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              ID Akun: #{ticket.createdById || ticket.createdBy?.userId || "-"}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-emerald-600 font-medium">
            Terekam otomatis dari sesi JWT aman
          </div>
        </div>

        {/* Identity 3: Petugas Pengerjaan (Assigned To) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-2">
              3. Petugas Penanggung Jawab
            </div>
            <div className="text-sm font-extrabold text-slate-900">
              {ticket.assignedToName || ticket.assignedTo?.nameSnapshot || (
                <span className="text-slate-400 italic font-normal">Belum Ditugaskan</span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 truncate">
              {ticket.assignedToEmail || (ticket.assignedToName ? "Staf Operasional IT" : "-")}
            </div>
            {ticket.dueAt && (
              <div className="text-[11px] text-amber-700 font-semibold mt-1">
                Batas Waktu SLA: {formatDate(ticket.dueAt)}
              </div>
            )}
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
            {ticket.assignedToName ? "Sedang bertugas" : "Menunggu penugasan teknisi"}
          </div>
        </div>
      </div>

      {/* Timestamps & Delay Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div>
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
              Waktu Pelapor Mengadu
            </span>
            <span className="text-xs font-bold text-slate-900 mt-0.5 block">
              {formatDate(ticket.reportedAt)}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
              Waktu Dicatat ke Sistem
            </span>
            <span className="text-xs font-bold text-slate-900 mt-0.5 block">
              {formatDate(ticket.createdAt)}
            </span>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
              Keterlambatan Pencatatan
            </span>
            <span
              className={`text-xs font-extrabold mt-0.5 block ${
                delayText ? "text-amber-600" : "text-emerald-600"
              }`}
            >
              {delayText ? delayText : "Hari yang sama (Tepat Waktu)"}
            </span>
          </div>
        </div>
      </div>

      {/* Problem Description & Details */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-600 border-b border-slate-100 pb-2">
          Rincian Masalah
        </h3>
        <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
          {ticket.description}
        </p>

        {/* Lampiran Berkas */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" />
              Lampiran ({ticket.attachments?.length || 0})
            </h4>

            <div>
              <input
                type="file"
                id="detail-file-input"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                className="hidden"
                accept="image/*,application/pdf"
              />
              <label
                htmlFor="detail-file-input"
                className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:border-emerald-500 hover:text-emerald-700 shadow-2xs transition-all"
              >
                <Upload className="w-3 h-3" />
                {uploadingFile ? "Mengunggah..." : "Tambah Lampiran"}
              </label>
            </div>
          </div>

          {uploadError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {uploadError}
            </div>
          )}

          {ticket.attachments && ticket.attachments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {ticket.attachments.map((att) => (
                <div
                  key={att.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="truncate pr-2">
                    <div className="font-semibold text-slate-900 truncate">{att.fileName}</div>
                    <div className="text-[10px] text-slate-400">
                      {Math.round(att.fileSize / 1024)} KB • {att.mimeType}
                    </div>
                  </div>
                  <a
                    href={`/api/v1/helpdesk/tickets/${ticket.id}/attachments/${att.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-white rounded-lg transition-all"
                    title="Unduh Lampiran"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Tidak ada lampiran berkas.</p>
          )}
        </div>
      </div>

      {/* Resolution & Feedback Summary Card (If Resolved or Closed) */}
      {(ticket.status === "RESOLVED" || ticket.status === "CLOSED") && ticket.resolutionNotes && (
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Hasil Penyelesaian Tiket
            </h3>
            <span className="text-[10px] font-mono text-emerald-700 font-medium">
              Selesai pada: {formatDate(ticket.resolvedAt)}
            </span>
          </div>

          <div className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-emerald-100">
            <strong>Tindakan yang diambil:</strong>
            <p className="mt-1 whitespace-pre-wrap">{ticket.resolutionNotes}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="text-xs">
              <span className="text-[11px] text-slate-500 font-medium">Saluran Konfirmasi:</span>
              <div className="font-bold text-slate-900">{ticket.confirmationChannel || "-"}</div>
            </div>

            <div className="text-xs">
              <span className="text-[11px] text-slate-500 font-medium">Penilaian Kepuasan:</span>
              <div className="flex items-center gap-1 font-bold text-amber-600">
                <Star className="w-4 h-4 fill-current text-amber-500" />
                <span>{ticket.feedbackScore ? `${ticket.feedbackScore} / 5` : "-"}</span>
              </div>
            </div>

            <div className="text-xs">
              <span className="text-[11px] text-slate-500 font-medium">Sumber Penilaian:</span>
              <div className="font-mono text-[11px] font-bold text-slate-700">
                {ticket.feedbackSource || FEEDBACK_SOURCE_LABEL}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs: Komentar & Audit Trail */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("comments")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "comments"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Diskusi & Komentar ({ticket.comments?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "audit"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Riwayat Perubahan ({ticket.audit?.length || 0})
          </button>
        </div>

        {activeTab === "comments" ? (
          <TicketComments
            ticketId={ticket.id}
            comments={ticket.comments || []}
            onCommentAdded={onRefresh}
          />
        ) : (
          <TicketAuditTrail auditTrail={ticket.audit || []} />
        )}
      </div>
    </div>
  );
}
