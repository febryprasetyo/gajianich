'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  GA_API_PATH,
  GA_BASE_PATH,
  GoodsRequest,
  formatFormDate,
  capitalizeWords,
  formatRupiahNumber,
  requestNumber,
  rupiah,
} from '@/lib/goodsRequests';
import StatusTransitionModal from './StatusTransitionModal';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';
import { getStatusBadgeConfig, getStatusLabel, isRequestEditable } from '@/lib/ga/goodsRequestStatus';
import { GoodsDocumentHeading, GoodsDocumentSignatures } from './GoodsRequestDocument';
import './goodsRequestPrint.css';
import { documentProfileForRender } from '@/lib/organizationDocumentProfile';

interface GoodsRequestDetailProps {
  id: string;
  saved?: boolean;
}

export default function GoodsRequestDetail({ id, saved = false }: GoodsRequestDetailProps) {
  const { hasPermission } = useAuth();
  const [request, setRequest] = useState<GoodsRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [images, setImages] = useState<Record<string, string>>({});
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState('');
  const [printError, setPrintError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoPrint = searchParams?.get('autoPrint') === 'true';
  const autoPrintedRef = useRef(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const documentProfile = request ? documentProfileForRender(request,'GA') : null;
  const editable = request ? isRequestEditable(request.status) : false;

  useEffect(() => {
    if (autoPrint && request && !imageLoading && !imageError && !autoPrintedRef.current) {
      autoPrintedRef.current = true;
      const timer = setTimeout(() => {
        void print();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, request, imageLoading, imageError]);

  async function handleDelete() {
    if (!request || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`${GA_API_PATH}/${request.id}`);
      router.push(GA_BASE_PATH);
    } catch (err) {
      setDeleteError((err as Error).message || 'Gagal menghapus pengajuan.');
      setDeleting(false);
    }
  }
  const [retry, setRetry] = useState(0);

  const canManageStatus = hasPermission('ga:requests:update_status') || hasPermission('ga:requests:manage');

  useEffect(() => {
    let active = true;
    const ownedUrls: string[] = [];

    api.get<GoodsRequest>(`${GA_API_PATH}/${id}`)
      .then(async res => {
        if (!active) return;
        setRequest(res);
        setLoading(false);

        // Fetch attachments
        const files: { id: string; itemId: number }[] = [];
        (res.items || []).forEach(item => {
          (item.attachments || []).forEach(att => {
            files.push({ id: att.id, itemId: item.position });
          });
        });

        if (files.length === 0) {
          setImageLoading(false);
          return;
        }

        const urlMap: Record<string, string> = {};
        for (const file of files) {
          try {
            const blob = await api.download(`${GA_API_PATH}/${id}/evidence/${file.id}`);
            if (!active) return;
            const objectUrl = URL.createObjectURL(blob);
            ownedUrls.push(objectUrl);
            urlMap[file.id] = objectUrl;
          } catch (err) {
            console.error('Gagal mengambil gambar bukti:', err);
          }
        }
        if (active) {
          setImages(urlMap);
          setImageLoading(false);
        }
      })
      .catch(err => {
        if (!active) return;
        setError(err.message || 'Gagal memuat rincian pengajuan.');
        setLoading(false);
      });

    return () => {
      active = false;
      ownedUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [id, retry]);

  function reload() {
    setLoading(true);
    setError('');
    setImageError('');
    setImageLoading(true);
    setImages({});
    setRetry(v => v + 1);
  }

  async function print() {
    if (!request || !documentProfile || imageLoading || imageError) return;
    setPrintError('');
    try {
      await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>('.ga-request-document-area img')).map(image => image.decode()));
      window.print();
    } catch {
      setPrintError('Gambar dokumen gagal dimuat. Coba cetak kembali.');
    }
  }

  const badge = request ? getStatusBadgeConfig(request.status) : null;

  const allAttachments = (request?.items || []).flatMap((item) =>
    (item.attachments || []).map((att) => ({
      ...att,
      itemId: item.id,
      itemPosition: item.position,
      itemName: item.name,
    }))
  );

  const paddedRows = Array.from(
    { length: Math.max(8, request?.items?.length || 0) },
    (_, i) => request?.items?.[i] || null
  );

  return (
    <DashboardLayout>
      <main className="ga-request-detail min-w-0 space-y-6 pb-6">
        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={GA_BASE_PATH}
            aria-label="Daftar permintaan barang"
            className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-slate-600 hover:text-emerald-700"
          >
            <ArrowLeft size={16} /> Kembali ke daftar permintaan barang
          </Link>
        </div>

        {/* Header Bar: Prominent Request Number & Status Badge */}
        {request && (
          <div className="no-print rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Left: Request Number & Status Badge */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900">
                    {requestNumber(request)}
                  </h1>
                  {badge && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-bold shadow-2xs ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${badge.dotClass}`} />
                      {getStatusLabel(request.status)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-500 flex-wrap">
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                    Versi {request.version || 1}
                  </span>
                  <span>•</span>
                  <span>Pemohon: <strong className="font-semibold text-slate-800">{capitalizeWords(request.requesterName)}</strong></span>
                  <span>•</span>
                  <span>Tanggal: <strong className="font-semibold text-slate-800">{formatFormDate(request.requestDate)}</strong></span>
                </div>
              </div>

              {/* Right: Actions */}
              {!loading && (
                <div className="flex items-center gap-2.5 flex-wrap">
                  {canManageStatus && (
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                    >
                      <CheckCircle2 size={15} /> Perbarui Status
                    </button>
                  )}

                  {editable && (
                    <Link
                      href={`${GA_BASE_PATH}/${request.id}/edit`}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-emerald-700 transition"
                    >
                      <Pencil size={14} /> Edit
                    </Link>
                  )}

                  {editable && (
                    <button
                      type="button"
                      onClick={() => setIsDeleteModalOpen(true)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 shadow-xs hover:bg-rose-100 transition"
                    >
                      <Trash2 size={14} /> Hapus
                    </button>
                  )}

                  <button
                    disabled={!documentProfile || imageLoading || !!imageError}
                    onClick={print}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-400 active:scale-95 disabled:opacity-50 transition"
                  >
                    <Printer size={15} /> Cetak Formulir
                  </button>
                </div>
              )}
            </div>
          </div>
        )}



        {printError && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
            {printError}
          </p>
        )}

        {loading ? (
          <p role="status" className="flex items-center gap-2 p-12 text-sm text-slate-500 justify-center">
            <Loader2 size={18} className="animate-spin text-emerald-600" /> Memuat data pengajuan...
          </p>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            <p>{error}</p>
            <button className="mt-3 min-h-9 rounded-xl border border-slate-200 bg-white px-3 font-medium text-slate-700" onClick={reload}>
              Coba kembali
            </button>
          </div>
        ) : request && (
          <div className="ga-request-document-area space-y-6">
            {!documentProfile && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Profil dokumen resmi belum tersedia. Pratinjau dan cetak ditahan sampai identitas dan format organisasi disahkan.</p>}
            {documentProfile && <article
              role="group"
              aria-label="Lembar permintaan barang"
              className="ga-request-document w-full min-w-0 bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 sm:p-8 print:p-0 print:border-none print:shadow-none print:rounded-none print:max-w-none print:m-0"
            >
              {/* Boxed Formal Document Form */}
              <div className="ga-request-document-box border border-black bg-white text-black text-[11px]">
                <GoodsDocumentHeading headingColorClass="text-black" profile={documentProfile} />

                {/* Form Info Identity */}
                <div className="border-b border-black text-[11px] text-black pt-2.5 pb-2.5 sm:pt-3 sm:pb-3 print:pt-2 print:pb-2">
                  {[
                    ['Tanggal', formatFormDate(request.requestDate)],
                    ['Nama', capitalizeWords(request.requesterName)],
                    ['Jabatan', request.jobTitle?.trim() || 'GA'],
                    ['Divisi', request.division?.trim() || 'HRGA'],
                  ].map(([label, value], idx, arr) => (
                    <div
                      key={label}
                      className={`grid grid-cols-[85px_16px_minmax(0,1fr)] sm:grid-cols-[110px_20px_minmax(0,1fr)] items-center px-3 sm:px-4 py-0.5 print:py-[1px] leading-tight ${idx < arr.length - 1 ? 'border-b border-black/30' : ''
                        }`}
                    >
                      <span className="font-semibold">{label}</span>
                      <span aria-hidden="true">:</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table aria-label="Barang yang diajukan" className="w-full min-w-[700px] border-collapse text-left text-[11px] text-black">
                    <thead>
                      <tr className="border-b border-black text-center font-bold">
                        <th scope="col" className="w-10 border-r border-black py-2 px-1.5 sm:px-2 print:py-1 text-center font-bold">No</th>
                        <th scope="col" className="w-14 border-r border-black py-2 px-1.5 sm:px-2 print:py-1 text-center font-bold">Qty</th>
                        <th scope="col" className="border-r border-black py-2 px-2 sm:px-3 print:py-1 text-left font-bold">Nama Barang</th>
                        <th scope="col" className="w-36 border-r border-black py-2 px-2 sm:px-3 print:py-1 text-center font-bold">Estimasi Harga</th>
                        <th scope="col" className="w-28 border-r border-black py-2 px-2 sm:px-3 print:py-1 text-center font-bold">Harga</th>
                        <th scope="col" className="w-44 py-2 px-2 sm:px-3 print:py-1 text-left font-bold">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paddedRows.map((item, idx) => (
                        <tr key={idx} className="border-b border-black">
                          <td className="border-r border-black py-2 px-1.5 sm:px-2 print:py-1 text-center font-medium">{idx + 1}</td>
                          <td className="border-r border-black py-2 px-1.5 sm:px-2 print:py-1 text-center font-medium">{item?.quantity ?? ''}</td>
                          <td className="border-r border-black py-2 px-2 sm:px-3 print:py-1 text-left font-medium break-words leading-tight">
                            {item?.name ?? ''}
                          </td>
                          <td className="border-r border-black py-2 px-2 sm:px-3 print:py-1 whitespace-nowrap">
                            {item ? (
                              <div className="flex justify-between items-center w-full">
                                <span>Rp</span>
                                <span className="font-mono">{formatRupiahNumber(item.estimatedPrice)}</span>
                              </div>
                            ) : null}
                          </td>
                          <td className="border-r border-black py-2 px-2 sm:px-3 print:py-1 whitespace-nowrap">
                            {item ? (
                              <div className="flex justify-between items-center w-full">
                                <span>Rp</span>
                                <span className="font-mono">{formatRupiahNumber(item.subtotal || (Number(item.estimatedPrice) * Number(item.quantity)))}</span>
                              </div>
                            ) : null}
                          </td>
                          <td className="py-2 px-2 sm:px-3 print:py-1 text-left text-slate-800 break-words leading-tight">
                            {item?.notes || ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Signatures Table */}
                <div className="overflow-x-auto">
                  <GoodsDocumentSignatures profile={documentProfile} requesterName={capitalizeWords(request.requesterName)} />
                </div>
              </div>
            </article>}

            {/* Price Evidence Gallery */}
            <div
              aria-label="Lampiran"
              className="ga-request-evidence-area w-full rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4 print:mt-2 print:p-0 print:border-none print:shadow-none print:bg-transparent print:rounded-none print:space-y-2"
            >
              <h3 className="no-print text-sm font-bold text-slate-900">
                Lampiran
              </h3>
              {imageLoading && <p role="status" className="no-print text-xs text-slate-500">Memuat bukti gambar...</p>}
              {imageError && (
                <div role="alert" className="no-print text-xs text-rose-700 bg-rose-50 p-3 rounded-lg mb-2">
                  <p>{imageError}</p>
                  <button onClick={reload} className="mt-1 underline">Muat kembali</button>
                </div>
              )}
              {(() => {
                const itemsWithAttachments = (request.items || []).filter(
                  (item) => (item.attachments || []).length > 0
                );
                if (itemsWithAttachments.length === 0) return null;

                return (
                  <div
                    className={`ga-evidence-items-grid grid gap-6 print:gap-2 ${itemsWithAttachments.length > 1
                        ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                        : 'grid-cols-1'
                      }`}
                  >
                    {itemsWithAttachments.map((item) => {
                      const itemAttachments = item.attachments || [];
                      return (
                        <div key={item.id} className="ga-evidence-section">


                          <div
                            className={`ga-evidence-grid grid gap-3 print:gap-2 ${itemsWithAttachments.length === 1
                                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                                : itemAttachments.length > 1
                                  ? 'grid-cols-2'
                                  : 'grid-cols-1'
                              }`}
                          >
                            {itemAttachments.map((file, idx) =>
                              images[file.id] ? (
                                <div key={file.id} className="ga-evidence-card">
                                  <a
                                    href={images[file.id]}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={`Buka bukti harga item ${item.position}, gambar ${idx + 1}`}
                                    className="block group"
                                  >
                                    <img
                                      src={images[file.id]}
                                      alt={`Bukti harga ${item.name}`}
                                      className="ga-evidence-img max-h-60 w-auto max-w-full object-contain rounded-lg hover:opacity-90 transition-opacity print:rounded-none"
                                    />
                                  </a>
                                </div>
                              ) : null
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Status Transition Modal */}
        {request && isModalOpen && (
          <StatusTransitionModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            requestId={request.id}
            currentStatus={request.status}
            onSuccess={reload}
          />
        )}

        {/* Delete Confirmation Modal */}
        {request && (
          <ConfirmDeleteModal
            isOpen={isDeleteModalOpen}
            onClose={() => { if (!deleting) setIsDeleteModalOpen(false); }}
            onConfirm={handleDelete}
            title="Hapus Permintaan Barang?"
            description="Pengajuan yang dihapus tidak dapat dipulihkan kembali. Seluruh data item dan bukti harga terkait akan dihapus secara permanen."
            itemName={requestNumber(request)}
            itemDetails={[
              { label: 'Pemohon', value: capitalizeWords(request.requesterName) },
              { label: 'Tanggal', value: formatFormDate(request.requestDate) },
              { label: 'Status', value: getStatusLabel(request.status) },
            ]}
            confirmText="Hapus Pengajuan"
            variant="danger"
            isLoading={deleting}
            error={deleteError}
          />
        )}
      </main>
    </DashboardLayout>
  );
}
