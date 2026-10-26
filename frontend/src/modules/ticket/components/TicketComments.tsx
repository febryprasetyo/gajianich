"use client";

import React, { useState } from "react";
import { TicketCommentItem } from "../types";
import { addTicketComment } from "../api";
import { MessageSquare, Lock, Send, AlertCircle } from "lucide-react";

interface TicketCommentsProps {
  ticketId: number;
  comments: TicketCommentItem[];
  onCommentAdded: () => void;
}

export default function TicketComments({
  ticketId,
  comments,
  onCommentAdded,
}: TicketCommentsProps) {
  const [commentText, setCommentText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      await addTicketComment(ticketId, commentText.trim(), isInternal);
      setCommentText("");
      setIsInternal(false);
      onCommentAdded();
    } catch (err: any) {
      setError(err?.message || "Gagal menambahkan komentar.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      {/* Comments List */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
            <p className="text-xs text-slate-500">Belum ada diskusi atau komentar pada tiket ini.</p>
          </div>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className={`p-4 rounded-xl border text-xs transition-all ${
                c.isInternal
                  ? "bg-amber-50/60 border-amber-200"
                  : "bg-white border-slate-200 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{c.userName || "Staf"}</span>
                  {c.isInternal && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                      <Lock className="w-2.5 h-2.5" />
                      Catatan Internal
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 font-mono">{formatDate(c.createdAt)}</span>
              </div>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{c.comment}</p>
            </div>
          ))
        )}
      </div>

      {/* New Comment Form */}
      <form onSubmit={handleSubmit} className="bg-slate-50/75 border border-slate-200 rounded-xl p-4 space-y-3">
        {error && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <textarea
          rows={3}
          placeholder="Tulis balasan, perkembangan pengerjaan, atau catatan teknisi..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
            />
            <span className="text-xs text-slate-700 font-medium flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-600" />
              Catatan Internal Tim IT (Tidak terlihat di portal pelapor)
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting || !commentText.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            Kirim Komentar
          </button>
        </div>
      </form>
    </div>
  );
}
