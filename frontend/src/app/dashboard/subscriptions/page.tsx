'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ModalShell from '@/components/ui/ModalShell';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';
import StatusBadge from '@/components/ui/StatusBadge';
import TablePagination from '@/components/ui/TablePagination';
import RowActionButton from '@/components/ui/RowActionButton';
import { api } from '@/lib/api';
import {
  SubscriptionCategory,
  BillingCycle,
  SubscriptionItem,
  getDaysRemaining,
  formatRupiah,
  calculateSubscriptionStats,
  filterSubscriptions,
} from '@/lib/subscriptions';
import {
  Globe,
  Mail,
  Shield,
  Server,
  Cloud,
  Search,
  Plus,
  X,
  ExternalLink,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  CreditCard,
  Info,
  Edit2,
  Trash2,
  Loader2,
  Check,
} from 'lucide-react';

const CATEGORY_LABELS: Record<SubscriptionCategory, { label: string; icon: React.ElementType; color: string }> = {
  DOMAIN: { label: 'Domain Web', icon: Globe, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  HOSTING: { label: 'Web Hosting / VPS', icon: Server, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  EMAIL: { label: 'Email Bisnis', icon: Mail, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  SSL: { label: 'Sertifikat SSL', icon: Shield, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  SAAS: { label: 'Layanan Cloud SaaS', icon: Cloud, color: 'text-purple-600 bg-purple-50 border-purple-200' },
};

const initialFormData = {
  name: '',
  category: 'DOMAIN' as SubscriptionCategory,
  provider: '',
  registeredDomain: '',
  startDate: '',
  expiryDate: '',
  renewalCost: '',
  billingCycle: 'Tahunan' as BillingCycle,
  autoRenew: false,
  loginUrl: '',
  notes: '',
};

export default function SubscriptionsMonitoringPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals state
  const [selectedSub, setSelectedSub] = useState<SubscriptionItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState(initialFormData);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  const [editingSub, setEditingSub] = useState<SubscriptionItem | null>(null);
  const [editForm, setEditForm] = useState(initialFormData);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [deletingSub, setDeletingSub] = useState<SubscriptionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Fetch subscriptions from database via backend API
  const fetchSubscriptions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Clean up any stale legacy localStorage dummy data
      try {
        localStorage.removeItem('gajianich_subscriptions_data');
      } catch {
        // ignore
      }

      const res = await api.get<{ success: boolean; data: SubscriptionItem[] }>(
        '/infrastructure/subscriptions'
      );
      if (res && Array.isArray(res.data)) {
        setSubscriptions(res.data);
      } else {
        setSubscriptions([]);
      }
    } catch (err: any) {
      console.error('Failed to load subscriptions:', err);
      setError(err?.message || 'Gagal memuat data langganan dari server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  // Filtered subscriptions
  const filteredSubscriptions = useMemo(() => {
    return filterSubscriptions(subscriptions, search, selectedCategory, selectedStatus);
  }, [subscriptions, search, selectedCategory, selectedStatus]);

  // KPI stats
  const stats = useMemo(() => {
    return calculateSubscriptionStats(subscriptions);
  }, [subscriptions]);

  // Paginated items
  const paginatedSubscriptions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSubscriptions.slice(start, start + pageSize);
  }, [filteredSubscriptions, page, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory, selectedStatus]);

  // Handle Add Form Submission
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.expiryDate || !addForm.provider) return;

    try {
      setIsSubmittingAdd(true);
      const payload = {
        name: addForm.name.trim(),
        category: addForm.category,
        provider: addForm.provider.trim(),
        registeredDomain: addForm.registeredDomain.trim() || null,
        startDate: addForm.startDate || null,
        expiryDate: addForm.expiryDate,
        renewalCost: Number(addForm.renewalCost) || 0,
        billingCycle: addForm.billingCycle,
        autoRenew: Boolean(addForm.autoRenew),
        loginUrl: addForm.loginUrl.trim() || null,
        notes: addForm.notes.trim() || null,
      };

      const res = await api.post<{ success: boolean; data: SubscriptionItem }>(
        '/infrastructure/subscriptions',
        payload
      );

      if (res && res.data) {
        setSubscriptions((prev) => [res.data, ...prev]);
        setIsAddModalOpen(false);
        setAddForm(initialFormData);
        showToast(`Layanan "${res.data.name}" berhasil ditambahkan.`);
      }
    } catch (err: any) {
      console.error('Failed to create subscription:', err);
      alert(err?.message || 'Gagal menyimpan layanan langganan baru.');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (sub: SubscriptionItem) => {
    setEditingSub(sub);
    setEditForm({
      name: sub.name,
      category: sub.category,
      provider: sub.provider,
      registeredDomain: sub.registeredDomain || '',
      startDate: sub.startDate || '',
      expiryDate: sub.expiryDate,
      renewalCost: String(sub.renewalCost || ''),
      billingCycle: sub.billingCycle,
      autoRenew: Boolean(sub.autoRenew),
      loginUrl: sub.loginUrl || '',
      notes: sub.notes || '',
    });
  };

  // Handle Edit Form Submission
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub || !editForm.name || !editForm.expiryDate || !editForm.provider) return;

    try {
      setIsSubmittingEdit(true);
      const payload = {
        name: editForm.name.trim(),
        category: editForm.category,
        provider: editForm.provider.trim(),
        registeredDomain: editForm.registeredDomain.trim() || null,
        startDate: editForm.startDate || null,
        expiryDate: editForm.expiryDate,
        renewalCost: Number(editForm.renewalCost) || 0,
        billingCycle: editForm.billingCycle,
        autoRenew: Boolean(editForm.autoRenew),
        loginUrl: editForm.loginUrl.trim() || null,
        notes: editForm.notes.trim() || null,
      };

      const res = await api.put<{ success: boolean; data: SubscriptionItem }>(
        `/infrastructure/subscriptions/${editingSub.id}`,
        payload
      );

      if (res && res.data) {
        setSubscriptions((prev) =>
          prev.map((item) => (item.id === editingSub.id ? res.data : item))
        );
        setEditingSub(null);
        showToast(`Perubahan layanan "${res.data.name}" berhasil disimpan.`);
      }
    } catch (err: any) {
      console.error('Failed to update subscription:', err);
      alert(err?.message || 'Gagal memperbarui layanan langganan.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!deletingSub) return;

    try {
      setIsDeleting(true);
      await api.delete(`/infrastructure/subscriptions/${deletingSub.id}`);
      setSubscriptions((prev) => prev.filter((item) => item.id !== deletingSub.id));
      showToast(`Layanan "${deletingSub.name}" berhasil dihapus.`);
      setDeletingSub(null);
    } catch (err: any) {
      console.error('Failed to delete subscription:', err);
      alert(err?.message || 'Gagal menghapus layanan langganan.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Toast Notifikasi */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs animate-in slide-in-from-bottom-3 duration-200">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Page Header Sesuai Master Desain */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Domain, Hosting & Layanan Berlangganan
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Monitoring masa aktif dan tanggal kedaluwarsa domain perusahaan, paket web hosting, email bisnis, dan sertifikat SSL.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Layanan Langganan</span>
            </button>
          </div>
        </div>

        {/* 1. Kartu KPI Interaktif Master Desain */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* KPI 1: Total Layanan */}
          <button
            type="button"
            onClick={() => {
              setSelectedStatus('ALL');
              setSelectedCategory('ALL');
            }}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              selectedStatus === 'ALL' && selectedCategory === 'ALL'
                ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Total Langganan
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black font-mono text-slate-900 mt-2">{stats.total}</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-mono">
              {selectedStatus === 'ALL' && selectedCategory === 'ALL' ? (
                <span className="text-emerald-600 font-bold">● Filter Aktif</span>
              ) : (
                <span>Semua Layanan</span>
              )}
            </div>
          </button>

          {/* KPI 2: Segera Kedaluwarsa */}
          <button
            type="button"
            onClick={() => setSelectedStatus(selectedStatus === 'EXPIRING_SOON' ? 'ALL' : 'EXPIRING_SOON')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              selectedStatus === 'EXPIRING_SOON'
                ? 'bg-amber-50/50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Segera Expired (&lt; 30 Hari)
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black font-mono text-amber-600 mt-2">{stats.expiringSoon}</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-mono">
              {selectedStatus === 'EXPIRING_SOON' ? (
                <span className="text-amber-600 font-bold">● Filter Aktif</span>
              ) : (
                <span>Perlu Perpanjangan</span>
              )}
            </div>
          </button>

          {/* KPI 3: Sudah Kedaluwarsa */}
          <button
            type="button"
            onClick={() => setSelectedStatus(selectedStatus === 'EXPIRED' ? 'ALL' : 'EXPIRED')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              selectedStatus === 'EXPIRED'
                ? 'bg-rose-50/50 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Sudah Expired
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black font-mono text-rose-600 mt-2">{stats.expired}</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-mono">
              {selectedStatus === 'EXPIRED' ? (
                <span className="text-rose-600 font-bold">● Filter Aktif</span>
              ) : (
                <span>Jatuh Tempo Lewat</span>
              )}
            </div>
          </button>

          {/* KPI 4: Aman */}
          <button
            type="button"
            onClick={() => setSelectedStatus(selectedStatus === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              selectedStatus === 'ACTIVE'
                ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Layanan Aman (&gt; 30 Hari)
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black font-mono text-emerald-600 mt-2">{stats.safe}</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-mono">
              {selectedStatus === 'ACTIVE' ? (
                <span className="text-emerald-600 font-bold">● Filter Aktif</span>
              ) : (
                <span>Masa Aktif Panjang</span>
              )}
            </div>
          </button>
        </div>

        {/* 2. Toolbar Filter & Search Rapi */}
        <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari domain, nama layanan, provider/registrar, atau catatan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">Semua Kategori</option>
                <option value="DOMAIN">Domain Web</option>
                <option value="HOSTING">Web Hosting / VPS</option>
                <option value="EMAIL">Email Bisnis</option>
                <option value="SSL">Sertifikat SSL</option>
                <option value="SAAS">Layanan Cloud SaaS</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">Semua Masa Aktif</option>
                <option value="ACTIVE">Aman (&gt; 30 Hari)</option>
                <option value="EXPIRING_SOON">Segera Expired (&lt; 30 Hari)</option>
                <option value="EXPIRED">Sudah Expired</option>
              </select>

              {/* Reset Filter Button */}
              {(search !== '' || selectedCategory !== 'ALL' || selectedStatus !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSelectedCategory('ALL');
                    setSelectedStatus('ALL');
                  }}
                  className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-semibold text-xs border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. Tabel Monitoring Subscription Master Desain */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Nama Layanan & Domain</th>
                  <th className="py-3.5 px-4">Kategori & Registrar</th>
                  <th className="py-3.5 px-4">Tanggal Kedaluwarsa</th>
                  <th className="py-3.5 px-4">Biaya</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-sans">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                        <span className="text-xs font-medium text-slate-500">
                          Memuat data langganan dari server database...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedSubscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                          <Globe className="w-6 h-6 text-slate-300" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700">
                            {subscriptions.length === 0
                              ? 'Belum Ada Layanan Berlangganan'
                              : 'Tidak Ada Data yang Cocok'}
                          </p>
                          <p className="text-xs text-slate-500 max-w-sm">
                            {subscriptions.length === 0
                              ? 'Database saat ini masih kosong. Silakan tambahkan domain, hosting, email, atau lisensi SaaS perusahaan Anda.'
                              : 'Tidak ada layanan langganan yang cocok dengan filter atau kata kunci pencarian Anda.'}
                          </p>
                        </div>
                        {subscriptions.length === 0 && (
                          <button
                            type="button"
                            onClick={() => setIsAddModalOpen(true)}
                            className="mt-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Tambah Layanan Pertama</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedSubscriptions.map((sub) => {
                    const days = getDaysRemaining(sub.expiryDate);
                    const isExpired = days < 0;
                    const isExpiringSoon = days >= 0 && days <= 30;
                    const catMeta = CATEGORY_LABELS[sub.category] || CATEGORY_LABELS.DOMAIN;
                    const CatIcon = catMeta.icon;

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors group">
                        {/* Nama Layanan & Domain */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-xl shrink-0 mt-0.5 border ${catMeta.color}`}>
                              <CatIcon className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                                {sub.name}
                              </p>
                              {sub.registeredDomain && (
                                <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                                  <span>Domain:</span>
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 font-semibold text-slate-700">
                                    {sub.registeredDomain}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Kategori & Provider */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {catMeta.label}
                            </span>
                            <p className="font-medium text-slate-800 text-xs">{sub.provider}</p>
                          </div>
                        </td>

                        {/* Tanggal Kedaluwarsa */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{new Date(sub.expiryDate).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}</span>
                            </div>

                            {/* Badge Sisa Hari */}
                            {isExpired ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3" />
                                Lewat {Math.abs(days)} Hari
                              </span>
                            ) : isExpiringSoon ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                Sisa {days} Hari
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Sisa {days} Hari
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Biaya */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <p className="font-mono font-bold text-slate-900 text-xs">
                              {formatRupiah(sub.renewalCost)}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Siklus: <span className="font-medium text-slate-700">{sub.billingCycle}</span>
                              {sub.autoRenew && ' · (Auto-Renew)'}
                            </p>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {isExpired ? (
                            <StatusBadge variant="danger">Expired</StatusBadge>
                          ) : isExpiringSoon ? (
                            <StatusBadge variant="warning">Segera Expired</StatusBadge>
                          ) : (
                            <StatusBadge variant="success">Aktif (Aman)</StatusBadge>
                          )}
                        </td>

                        {/* Aksi Berbasis Ikon Sesuai Pilar Master Desain */}
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {sub.loginUrl && (
                              <a
                                href={sub.loginUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title="Buka Console / Portal Layanan"
                                aria-label="Buka portal login"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <RowActionButton
                              icon={Info}
                              label="Detail Layanan"
                              title="Lihat Detail Langganan & Biaya"
                              onClick={() => setSelectedSub(sub)}
                              variant="default"
                            />
                            <RowActionButton
                              icon={Edit2}
                              label="Edit Layanan"
                              title="Edit Data Langganan"
                              onClick={() => openEditModal(sub)}
                              variant="emerald"
                            />
                            <RowActionButton
                              icon={Trash2}
                              label="Hapus Layanan"
                              title="Hapus Layanan Langganan"
                              onClick={() => setDeletingSub(sub)}
                              variant="rose"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <TablePagination
            page={page}
            limit={pageSize}
            total={filteredSubscriptions.length}
            onPageChange={setPage}
            itemName="layanan"
          />
        </div>

        {/* Modal Detail Langganan */}
        {selectedSub && (
          <ModalShell
            isOpen={Boolean(selectedSub)}
            onClose={() => setSelectedSub(null)}
            title={`Detail Layanan: ${selectedSub.name}`}
            footer={
              <button
                type="button"
                onClick={() => setSelectedSub(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            }
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Kategori Layanan</span>
                  <span className="font-semibold text-slate-800">
                    {CATEGORY_LABELS[selectedSub.category]?.label || selectedSub.category}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Registrar / Provider</span>
                  <span className="font-bold text-slate-800">{selectedSub.provider}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Tanggal Kedaluwarsa</span>
                  <span className="font-mono font-bold text-slate-800">{selectedSub.expiryDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Sisa Waktu</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {getDaysRemaining(selectedSub.expiryDate) < 0
                      ? `Lewat ${Math.abs(getDaysRemaining(selectedSub.expiryDate))} Hari`
                      : `${getDaysRemaining(selectedSub.expiryDate)} Hari`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Biaya Perpanjangan</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formatRupiah(selectedSub.renewalCost)} / {selectedSub.billingCycle}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Auto Renewal</span>
                  <span className="font-semibold text-slate-800">
                    {selectedSub.autoRenew ? 'Aktif (Auto-Debet)' : 'Manual (Invoicing)'}
                  </span>
                </div>
              </div>

              {selectedSub.loginUrl && (
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-1">Link Console / Panel</h4>
                  <p className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700">
                    <a
                      href={selectedSub.loginUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-600 font-semibold hover:underline inline-flex items-center gap-1.5"
                    >
                      <span>{selectedSub.loginUrl}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </p>
                </div>
              )}

              {selectedSub.notes && (
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-1">Catatan Operasional</h4>
                  <p className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs text-slate-700">
                    {selectedSub.notes}
                  </p>
                </div>
              )}
            </div>
          </ModalShell>
        )}

        {/* Modal Tambah Layanan Langganan Baru */}
        {isAddModalOpen && (
          <ModalShell
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            title="Tambah Layanan Langganan / Domain Baru"
            footer={
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmittingAdd}
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="add-sub-form"
                  disabled={isSubmittingAdd}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingAdd && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmittingAdd ? 'Menyimpan...' : 'Simpan Layanan'}</span>
                </button>
              </div>
            }
          >
            <form id="add-sub-form" onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Nama Layanan *</label>
                <input
                  type="text"
                  required
                  placeholder="mis. Domain Utama Perusahaan (domain.co.id)"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Kategori Layanan *</label>
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm({ ...addForm, category: e.target.value as SubscriptionCategory })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="DOMAIN">Domain Web</option>
                    <option value="HOSTING">Web Hosting / VPS</option>
                    <option value="EMAIL">Email Bisnis</option>
                    <option value="SSL">Sertifikat SSL</option>
                    <option value="SAAS">Layanan Cloud SaaS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Domain / Identifier</label>
                  <input
                    type="text"
                    placeholder="mis. perusahaan.co.id"
                    value={addForm.registeredDomain}
                    onChange={(e) => setAddForm({ ...addForm, registeredDomain: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Registrar / Provider *</label>
                  <input
                    type="text"
                    required
                    placeholder="mis. Niagahoster, DomaiNesia, Google Cloud"
                    value={addForm.provider}
                    onChange={(e) => setAddForm({ ...addForm, provider: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Tanggal Kedaluwarsa *</label>
                  <input
                    type="date"
                    required
                    value={addForm.expiryDate}
                    onChange={(e) => setAddForm({ ...addForm, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Biaya Perpanjangan (IDR)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="mis. 275000"
                    value={addForm.renewalCost}
                    onChange={(e) => setAddForm({ ...addForm, renewalCost: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Siklus Tagihan</label>
                  <select
                    value={addForm.billingCycle}
                    onChange={(e) => setAddForm({ ...addForm, billingCycle: e.target.value as BillingCycle })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Tahunan">Tahunan</option>
                    <option value="Bulanan">Bulanan</option>
                    <option value="2 Tahun">2 Tahun</option>
                    <option value="3 Tahun">3 Tahun</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Link Login Console / Panel</label>
                <input
                  type="url"
                  placeholder="https://client.domainesia.com"
                  value={addForm.loginUrl}
                  onChange={(e) => setAddForm({ ...addForm, loginUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={addForm.autoRenew}
                    onChange={(e) => setAddForm({ ...addForm, autoRenew: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Perpanjangan Otomatis (Auto-Renewal / Auto-Debit Aktif)</span>
                </label>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Catatan</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan perpanjangan atau instruksi penting..."
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </form>
          </ModalShell>
        )}

        {/* Modal Edit Layanan Langganan */}
        {editingSub && (
          <ModalShell
            isOpen={Boolean(editingSub)}
            onClose={() => setEditingSub(null)}
            title={`Edit Layanan: ${editingSub.name}`}
            footer={
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmittingEdit}
                  onClick={() => setEditingSub(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="edit-sub-form"
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmittingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            }
          >
            <form id="edit-sub-form" onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Nama Layanan *</label>
                <input
                  type="text"
                  required
                  placeholder="mis. Domain Utama Perusahaan"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Kategori Layanan *</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value as SubscriptionCategory })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="DOMAIN">Domain Web</option>
                    <option value="HOSTING">Web Hosting / VPS</option>
                    <option value="EMAIL">Email Bisnis</option>
                    <option value="SSL">Sertifikat SSL</option>
                    <option value="SAAS">Layanan Cloud SaaS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Domain / Identifier</label>
                  <input
                    type="text"
                    placeholder="mis. perusahaan.co.id"
                    value={editForm.registeredDomain}
                    onChange={(e) => setEditForm({ ...editForm, registeredDomain: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Registrar / Provider *</label>
                  <input
                    type="text"
                    required
                    placeholder="mis. Niagahoster, DomaiNesia"
                    value={editForm.provider}
                    onChange={(e) => setEditForm({ ...editForm, provider: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Tanggal Kedaluwarsa *</label>
                  <input
                    type="date"
                    required
                    value={editForm.expiryDate}
                    onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Biaya Perpanjangan (IDR)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="mis. 275000"
                    value={editForm.renewalCost}
                    onChange={(e) => setEditForm({ ...editForm, renewalCost: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Siklus Tagihan</label>
                  <select
                    value={editForm.billingCycle}
                    onChange={(e) => setEditForm({ ...editForm, billingCycle: e.target.value as BillingCycle })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Tahunan">Tahunan</option>
                    <option value="Bulanan">Bulanan</option>
                    <option value="2 Tahun">2 Tahun</option>
                    <option value="3 Tahun">3 Tahun</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Link Login Console / Panel</label>
                <input
                  type="url"
                  placeholder="https://client.domainesia.com"
                  value={editForm.loginUrl}
                  onChange={(e) => setEditForm({ ...editForm, loginUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={editForm.autoRenew}
                    onChange={(e) => setEditForm({ ...editForm, autoRenew: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Perpanjangan Otomatis (Auto-Renewal / Auto-Debit Aktif)</span>
                </label>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Catatan</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan perpanjangan atau instruksi penting..."
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </form>
          </ModalShell>
        )}

        {/* Modal Konfirmasi Hapus Baku */}
        {deletingSub && (
          <ConfirmDeleteModal
            isOpen={Boolean(deletingSub)}
            onClose={() => setDeletingSub(null)}
            onConfirm={handleDeleteConfirm}
            title="Hapus Layanan Langganan"
            itemName={deletingSub.name}
            isLoading={isDeleting}
            description="Apakah Anda yakin ingin menghapus layanan berlangganan ini dari basis data? Tindakan ini tidak dapat dibatalkan."
            itemDetails={[
              { label: 'Kategori', value: CATEGORY_LABELS[deletingSub.category]?.label || deletingSub.category },
              { label: 'Provider', value: deletingSub.provider },
              { label: 'Kedaluwarsa', value: deletingSub.expiryDate },
            ]}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
