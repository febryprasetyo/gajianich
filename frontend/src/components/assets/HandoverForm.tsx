'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  createHandover,
  updateHandover,
  HANDOVER_ITEM_TYPE_OPTIONS,
} from '@/lib/assetHandovers';
import type {
  AssetHandover,
  HandoverFormInput,
  HandoverItemInput,
} from '@/types/assetHandover';
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Search,
  CheckSquare,
  Square,
  AlertCircle,
  FileSignature,
} from 'lucide-react';
import Link from 'next/link';

interface EmployeeOption {
  id: number;
  employeeCode: string;
  fullName: string;
  position: string | null;
  address: string | null;
  phone: string | null;
}

interface AssetOption {
  id: number;
  assetCode: string;
  name: string;
  serialNumber: string | null;
  condition: string | null;
}

interface HandoverFormProps {
  initialData?: AssetHandover;
  prefillAssetId?: number;
}

export function HandoverForm({ initialData, prefillAssetId }: HandoverFormProps) {
  const router = useRouter();
  const { user } = useAuth();

  const isEditing = Boolean(initialData?.id);

  // Form states
  const [handoverDate, setHandoverDate] = useState(
    initialData?.handoverDate || new Date().toISOString().slice(0, 10)
  );
  const [employeeId, setEmployeeId] = useState<number | null>(
    initialData?.employeeId || null
  );
  const [recipientName, setRecipientName] = useState(
    initialData?.recipientName || ''
  );
  const [recipientAddress, setRecipientAddress] = useState(
    initialData?.recipientAddress || ''
  );
  const [recipientPosition, setRecipientPosition] = useState(
    initialData?.recipientPosition || ''
  );
  const [recipientPhone, setRecipientPhone] = useState(
    initialData?.recipientPhone || ''
  );

  const [itemTypes, setItemTypes] = useState<string[]>(
    initialData?.itemTypes || ['laptop']
  );
  const [itemTypesCustom, setItemTypesCustom] = useState(
    initialData?.itemTypesCustom || ''
  );

  const [givenByName, setGivenByName] = useState(
    initialData?.givenByName || user?.fullName || 'Staff IT'
  );
  const [givenByTitle, setGivenByTitle] = useState(
    initialData?.givenByTitle || 'IT Support'
  );
  const [receivedByName, setReceivedByName] = useState(
    initialData?.receivedByName || initialData?.recipientName || ''
  );

  const [notes, setNotes] = useState(initialData?.notes || '');
  const [status, setStatus] = useState(initialData?.status || 'COMPLETED');

  const [items, setItems] = useState<HandoverItemInput[]>(
    initialData?.items?.length
      ? initialData.items.map((it) => ({
          itemOrder: it.itemOrder,
          assetId: it.assetId,
          itemName: it.itemName,
          description: it.description,
        }))
      : [{ itemOrder: 1, itemName: '', description: '', assetId: null }]
  );

  // Remote dropdown data
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load employee and asset options
  useEffect(() => {
    async function loadOptions() {
      try {
        const [empData, assetData] = await Promise.all([
          api.get<EmployeeOption[]>('/assets/handovers/options/employees'),
          api.get<AssetOption[]>('/assets/handovers/options/assets'),
        ]);
        setEmployees(empData || []);
        setAssets(assetData || []);

        // If prefillAssetId is given, prefill row 1
        if (prefillAssetId && !initialData) {
          const matched = (assetData || []).find((a) => a.id === prefillAssetId);
          if (matched) {
            setItems([
              {
                itemOrder: 1,
                assetId: matched.id,
                itemName: `${matched.name} (${matched.assetCode})`,
                description: [
                  matched.serialNumber ? `S/N: ${matched.serialNumber}` : '',
                  matched.condition ? `Kondisi: ${matched.condition}` : '',
                ]
                  .filter(Boolean)
                  .join(', '),
              },
            ]);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat opsi karyawan/aset:', err);
      }
    }
    loadOptions();
  }, [prefillAssetId, initialData]);

  // Handle employee selection
  const handleSelectEmployee = (empIdStr: string) => {
    if (!empIdStr) {
      setEmployeeId(null);
      return;
    }
    const empId = Number(empIdStr);
    const selected = employees.find((e) => e.id === empId);
    if (selected) {
      setEmployeeId(selected.id);
      setRecipientName(selected.fullName);
      if (selected.position) setRecipientPosition(selected.position);
      if (selected.address) setRecipientAddress(selected.address);
      if (selected.phone) setRecipientPhone(selected.phone);
      if (!receivedByName) setReceivedByName(selected.fullName);
    }
  };

  // Toggle item types checkbox
  const toggleItemType = (typeId: string) => {
    if (itemTypes.includes(typeId)) {
      setItemTypes(itemTypes.filter((t) => t !== typeId));
    } else {
      setItemTypes([...itemTypes, typeId]);
    }
  };

  // Add row
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        itemOrder: prev.length + 1,
        assetId: null,
        itemName: '',
        description: '',
      },
    ]);
  };

  // Remove row
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((it, idx) => ({ ...it, itemOrder: idx + 1 }))
    );
  };

  // Update item field
  const handleItemChange = (index: number, field: keyof HandoverItemInput, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Handle asset dropdown selection on a row
  const handleSelectAssetOnRow = (index: number, assetIdStr: string) => {
    if (!assetIdStr) {
      handleItemChange(index, 'assetId', null);
      return;
    }
    const assetId = Number(assetIdStr);
    const matched = assets.find((a) => a.id === assetId);
    if (matched) {
      setItems((prev) => {
        const copy = [...prev];
        const descParts = [
          matched.serialNumber ? `S/N: ${matched.serialNumber}` : '',
          matched.condition ? `Kondisi: ${matched.condition}` : '',
        ].filter(Boolean);

        copy[index] = {
          ...copy[index],
          assetId: matched.id,
          itemName: `${matched.name} (${matched.assetCode})`,
          description: descParts.join(', '),
        };
        return copy;
      });

      // Auto-check itemType if matches keyword
      const lower = matched.name.toLowerCase();
      if (lower.includes('laptop') && !itemTypes.includes('laptop')) {
        setItemTypes((prev) => [...prev, 'laptop']);
      } else if (lower.includes('pc') && !itemTypes.includes('pc')) {
        setItemTypes((prev) => [...prev, 'pc']);
      } else if (lower.includes('monitor') && !itemTypes.includes('monitor')) {
        setItemTypes((prev) => [...prev, 'monitor']);
      } else if (lower.includes('printer') && !itemTypes.includes('printer')) {
        setItemTypes((prev) => [...prev, 'printer']);
      }
    }
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic client validation
    if (!recipientName.trim()) {
      setErrorMessage('Nama penerima wajib diisi');
      return;
    }
    if (!givenByName.trim()) {
      setErrorMessage('Nama pihak yang menyerahkan wajib diisi');
      return;
    }
    const validItems = items.filter((it) => it.itemName.trim() !== '');
    if (validItems.length === 0) {
      setErrorMessage('Sertakan minimal 1 baris rincian barang');
      return;
    }

    const payload: HandoverFormInput = {
      handoverDate,
      employeeId,
      recipientName: recipientName.trim(),
      recipientAddress: recipientAddress.trim() || null,
      recipientPosition: recipientPosition.trim() || null,
      recipientPhone: recipientPhone.trim() || null,
      itemTypes,
      itemTypesCustom: itemTypes.includes('lainnya') ? itemTypesCustom.trim() || null : null,
      givenByName: givenByName.trim(),
      givenByTitle: givenByTitle.trim() || null,
      receivedByName: receivedByName.trim() || recipientName.trim(),
      notes: notes.trim() || null,
      status,
      items: validItems.map((it, idx) => ({
        ...it,
        itemOrder: idx + 1,
      })),
    };

    try {
      setIsSubmitting(true);
      if (isEditing && initialData?.id) {
        await updateHandover(initialData.id, payload);
        router.push(`/dashboard/assets/handovers/${initialData.id}`);
      } else {
        const created = await createHandover(payload);
        router.push(`/dashboard/assets/handovers/${created.id}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan data tanda terima');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-medium">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Grid Bagian Atas: Metadata Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1 & 2: Informasi Penerima & Tanggal */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <FileSignature className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">
              Informasi Penerima & Tanggal
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tanggal */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Tanda Terima <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={handoverDate}
                onChange={(e) => setHandoverDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Pilih Karyawan Master (Opsional Auto-Fill) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pilih dari Karyawan Master (Auto-Fill)
              </label>
              <select
                value={employeeId || ''}
                onChange={(e) => handleSelectEmployee(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">-- Ketik Manual / Non-Karyawan --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeCode}) {emp.position ? `- ${emp.position}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Nama Penerima */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Penerima <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Nama lengkap pemegang barang"
                value={recipientName}
                onChange={(e) => {
                  setRecipientName(e.target.value);
                  if (!receivedByName) setReceivedByName(e.target.value);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Jabatan */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jabatan
              </label>
              <input
                type="text"
                placeholder="Contoh: IT Support / Staf Logistik"
                value={recipientPosition}
                onChange={(e) => setRecipientPosition(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Nomor Kontak */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor Kontak / WhatsApp
              </label>
              <input
                type="text"
                placeholder="Contoh: 081234567890"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Alamat */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alamat Penerima
              </label>
              <textarea
                rows={2}
                placeholder="Alamat domisili atau alamat penugasan"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Kolom 3: Checklist Jenis Barang & Status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">
              Jenis Barang (Checklist)
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {HANDOVER_ITEM_TYPE_OPTIONS.map((opt) => {
              const active = itemTypes.includes(opt.id);
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => toggleItemType(opt.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left cursor-pointer ${
                    active
                      ? 'bg-emerald-50/70 border-emerald-500 text-emerald-900 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {active ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {itemTypes.includes('lainnya') && (
            <div className="pt-2">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Keterangan Jenis Lainnya:
              </label>
              <input
                type="text"
                placeholder="Sebutkan jenis barang lainnya"
                value={itemTypesCustom}
                onChange={(e) => setItemTypesCustom(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          )}

          {/* Status Dokumen */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Status Tanda Terima
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="COMPLETED">Selesai / Ditandatangani (Completed)</option>
              <option value="DRAFT">Draft / Belum Final</option>
              <option value="ARCHIVED">Diarsipkan (Archived)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bagian Tengah: Tabel Rincian Barang Dinamis */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Tabel Rincian Barang
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih dari inventaris aset yang terdaftar atau masukkan nama dan spesifikasi barang secara bebas.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Baris</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 w-64">Pilih Aset (Opsional)</th>
                <th className="py-2.5 px-3">Nama Barang *</th>
                <th className="py-2.5 px-3">Keterangan / S/N / Kelengkapan</th>
                <th className="py-2.5 px-3 w-12 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-center text-xs font-mono font-semibold text-slate-500">
                    {idx + 1}
                  </td>

                  {/* Dropdown Aset */}
                  <td className="py-2.5 px-3">
                    <select
                      value={item.assetId || ''}
                      onChange={(e) => handleSelectAssetOnRow(idx, e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 truncate"
                    >
                      <option value="">-- Manual / Non-Aset --</option>
                      {assets.map((ast) => (
                        <option key={ast.id} value={ast.id}>
                          {ast.assetCode} - {ast.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Nama Barang */}
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Laptop ThinkPad T14 Gen 3"
                      value={item.itemName}
                      onChange={(e) => handleItemChange(idx, 'itemName', e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                    />
                  </td>

                  {/* Keterangan */}
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      placeholder="S/N: PF-XXXX, Kelengkapan adaptor, charger, tas, dsb."
                      value={item.description || ''}
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </td>

                  {/* Hapus */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-20 transition-colors rounded-lg cursor-pointer"
                      title="Hapus baris"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bagian Bawah: Penandatangan */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="pb-2 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">
            Penandatangan Dokumen
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Nama yang tercantum pada kotak tanda tangan "Diberikan" dan "Diterima Oleh" di lembar fisik.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Box Diberikan */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Pihak Penyerah (Diberikan)
            </span>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Nama Petugas <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={givenByName}
                onChange={(e) => setGivenByName(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Jabatan Petugas
              </label>
              <input
                type="text"
                value={givenByTitle}
                onChange={(e) => setGivenByTitle(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Box Diterima Oleh */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Pihak Penerima (Diterima Oleh)
            </span>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Nama Penerima <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={receivedByName}
                onChange={(e) => setReceivedByName(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Secara default nama ini sama dengan nama penerima di atas.
            </p>
          </div>
        </div>

        {/* Catatan Tambahan */}
        <div className="pt-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Catatan Tambahan (Opsional)
          </label>
          <input
            type="text"
            placeholder="Keterangan tambahan serah terima..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Tombol Aksi Bawah */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href="/dashboard/assets/handovers"
          className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>Kembali</span>
        </Link>

        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSubmitting ? 'Menyimpan...' : 'Simpan & Lihat Dokumen'}</span>
        </button>
      </div>
    </form>
  );
}
