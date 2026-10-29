'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Plus, Printer, Save, Trash2 } from 'lucide-react';
import { GoodsDocumentHeading } from './GoodsRequestDocument';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useOrganizationScope } from '@/context/OrganizationScopeContext';
import { api } from '@/lib/api';
import {
  capitalizeWords,
  compressEvidence,
  localEvidenceKey,
  GA_API_PATH,
  GA_BASE_PATH,
  rupiah,
  GoodsRequest,
} from '@/lib/goodsRequests';
import { validateFormSubmission } from '@/lib/ga/goodsFormValidation';
import { normalizePastedPrice } from '@/lib/ga/pricePaste';

interface Evidence {
  key: string;
  file?: File;
  url: string;
  isExisting?: boolean;
}

interface Row {
  key: string;
  name: string;
  quantity: string;
  estimatedPrice: string;
  notes: string;
  evidence: Evidence[];
}

const newRow = (key = localEvidenceKey()): Row => ({
  key,
  name: '',
  quantity: '1',
  estimatedPrice: '',
  notes: '',
  evidence: [],
});

const inputClass = 'w-full min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const secondary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';

export interface GoodsRequestFormProps {
  initialData?: GoodsRequest;
}

export default function GoodsRequestForm({ initialData }: GoodsRequestFormProps = {}) {
  const isEditMode = Boolean(initialData?.id);
  const { user } = useAuth();
  const router = useRouter();
  const {selectedGroupId} = useOrganizationScope();
  const [organizations,setOrganizations] = useState<Array<{id:number;groupId:number;name:string}>>([]);
  const [organizationId,setOrganizationId] = useState<number | null>(initialData?.organizationId ?? null);
  useEffect(() => {
    let active = true;
    api.get<Array<{id:number;groupId:number;name:string}>>(`${GA_API_PATH}/organizations`).then(rows => {if(active) setOrganizations(rows);}).catch(() => {if(active) setOrganizations([]);});
    return () => {active = false;};
  },[selectedGroupId]);

  const [identity, setIdentity] = useState({
    requestDate: initialData?.requestDate || new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
    requesterName: initialData?.requesterName ? capitalizeWords(initialData.requesterName) : capitalizeWords(user?.fullName || ''),
    jobTitle: initialData?.jobTitle || 'GA',
    division: initialData?.division || 'HRGA',
  });

  const [rows, setRows] = useState<Row[]>(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items.map((item, index) => ({
        key: `item-${index}-${item.id || Date.now()}`,
        name: item.name,
        quantity: String(item.quantity),
        estimatedPrice: String(item.estimatedPrice),
        notes: item.notes || '',
        evidence: (item.attachments || []).map((att) => ({
          key: att.id,
          url: `/api/v1/ga/requests/${initialData.id}/evidence/${att.id}`,
          isExisting: true,
        })),
      }));
    }
    return [newRow('initial-item')];
  });
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [invalidRows, setInvalidRows] = useState<string[]>([]);

  const urls = useRef(new Set<string>());
  const locked = useRef(false);
  const evidenceLock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    if (user?.fullName && !identity.requesterName) {
      setIdentity((c) => ({ ...c, requesterName: capitalizeWords(user.fullName) }));
    }
  }, [user?.fullName]);

  useEffect(() => {
    mounted.current = true;
    const ownedUrls = urls.current;
    return () => {
      mounted.current = false;
      ownedUrls.forEach((url) => URL.revokeObjectURL(url));
      ownedUrls.clear();
    };
  }, []);

  function update(key: string, field: 'name' | 'quantity' | 'estimatedPrice' | 'notes', value: string) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function revoke(evidence: Evidence) {
    if (evidence.file) {
      URL.revokeObjectURL(evidence.url);
      urls.current.delete(evidence.url);
    }
  }

  async function addEvidence(rowKey: string, files: File[]) {
    if (!files.length || locked.current || evidenceLock.current) return;
    evidenceLock.current = true;
    setProcessing(true);
    setError('');
    const added: Evidence[] = [];
    try {
      const row = rows.find((r) => r.key === rowKey);
      if (!row || row.evidence.length + files.length > 3) {
        throw new Error('Maksimal 3 gambar bukti harga per item barang.');
      }
      for (const source of files) {
        const file = await compressEvidence(source);
        if (!mounted.current) return;
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        added.push({ key: localEvidenceKey(), file, url });
      }
      setRows((current) =>
        current.map((r) => (r.key === rowKey ? { ...r, evidence: [...r.evidence, ...added] } : r))
      );
      setInvalidRows((current) => current.filter((key) => key !== rowKey));
    } catch (cause) {
      added.forEach(revoke);
      setError((cause as Error).message || 'Gambar gagal diproses. Silakan coba kembali.');
    } finally {
      evidenceLock.current = false;
      if (mounted.current) setProcessing(false);
    }
  }

  async function handleSubmit(isDraft: boolean, autoPrint: boolean = false) {
    if (locked.current || evidenceLock.current || busy || processing) return;

    setError('');
    const finalTitle = rows[0]?.name ? `Pengadaan ${rows[0].name.trim()}` : 'Permintaan Barang';
    const finalPurpose = 'Operasional kantor';

    const validation = validateFormSubmission(
      {
        title: finalTitle,
        purpose: finalPurpose,
        identity,
        rows: rows.map((r) => ({
          name: r.name,
          quantity: r.quantity,
          estimatedPrice: r.estimatedPrice,
          notes: r.notes,
          evidenceCount: r.evidence.length,
        })),
      },
      isDraft
    );

    if (!validation.isValid) {
      const missingEvidence = rows.filter((r) => r.evidence.length === 0).map((r) => r.key);
      setInvalidRows(missingEvidence);
      setError(validation.errors.join('\n') || 'Periksa kembali kelengkapan formulir.');
      return;
    }

    setBusy(true);
    locked.current = true;

    try {
      const form = new FormData();
      if (!selectedGroupId || !organizationId) throw new Error('Pilih kelompok aktif dan organisasi tujuan sebelum menyimpan.');
      const payload = {
        groupId:selectedGroupId,
        organizationId,
        title: finalTitle,
        purpose: finalPurpose,
        isDraft,
        status: 'draft',
        requestDate: identity.requestDate,
        requesterName: capitalizeWords(identity.requesterName.trim()),
        jobTitle: identity.jobTitle.trim() || 'GA',
        division: identity.division.trim() || 'HRGA',
        items: rows.map((row) => ({
          name: row.name.trim(),
          quantity: Number(row.quantity),
          estimatedPrice: Number(row.estimatedPrice),
          notes: row.notes.trim(),
          attachmentKeys: row.evidence.map((e) => e.key),
        })),
      };

      form.append('payload', JSON.stringify(payload));
      for (const row of rows) {
        for (const item of row.evidence) {
          if (item.file) {
            form.append('evidence', item.file, item.key);
          }
        }
      }

      if (isEditMode) {
        const result = await api.upload<{ id: string; version: number }>(
          `${GA_API_PATH}/${initialData!.id}`,
          form,
          { method: 'PUT' }
        );
        router.push(`${GA_BASE_PATH}/${initialData!.id}${autoPrint ? '?autoPrint=true' : ''}`);
      } else {
        const result = await api.upload<{ id: string }>(GA_API_PATH, form);
        router.push(`${GA_BASE_PATH}/${result.id}${autoPrint ? '?autoPrint=true' : ''}`);
      }
    } catch (cause) {
      locked.current = false;
      setBusy(false);
      setError((cause as Error).message || 'Pengajuan belum dapat diproses. Coba kembali; data formulir tetap tersedia.');
    }
  }

  return (
    <DashboardLayout>
      <main className="min-w-0 space-y-6 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={isEditMode ? `${GA_BASE_PATH}/${initialData!.id}` : GA_BASE_PATH}
            className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-slate-600 hover:text-emerald-700"
          >
            <ArrowLeft size={16} /> {isEditMode ? 'Kembali ke detail permintaan' : 'Kembali ke daftar permintaan barang'}
          </Link>
        </div>

        <form onSubmit={(event: FormEvent) => { event.preventDefault(); void handleSubmit(false); }} noValidate aria-busy={busy || processing}>
          <fieldset disabled={busy || processing} className="min-w-0 space-y-6 border-0 p-0">
            <legend className="sr-only">Isi permintaan barang oleh GA</legend>
          <section
            role="group" aria-label="Lembar permintaan barang"
            className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
          >
            <GoodsDocumentHeading headingColorClass="text-black" profile={initialData?.documentProfileSnapshot || initialData?.documentProfilePreview} />
            <div className="space-y-2 border-b border-slate-200 p-4 text-xs">
              <label htmlFor="ga-organization" className="font-semibold text-slate-800">Organisasi tujuan</label>
              <select id="ga-organization" value={organizationId ?? ''} disabled={isEditMode || !selectedGroupId} onChange={e => setOrganizationId(e.target.value ? Number(e.target.value) : null)} className={inputClass} required>
                <option value="">Pilih organisasi dalam kelompok aktif</option>
                {organizations.filter(o => o.groupId === selectedGroupId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              {!selectedGroupId && <p className="text-amber-800">Pilih satu kelompok tujuan pada pemilih kelompok.</p>}
              {selectedGroupId && organizations.length === 0 && <p className="text-amber-800">Organisasi resmi belum dikonfigurasi untuk kelompok ini.</p>}
            </div>
            <div className="space-y-3 border-b border-slate-200 p-4 text-xs sm:p-6">
              {([
                ['requestDate', 'Tanggal', 'date'],
                ['requesterName', 'Nama', 'text'],
                ['jobTitle', 'Jabatan', 'text'],
                ['division', 'Divisi', 'text'],
              ] as const).map(([key, label, type]) => (
                <div key={key} className="grid min-h-11 grid-cols-[64px_12px_minmax(0,1fr)] items-center sm:grid-cols-[100px_16px_minmax(0,1fr)]">
                  <label htmlFor={key} className="font-medium text-slate-800">
                    {label}
                  </label>
                  <span aria-hidden="true">:</span>
                  <input
                    id={key}
                    type={type}
                    maxLength={150}
                    aria-label={label}
                    value={identity[key]}
                    onChange={(e) => setIdentity(c => ({ ...c, [key]: e.target.value }))}
                    required
                    onClick={type === 'date' ? event => event.currentTarget.showPicker?.() : undefined}
                    className={`${inputClass} min-w-0${type === 'date' ? ' cursor-pointer' : ''}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-6">
              <h2 className="text-sm font-bold text-slate-900">Rincian barang</h2>
              <p className="text-xs text-slate-600">{rows.length} dari 20 item</p>
              <p className="w-full text-xs text-slate-600 sm:hidden">Geser tabel ke samping untuk melihat harga dan kolom pengesahan.</p>
            </div>
            <div className="mx-4 overflow-x-auto sm:mx-6">
              <table aria-label="Daftar barang" className="w-full min-w-[850px] border-collapse text-left text-xs">
                <thead>
                  <tr>
                    <th scope="col" className="w-12 border border-slate-300 bg-slate-50 px-3 py-2 text-center font-semibold text-slate-800 whitespace-nowrap">
                      No
                    </th>
                    <th scope="col" className="w-24 border border-slate-300 bg-slate-50 px-3 py-2 text-center font-semibold text-slate-800 whitespace-nowrap">
                      Qty
                    </th>
                    <th scope="col" className="border border-slate-300 bg-slate-50 px-3 py-2 text-center font-semibold text-slate-800">
                      Nama Barang
                    </th>
                    <th scope="col" className="w-40 border border-slate-300 bg-slate-50 px-3 py-2 text-center font-semibold text-slate-800">
                      Estimasi Harga
                    </th>
                    <th scope="col" className="w-40 border border-slate-300 bg-slate-50 px-3 py-2 text-center font-semibold text-slate-800">
                      Subtotal Harga
                    </th>
                    <th scope="col" className="w-56 border border-slate-300 bg-slate-50 px-3 py-2 text-center font-semibold text-slate-800">
                      Keterangan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const qtyNum = Number(row.quantity) || 0;
                    const priceNum = Number(row.estimatedPrice) || 0;
                    const subtotal = qtyNum * priceNum;

                    return (
                      <tr key={row.key} className="align-top">
                        <td className="w-12 border border-slate-300 p-3 text-center text-slate-700">
                          {index + 1}
                        </td>
                        <td className="w-24 border border-slate-300 p-1">
                          <input
                            id={`qty-${row.key}`}
                            type="number"
                            min={1}
                            max={1000000}
                            step={1}
                            aria-label={`Qty item ${index + 1}`}
                            value={row.quantity}
                            onChange={(e) => update(row.key, 'quantity', e.target.value)}
                            className={inputClass}
                          />
                        </td>
                        <td className="min-w-52 border border-slate-300 p-1">
                          <textarea
                            id={`name-${row.key}`}
                            rows={2}
                            maxLength={1000}
                            aria-label={`Nama barang item ${index + 1}`}
                            placeholder="Nama dan spesifikasi barang..."
                            value={row.name}
                            onChange={(e) => update(row.key, 'name', e.target.value)}
                            className={inputClass}
                          />
                        </td>
                        <td className="w-40 border border-slate-300 p-1">
                          <input
                            id={`price-${row.key}`}
                            type="number"
                            min={0}
                            step={1}
                            aria-label={`Estimasi harga item ${index + 1}`}
                            placeholder="0"
                            value={row.estimatedPrice}
                            onChange={(e) => update(row.key, 'estimatedPrice', e.target.value)}
                            onPaste={(event) => {
                              event.preventDefault();
                              const price = normalizePastedPrice(event.clipboardData.getData('text'));
                              if (price === null) {
                                setError('Harga yang ditempel harus berupa nominal Rupiah bulat, misalnya 6.199.000 atau 6,199,000.');
                                return;
                              }
                              update(row.key, 'estimatedPrice', price);
                              setError('');
                            }}
                            className={inputClass}
                          />
                        </td>
                        <td className="w-40 border border-slate-300 p-3 text-right font-semibold text-slate-800">
                          <span aria-label={`Subtotal item ${index + 1}`}>
                            {rupiah(subtotal)}
                          </span>
                        </td>
                        <td className="w-56 border border-slate-300 p-1">
                          <textarea
                            id={`notes-${row.key}`}
                            aria-label={`Keterangan item ${index + 1}`}
                            rows={2}
                            maxLength={2000}
                            placeholder="Catatan..."
                            value={row.notes}
                            onChange={(e) => update(row.key, 'notes', e.target.value)}
                            className={inputClass}
                          />
                          <button
                            type="button"
                            disabled={rows.length === 1}
                            aria-label={`Hapus barang item ${index + 1}`}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-rose-700 hover:bg-rose-50 disabled:opacity-30"
                            onClick={() => {
                              row.evidence.forEach(revoke);
                              setRows(c => c.filter(item => item.key !== row.key));
                            }}
                          >
                            <Trash2 size={14} /> Hapus
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6">
              <button
                type="button"
                disabled={rows.length >= 20}
                className={secondary}
                onClick={() => setRows(c => [...c, newRow()])}
              >
                <Plus size={16} /> Tambah barang
              </button>

            </div>

            <div className="p-4 sm:p-6 space-y-4" aria-label="Lampiran bukti harga">
              <h3 className="text-sm font-bold text-slate-800">
                Lampiran
              </h3>
              {rows.map((row, index) => (
                <div
                  key={row.key}
                  id={`evidence-${row.key}`}
                  tabIndex={0}
                  aria-label={`Lampiran item ${index + 1}`}
                  onPaste={(event) => {
                    const clipboard = event.clipboardData;
                    const fromFiles = Array.from(clipboard.files || []).filter(file => file.type.startsWith('image/'));
                    const fromItems = Array.from(clipboard.items || [])
                      .filter(item => item.type.startsWith('image/'))
                      .map(item => item.getAsFile())
                      .filter((file): file is File => !!file);
                    const files = fromFiles.length ? fromFiles : fromItems;
                    if (files.length) {
                      event.preventDefault();
                      void addEvidence(row.key, files);
                    }
                  }}
                  className={`rounded-xl border p-4 transition ${
                    invalidRows.includes(row.key)
                      ? 'border-rose-300 bg-rose-50/60'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-800">
                      Item {index + 1}: {row.name || 'Barang baru'}
                    </p>
                    <label
                      aria-label={`Pilih gambar item ${index + 1}`}
                      className={`${secondary} relative cursor-pointer focus-within:ring-2 focus-within:ring-emerald-700 focus-within:ring-offset-2`}
                    >
                      Pilih gambar
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        onChange={(e) => {
                          void addEvidence(row.key, Array.from(e.target.files || []));
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Fokuskan area ini lalu Ctrl+V untuk menempel screenshot, atau pilih gambar PNG, JPEG, atau WebP.
                  </p>
                  {invalidRows.includes(row.key) && (
                    <p className="mt-2 text-xs font-semibold text-rose-700">
                      Item {index + 1} belum memiliki bukti harga.
                    </p>
                  )}
                  {row.evidence.map((file, imgIdx) => (
                    <figure key={file.key} className="mt-3 flex items-center gap-3">
                      <a href={file.url} target="_blank" rel="noreferrer">
                        <img
                          src={file.url}
                          alt={`Bukti harga item ${index + 1}, gambar ${imgIdx + 1}`}
                          className="h-16 w-24 rounded-lg object-cover border border-slate-200 shadow-sm"
                        />
                      </a>
                      <div className="text-xs text-slate-600">
                        <p>{file.file ? `${Math.ceil(file.file.size / 1024)} KB` : 'Lampiran tersimpan'}</p>
                        <button
                          type="button"
                          onClick={() => {
                            revoke(file);
                            setRows(c => c.map(r => r.key === row.key ? { ...r, evidence: r.evidence.filter(e => e.key !== file.key) } : r));
                          }}
                          className="mt-1 inline-flex min-h-11 items-center rounded-lg px-2 text-rose-700 hover:bg-rose-50"
                        >
                          Hapus gambar
                        </button>
                      </div>
                    </figure>
                  ))}
                </div>
              ))}
            </div>
          </section>

          {processing && (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 size={16} className="animate-spin text-emerald-600" /> Memproses gambar kompresi...
            </p>
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 whitespace-pre-line">
              {error}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push(isEditMode ? `${GA_BASE_PATH}/${initialData!.id}` : GA_BASE_PATH)}
              className={secondary}
            >
              Batal
            </button>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                disabled={busy || processing}
                onClick={() => void handleSubmit(true, false)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                <Save size={16} />
                {isEditMode ? 'Simpan Perubahan Draft' : 'Simpan Draft'}
              </button>

              <button
                type="button"
                disabled={busy || processing}
                onClick={() => void handleSubmit(false, true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                {busy ? 'Menyimpan...' : (isEditMode ? 'Simpan & Cetak' : 'Simpan & Cetak Formulir')}
              </button>
            </div>
          </div>
        </fieldset>
        </form>
      </main>
    </DashboardLayout>
  );
}
