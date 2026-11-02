'use client';

import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ModalShell from '@/components/ui/ModalShell';
import StatusBadge from '@/components/ui/StatusBadge';
import TablePagination from '@/components/ui/TablePagination';
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
  User,
  Info,
} from 'lucide-react';

export type SubscriptionCategory = 'DOMAIN' | 'HOSTING' | 'EMAIL' | 'SSL' | 'SAAS';

export interface SubscriptionItem {
  id: number;
  name: string;
  category: SubscriptionCategory;
  provider: string; // Registrar or Host
  registeredDomain?: string;
  startDate?: string;
  expiryDate: string; // YYYY-MM-DD
  renewalCost: number;
  billingCycle: 'Tahunan' | 'Bulanan' | '2 Tahun' | '3 Tahun';
  autoRenew: boolean;
  picName: string;
  loginUrl?: string;
  notes?: string;
}

const INITIAL_SUBSCRIPTIONS: SubscriptionItem[] = [
  {
    id: 1,
    name: 'Domain Utama Perusahaan (gajianich.co.id)',
    registeredDomain: 'gajianich.co.id',
    category: 'DOMAIN',
    provider: 'PANDI / Niagahoster',
    startDate: '2024-03-15',
    expiryDate: '2027-03-15',
    renewalCost: 275000,
    billingCycle: 'Tahunan',
    autoRenew: true,
    picName: 'Rian Hidayat (IT Admin)',
    loginUrl: 'https://panel.niagahoster.co.id',
    notes: 'Domain resmi operasional dan portal web perusahaan.',
  },
  {
    id: 2,
    name: 'Google Workspace Business Starter (60 Akun)',
    registeredDomain: 'gajianich.co.id',
    category: 'EMAIL',
    provider: 'Google Cloud Indonesia',
    startDate: '2025-01-10',
    expiryDate: '2026-11-20', // ~18 days left (Segera Kedaluwarsa)
    renewalCost: 5400000,
    billingCycle: 'Bulanan',
    autoRenew: true,
    picName: 'Rian Hidayat (IT Admin)',
    loginUrl: 'https://admin.google.com',
    notes: 'Email korporat, Google Meet, dan Google Drive tim manajemen & staff.',
  },
  {
    id: 3,
    name: 'Cloud Hosting Corporate Profile & Landing Page',
    registeredDomain: 'gajianich.co.id',
    category: 'HOSTING',
    provider: 'IdCloudHost Jakarta',
    startDate: '2024-12-01',
    expiryDate: '2026-12-01', // ~29 days left (Segera Kedaluwarsa)
    renewalCost: 1850000,
    billingCycle: 'Tahunan',
    autoRenew: false,
    picName: 'Budi Santoso (Web Ops)',
    loginUrl: 'https://app.idcloudhost.com',
    notes: 'cPanel server hosting WordPress landing page publik & blog info karir.',
  },
  {
    id: 4,
    name: 'Wildcard SSL Certificate (*.gajianich.co.id)',
    registeredDomain: '*.gajianich.co.id',
    category: 'SSL',
    provider: 'Sectigo / DomaiNesia',
    startDate: '2025-05-10',
    expiryDate: '2027-05-10',
    renewalCost: 1200000,
    billingCycle: 'Tahunan',
    autoRenew: false,
    picName: 'Rian Hidayat (IT Admin)',
    loginUrl: 'https://client.domainesia.com',
    notes: 'Sertifikat keamanan HTTPS untuk subdomain aplikasi web & API gateway.',
  },
  {
    id: 5,
    name: 'Domain Sekunder Brand (ams-system.id)',
    registeredDomain: 'ams-system.id',
    category: 'DOMAIN',
    provider: 'DomaiNesia',
    startDate: '2024-10-15',
    expiryDate: '2026-10-15', // Past date (Expired)
    renewalCost: 225000,
    billingCycle: 'Tahunan',
    autoRenew: false,
    picName: 'Rian Hidayat (IT Admin)',
    loginUrl: 'https://client.domainesia.com',
    notes: 'Domain redirect ke portal sistem utama, menunggu instruksi perpanjangan.',
  },
  {
    id: 6,
    name: 'Microsoft 365 Business Standard (15 Akun Finance)',
    registeredDomain: 'finance.gajianich.co.id',
    category: 'EMAIL',
    provider: 'Microsoft Enterprise Indonesia',
    startDate: '2025-08-01',
    expiryDate: '2027-08-01',
    renewalCost: 3250000,
    billingCycle: 'Tahunan',
    autoRenew: true,
    picName: 'Siti Rahma (IT Staff)',
    loginUrl: 'https://admin.microsoft.com',
    notes: 'Lisensi Excel Desktop & Outlook untuk tim keuangan & pajak.',
  },
];

