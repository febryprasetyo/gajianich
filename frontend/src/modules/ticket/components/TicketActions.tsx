"use client";

import React, { useState, useEffect } from "react";
import { TicketDetail, TechnicianLookupItem, ConfirmationChannel } from "../types";
import { getAllowedStatusTransitions, FEEDBACK_SOURCE_LABEL } from "../constants";
import {
  updateTicketStatus,
  assignTicket,
  getTechnicianLookups,
} from "../api";
import {
  UserCheck,
  CheckCircle2,
  Play,
  Pause,
  XCircle,
  RotateCcw,
  Star,
  AlertCircle,
  X,
  Lock,
} from "lucide-react";

interface TicketActionsProps {
  ticket: TicketDetail;
  onUpdate: () => void;
}

export default function TicketActions({ ticket, onUpdate }: TicketActionsProps) {
  const allowedTransitions = getAllowedStatusTransitions(ticket.status);

  // Assign modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [technicians, setTechnicians] = useState<TechnicianLookupItem[]>([]);
  const [selectedTechId, setSelectedTechId] = useState<number | null>(
    ticket.assignedToEmployeeId
  );
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Resolve modal state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [confirmationChannel, setConfirmationChannel] = useState<ConfirmationChannel>("WHATSAPP");
  const [feedbackScore, setFeedbackScore] = useState<number>(5);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [submittingResolve, setSubmittingResolve] = useState(false);

  // Reopen modal state
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [submittingReopen, setSubmittingReopen] = useState(false);

  // General action error
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch technicians when assign modal opens
  useEffect(() => {
    if (showAssignModal) {
      setLoadingTechs(true);
      getTechnicianLookups()
        .then((res) => {
          if (res.success) setTechnicians(res.data);
        })
        .catch((err) => console.error("Gagal load teknisi:", err))
        .finally(() => setLoadingTechs(false));
    }
  }, [showAssignModal]);

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechId) return;

    try {
      setSubmittingAssign(true);
      setActionError(null);
      await assignTicket(ticket.id, selectedTechId);
      setShowAssignModal(false);
      onUpdate();
    } catch (err: any) {
      setActionError(err?.message || "Gagal menugaskan tiket.");
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleDirectTransition = async (targetStatus: string) => {
    if (targetStatus === "RESOLVED") {
      setShowResolveModal(true);
      return;
    }
    if (targetStatus === "IN_PROGRESS" && (ticket.status === "RESOLVED" || ticket.status === "CLOSED")) {
      setShowReopenModal(true);
      return;
    }

    try {
      setActionError(null);
      await updateTicketStatus(ticket.id, { status: targetStatus });
      onUpdate();
    } catch (err: any) {
      setActionError(err?.message || "Gagal mengubah status tiket.");
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionNotes.trim()) {
      setActionError("Catatan penyelesaian wajib diisi.");
      return;
    }

    try {
      setSubmittingResolve(true);
      setActionError(null);
      await updateTicketStatus(ticket.id, {
        status: "RESOLVED",
        resolutionNotes: resolutionNotes.trim(),
        confirmationChannel,
        feedbackScore,
        feedbackNotes: feedbackNotes.trim() || undefined,
      });
      setShowResolveModal(false);
      onUpdate();
    } catch (err: any) {
      setActionError(err?.message || "Gagal menyelesaikan tiket.");
    } finally {
      setSubmittingResolve(false);
    }
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) {
      setActionError("Alasan pembukaan kembali tiket wajib diisi.");
      return;
    }

    try {
      setSubmittingReopen(true);
      setActionError(null);
      await updateTicketStatus(ticket.id, {
        status: "IN_PROGRESS",
        reason: reopenReason.trim(),
      });
      setShowReopenModal(false);
      onUpdate();
    } catch (err: any) {
      setActionError(err?.message || "Gagal membuka kembali tiket.");
    } finally {
      setSubmittingReopen(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Assign Technician Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAssignModal(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 hover:text-emerald-700 text-xs font-semibold text-slate-700 shadow-2xs flex items-center gap-1.5 transition-all"
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            {ticket.assignedToName ? "Alihkan Petugas" : "Tugaskan Petugas"}
          </button>
        </div>

        {/* Status Transition Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {allowedTransitions.includes("IN_PROGRESS") && ticket.status === "OPEN" && (
            <button
              type="button"
              onClick={() => handleDirectTransition("IN_PROGRESS")}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              Mulai Pengerjaan
            </button>
          )}

          {allowedTransitions.includes("PENDING") && (
            <button
              type="button"
              onClick={() => handleDirectTransition("PENDING")}
              className="px-3.5 py-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all"
            >
              <Pause className="w-3.5 h-3.5" />
              Tunda (Pending)
            </button>
          )}

          {allowedTransitions.includes("IN_PROGRESS") && ticket.status === "PENDING" && (
            <button
              type="button"
              onClick={() => handleDirectTransition("IN_PROGRESS")}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              Lanjutkan Pengerjaan
            </button>
          )}

          {allowedTransitions.includes("RESOLVED") && (
            <button
              type="button"
              onClick={() => setShowResolveModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Selesaikan Tiket
            </button>
          )}

          {allowedTransitions.includes("CLOSED") && (
            <button
              type="button"
              onClick={() => handleDirectTransition("CLOSED")}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all"
            >
              <Lock className="w-3.5 h-3.5" />
              Tutup Permanen
            </button>
          )}

          {allowedTransitions.includes("IN_PROGRESS") &&
            (ticket.status === "RESOLVED" || ticket.status === "CLOSED") && (
              <button
                type="button"
                onClick={() => setShowReopenModal(true)}
                className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Buka Kembali Tiket
              </button>
            )}

          {allowedTransitions.includes("CANCELLED") && (
            <button
              type="button"
              onClick={() => handleDirectTransition("CANCELLED")}
              className="px-3.5 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all"
            >
              <XCircle className="w-3.5 h-3.5" />
              Batalkan Tiket
            </button>
          )}
        </div>
      </div>

      {/* Modal Penugasan Petugas */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Tugaskan Petugas IT</h3>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Teknisi / Staf IT
                </label>
                {loadingTechs ? (
                  <div className="p-3 text-xs text-slate-400">Memuat daftar teknisi...</div>
                ) : (
                  <select
                    value={selectedTechId || ""}
                    onChange={(e) => setSelectedTechId(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="">-- Pilih Teknisi --</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name} {tech.email ? `(${tech.email})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAssign || !selectedTechId}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  {submittingAssign ? "Menyimpan..." : "Simpan Penugasan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Selesaikan Tiket */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Selesaikan Tiket Helpdesk</h3>
              <button
                type="button"
                onClick={() => setShowResolveModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              {/* Catatan Penyelesaian */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Penyelesaian (Tindakan yang diambil) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Jelaskan tindakan perbaikan yang telah dilakukan secara jelas..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Saluran Konfirmasi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Saluran Konfirmasi ke Pelapor
                </label>
                <select
                  value={confirmationChannel}
                  onChange={(e) => setConfirmationChannel(e.target.value as ConfirmationChannel)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                >
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="PHONE">Telepon</option>
                  <option value="WALK_IN">Tatap Muka Langsung (Walk-in)</option>
                  <option value="PORTAL">Portal Web</option>
                </select>
              </div>

              {/* Penilaian Kepuasan yang Dicatat Staf */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Penilaian Kepuasan Pelapor (1 - 5)
                  </label>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    Sumber: {FEEDBACK_SOURCE_LABEL}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setFeedbackScore(score)}
                      className={`p-2 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
                        feedbackScore === score
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {score}
                    </button>
                  ))}
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Catatan tambahan dari pelapor (opsional)..."
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingResolve || !resolutionNotes.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  {submittingResolve ? "Menyimpan..." : "Konfirmasi Selesai"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Buka Kembali Tiket (Reopen) */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Buka Kembali Tiket</h3>
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReopenSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan Pembukaan Kembali (Justifikasi) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Contoh: Masalah terulang kembali setelah 2 jam, butuh pengecekan lanjutan kabel LAN..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingReopen || !reopenReason.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  {submittingReopen ? "Membuka..." : "Buka Kembali"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
