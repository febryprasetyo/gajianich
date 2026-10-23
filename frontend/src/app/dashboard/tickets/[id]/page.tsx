'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { ArrowLeft, Loader2, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { TicketDetail, EmployeeItem, TechnicianItem } from '@/lib/tickets/types';
import { renderPriorityBadge, renderStatusBadge } from '@/components/tickets/TicketTable';
import TicketWorkflowBar from '@/components/tickets/TicketWorkflowBar';
import TicketDiscussionThread from '@/components/tickets/TicketDiscussionThread';
import TicketSlaCard from '@/components/tickets/TicketSlaCard';
import ResolveTicketModal from '@/components/tickets/ResolveTicketModal';

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();

  // Primary State
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [technicians, setTechnicians] = useState<TechnicianItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status transition state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<number | ''>('');

  // Resolution modal state
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  // Fetch Ticket Detail
  const fetchTicketDetail = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<TicketDetail>(`/tickets/${id}`);
      setTicket(data);
      setSelectedAssigneeId(data.assigneeId || '');

      // Load employees for technician list
      api
        .get<EmployeeItem[]>('/employees')
        .then((emps) => {
          setTechnicians(emps.map((e) => ({ id: e.id, name: e.fullName, email: e.email })));
        })
        .catch(() => {});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load ticket details';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve(params).then((resolved) => {
      if (active && resolved?.id) {
        fetchTicketDetail(resolved.id);
      }
    });
    return () => {
      active = false;
    };
  }, [params, fetchTicketDetail]);

  // Handle Status Transition
  const handleStatusChange = async (newStatus: 'In Progress' | 'Closed') => {
    if (!ticket) return;

    try {
      setUpdatingStatus(true);
      const updated = await api.put<TicketDetail>(`/tickets/${ticket.id}`, {
        status: newStatus,
      });
      setTicket((prev) => (prev ? { ...prev, status: updated.status || newStatus } : null));
      fetchTicketDetail(ticket.id.toString());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update ticket status';
      alert(message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Assignee Change
  const handleAssigneeChange = async (newAssigneeId: number | '') => {
    if (!ticket) return;

    try {
      setUpdatingStatus(true);
      setSelectedAssigneeId(newAssigneeId);
      await api.put(`/tickets/${ticket.id}`, {
        assigneeId: newAssigneeId ? Number(newAssigneeId) : null,
      });
      fetchTicketDetail(ticket.id.toString());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to assign technician';
      alert(message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-500 font-mono text-xs">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span>Loading ticket workspace & discussion timeline...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !ticket) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Link
            href="/dashboard/tickets"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-emerald-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Ticket Queue</span>
          </Link>
          <div className="p-8 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex flex-col items-center justify-center text-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <p className="font-bold text-sm">{error || 'Ticket not found'}</p>
            <button
              onClick={() => router.push('/dashboard/tickets')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Return to Ticket Catalog
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isReq = ticket.type?.toLowerCase() === 'request' || ticket.ticketCode.startsWith('REQ');

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full max-w-[1600px] mx-auto">
        {/* Back Link & Header Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/tickets"
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors shadow-2xs cursor-pointer"
              title="Back to Tickets"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-md border ${
                    isReq
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }`}
                >
                  {ticket.ticketCode}
                </span>
                <span className="text-xs text-slate-400 font-mono uppercase tracking-wider font-semibold">
                  {ticket.type}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
                {ticket.subject}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {renderPriorityBadge(ticket.priority)}
            {renderStatusBadge(ticket.status)}
          </div>
        </div>

        {/* Technician Control Bar & Action Ribbon */}
        <TicketWorkflowBar
          ticket={ticket}
          technicians={technicians}
          updatingStatus={updatingStatus}
          selectedAssigneeId={selectedAssigneeId}
          onAssigneeChange={handleAssigneeChange}
          onStatusChange={handleStatusChange}
          onOpenResolve={() => setIsResolveModalOpen(true)}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols wide) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Resolution Notes Banner (if resolved) */}
            {ticket.resolutionNotes && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1 shadow-2xs">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Resolution Notes</span>
                  {ticket.resolvedAt && (
                    <span className="text-[10px] text-emerald-600 font-normal ml-auto">
                      {new Date(ticket.resolvedAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-line pl-6">
                  {ticket.resolutionNotes}
                </p>
              </div>
            )}

            {/* Ticket Description Card */}
            <div className="glass-panel p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Ticket Description & Details</span>
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : ''}
                </span>
              </div>

              <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                {ticket.description}
              </div>
            </div>

            {/* Work Log & Discussion Thread */}
            <TicketDiscussionThread
              ticketId={ticket.id}
              comments={ticket.comments}
              onCommentAdded={() => fetchTicketDetail(ticket.id.toString())}
            />
          </div>

          {/* Right Column (1 Col wide): SLA Countdown & Meta Info */}
          <TicketSlaCard ticket={ticket} />
        </div>
      </div>

      {/* Shared Resolve Modal */}
      <ResolveTicketModal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        ticket={ticket}
        onSuccess={() => fetchTicketDetail(ticket.id.toString())}
      />
    </DashboardLayout>
  );
}
