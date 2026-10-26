'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ReconciliationCandidateCard, {
  ReconciliationItem,
} from '@/components/custodians/ReconciliationCandidateCard';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  canManageCustodians,
  type CustodianSearchResponse,
  type CustodianSummary,
  type EmployeeCandidate,
} from '@/lib/assetCustodian';

export default function CustodianReconciliationPage() {
  const { user } = useAuth();
  const isAdmin = canManageCustodians(user?.roleName);

  const [candidates, setCandidates] = useState<ReconciliationItem[]>([]);
  const [activeCustodians, setActiveCustodians] = useState<CustodianSummary[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [linkSelections, setLinkSelections] = useState<Record<number, string>>({});
  const [mergeSelections, setMergeSelections] = useState<Record<number, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reconcileRes, searchRes] = await Promise.all([
        api.get<ReconciliationItem[]>('/asset-custodians/reconciliation-candidates'),
        api.get<CustodianSearchResponse>('/asset-custodians?status=ACTIVE'),
      ]);
      setCandidates(Array.isArray(reconcileRes) ? reconcileRes : []);
      setActiveCustodians(Array.isArray(searchRes?.custodians) ? searchRes.custodians : []);
      setAllEmployees(Array.isArray(searchRes?.employees) ? searchRes.employees : []);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load reconciliation candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const linkEmployee = async (item: ReconciliationItem) => {
    const employeeId = Number(linkSelections[item.custodian.id]);
    if (!employeeId) return;
    setBusyId(item.custodian.id);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.post(`/asset-custodians/${item.custodian.id}/link-employee`, { employeeId });
      setSuccessMessage(`Successfully linked "${item.custodian.displayName}" to HR record.`);
      await loadData();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to link employee');
    } finally {
      setBusyId(null);
    }
  };

  const mergeCustodian = async (source: CustodianSummary) => {
    const targetId = Number(mergeSelections[source.id]);
    if (!targetId) return;
    setBusyId(source.id);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.post(`/asset-custodians/${source.id}/merge`, { targetCustodianId: targetId });
      setSuccessMessage(`Successfully merged "${source.displayName}" into canonical holder.`);
      await loadData();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to merge custodian');
    } finally {
      setBusyId(null);
    }
  };

  const pendingCandidates = candidates.filter((item) => !dismissed.has(item.custodian.id));

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
          <h1 className="text-lg font-bold text-slate-900">Administrator access required</h1>
          <p className="mt-1 text-xs text-slate-600">
            HR Reconciliation requires SuperAdmin or ITAdmin role.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        <div>
          <Link
            href="/dashboard/master/asset-custodians"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Asset Custodians
          </Link>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                HR Reconciliation Candidates
              </h1>
              <p className="text-xs text-slate-500">
                Review unverified holders and resolve them with official HR employee records or merge duplicate profiles.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-xs text-slate-500 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading candidates...
          </div>
        ) : pendingCandidates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No candidates requiring reconciliation</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              All current asset holders are either verified or have been reviewed. As new manual holders are created, suggested matches will appear here.
            </p>
            <div className="mt-4">
              <Link
                href="/dashboard/master/asset-custodians"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Return to Directory
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pendingCandidates.map((item) => (
              <ReconciliationCandidateCard
                key={item.custodian.id}
                item={item}
                activeCustodians={activeCustodians}
                allEmployees={allEmployees}
                isBusy={busyId === item.custodian.id}
                linkSelection={linkSelections[item.custodian.id] || ''}
                onLinkSelectionChange={(val) =>
                  setLinkSelections((prev) => ({ ...prev, [item.custodian.id]: val }))
                }
                mergeSelection={mergeSelections[item.custodian.id] || ''}
                onMergeSelectionChange={(val) =>
                  setMergeSelections((prev) => ({ ...prev, [item.custodian.id]: val }))
                }
                onLinkEmployee={() => linkEmployee(item)}
                onMergeCustodian={() => mergeCustodian(item.custodian)}
                onDismiss={() =>
                  setDismissed((prev) => new Set([...prev, item.custodian.id]))
                }
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