const CATEGORY_LABELS: Record<SubscriptionCategory, { label: string; icon: React.ElementType; color: string }> = {
  DOMAIN: { label: 'Domain Web', icon: Globe, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  HOSTING: { label: 'Web Hosting / VPS', icon: Server, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  EMAIL: { label: 'Email Bisnis', icon: Mail, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  SSL: { label: 'Sertifikat SSL', icon: Shield, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  SAAS: { label: 'Layanan Cloud SaaS', icon: Cloud, color: 'text-purple-600 bg-purple-50 border-purple-200' },
};

function getDaysRemaining(expiryDateString: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateString);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SubscriptionsMonitoringPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>(INITIAL_SUBSCRIPTIONS);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals
  const [selectedSub, setSelectedSub] = useState<SubscriptionItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    category: 'DOMAIN' as SubscriptionCategory,
    provider: '',
    registeredDomain: '',
    startDate: '',
    expiryDate: '',
    renewalCost: '',
    billingCycle: 'Tahunan' as 'Tahunan' | 'Bulanan' | '2 Tahun' | '3 Tahun',
    autoRenew: true,
    picName: '',
    loginUrl: '',
    notes: '',
  });

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Local storage persistence
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ams_subscriptions_data');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSubscriptions(parsed);
        }
      }
    } catch {
      // fallback to initial
    }
  }, []);

  const saveSubscriptions = (newSubs: SubscriptionItem[]) => {
    setSubscriptions(newSubs);
    try {
      localStorage.setItem('ams_subscriptions_data', JSON.stringify(newSubs));
    } catch {
      // ignore
    }
  };

  // Filtered subscriptions
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      const days = getDaysRemaining(sub.expiryDate);

      // Status filter
      if (selectedStatus === 'EXPIRED' && days >= 0) return false;
      if (selectedStatus === 'EXPIRING_SOON' && (days < 0 || days > 30)) return false;
      if (selectedStatus === 'ACTIVE' && days <= 30) return false;

      // Category filter
      if (selectedCategory !== 'ALL' && sub.category !== selectedCategory) return false;

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = sub.name.toLowerCase().includes(q);
        const matchDomain = sub.registeredDomain?.toLowerCase().includes(q);
        const matchProvider = sub.provider.toLowerCase().includes(q);
        const matchPic = sub.picName.toLowerCase().includes(q);
        return matchName || matchDomain || matchProvider || matchPic;
      }
      return true;
    });
  }, [subscriptions, selectedStatus, selectedCategory, search]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = subscriptions.length;
    let expiringSoon = 0;
    let expired = 0;
    let safe = 0;

    subscriptions.forEach((sub) => {
      const days = getDaysRemaining(sub.expiryDate);
      if (days < 0) {
        expired++;
      } else if (days <= 30) {
        expiringSoon++;
      } else {
        safe++;
      }
    });

    return { total, expiringSoon, expired, safe };
  }, [subscriptions]);

  // Paginated
  const paginatedSubscriptions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSubscriptions.slice(start, start + pageSize);
  }, [filteredSubscriptions, page, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory, selectedStatus]);

  // Handle Add Form Submission
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.expiryDate) return;

    const newItem: SubscriptionItem = {
      id: Date.now(),
      name: addForm.name,
      category: addForm.category,
      provider: addForm.provider || 'Provider Layanan',
      registeredDomain: addForm.registeredDomain || undefined,
      startDate: addForm.startDate || undefined,
      expiryDate: addForm.expiryDate,
      renewalCost: Number(addForm.renewalCost) || 0,
      billingCycle: addForm.billingCycle,
      autoRenew: addForm.autoRenew,
      picName: addForm.picName || 'Tim IT Support',
      loginUrl: addForm.loginUrl || undefined,
      notes: addForm.notes || undefined,
    };

    saveSubscriptions([newItem, ...subscriptions]);
    setIsAddModalOpen(false);
    setAddForm({
      name: '',
      category: 'DOMAIN',
      provider: '',
      registeredDomain: '',
      startDate: '',
      expiryDate: '',
      renewalCost: '',
      billingCycle: 'Tahunan',
      autoRenew: true,
      picName: '',
      loginUrl: '',
      notes: '',
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
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
                placeholder="Cari domain, nama layanan, provider/registrar, atau PIC penanggung jawab..."
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
                  <th className="py-3.5 px-4">Tanggal Kedaluwarsa & Hitung Mundur</th>
                  <th className="py-3.5 px-4">Biaya & Siklus Tagihan</th>
                  <th className="py-3.5 px-4">Penanggung Jawab (PIC)</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-sans">
                {paginatedSubscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Globe className="w-8 h-8 text-slate-300" />
                        <span className="text-xs font-medium text-slate-500">
                          Tidak ada data langganan yang cocok dengan filter pencarian.
                        </span>
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

                        {/* Tanggal Kedaluwarsa & Countdown */}
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

                        {/* Biaya & Siklus Tagihan */}
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

                        {/* PIC */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-700">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{sub.picName}</span>
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
                                className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors"
                                title="Buka Console / Portal Layanan"
                                aria-label="Buka portal login"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedSub(sub)}
                              className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors cursor-pointer"
                              title="Lihat Detail Langganan & Biaya"
                              aria-label={`Detail ${sub.name}`}
                            >
                              <Info className="w-4 h-4" />
                            </button>
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

              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-1">Informasi Akun & PIC</h4>
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 text-xs">
                  <p className="text-slate-700">
                    <span className="text-slate-400">PIC Penanggung Jawab:</span>{' '}
                    <strong>{selectedSub.picName}</strong>
                  </p>
                  {selectedSub.loginUrl && (
                    <p className="text-slate-700 flex items-center gap-1.5">
                      <span className="text-slate-400">Console Panel:</span>{' '}
                      <a
                        href={selectedSub.loginUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-600 font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        <span>{selectedSub.loginUrl}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </p>
                  )}
                </div>
              </div>

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
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="add-sub-form"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Simpan Layanan
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
                    onChange={(e) => setAddForm({ ...addForm, billingCycle: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Tahunan">Tahunan</option>
                    <option value="Bulanan">Bulanan</option>
                    <option value="2 Tahun">2 Tahun</option>
                    <option value="3 Tahun">3 Tahun</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Penanggung Jawab (PIC)</label>
                  <input
                    type="text"
                    placeholder="mis. Rian Hidayat (IT Admin)"
                    value={addForm.picName}
                    onChange={(e) => setAddForm({ ...addForm, picName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                  />
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
      </div>
    </DashboardLayout>
  );
}

