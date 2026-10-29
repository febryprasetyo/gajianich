'use client';

import React from 'react';
import { documentProfileForRender } from '@/lib/organizationDocumentProfile';
import type { FullLeaveDocumentData } from '@/types/leaves';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface LeaveFormF4DocumentProps {
  data: FullLeaveDocumentData;
  backHref?: string;
  printActions?: React.ReactNode;
}

export function LeaveFormF4Document({ data, backHref = '/dashboard/leaves', printActions }: LeaveFormF4DocumentProps) {
  const profile = documentProfileForRender(data,'LEAVE');
  if (!profile || profile.layoutKey !== 'cmc-leave-f4-v1') return <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Profil dokumen resmi belum tersedia. Pratinjau dan cetak ditahan sampai identitas dan format organisasi disahkan.<Link href="/dashboard/leaves" className="mt-3 block underline">Kembali ke daftar cuti</Link></div>;
  const handlePrint = () => {
    window.print();
  };

  const formatDateIndo = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:bg-white text-black font-sans">
      {/* Action Bar (Hanya Tampil di Layar / Hidden saat Print) */}
      <div className="max-w-[215mm] mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 no-print bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link
            href={backHref}
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-600" /> Kembali
          </Link>
          <div>
            <h1 className="text-base font-bold text-slate-800">Form Permohonan Cuti - No: {data.requestNumber}</h1>
            
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {printActions}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Dokumen F4 Single Full Page Container */}
      <div
        className="f4-page mx-auto bg-white border border-slate-300 shadow-md print:shadow-none print:border-none print:m-0 box-border"
        style={{
          width: '215mm',
          minHeight: '320mm',
          maxHeight: '330mm',
          padding: '10mm 12mm 8mm 12mm',
          fontSize: '11px',
          lineHeight: '1.25',
          fontFamily: 'Calibri, Arial, sans-serif',
        }}
      >
        <style jsx global>{`
          @page {
            size: 215mm 330mm;
            margin: 8mm 10mm 8mm 10mm;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              background-color: transparent !important;
            }
            .no-print {
              display: none !important;
            }
            .f4-page {
              width: 100% !important;
              max-height: 314mm !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
              page-break-after: avoid !important;
              page-break-inside: avoid !important;
            }
          }
          .table-f4 {
            width: 100%;
            border-collapse: collapse;
          }
          .table-f4 th, .table-f4 td {
            border: 1px solid #000;
            padding: 3px 5px;
            vertical-align: middle;
          }
          .section-title {
            background-color: #f2f2f2 !important;
            font-weight: bold;
            font-size: 11.5px;
            border: 1px solid #000;
            padding: 3px 6px;
            letter-spacing: 0.3px;
          }
        `}</style>

        {/* 1. Header Dokumen (Logo, Company, Form No, Rev) */}
        <div className="flex items-center justify-between pb-2 border-b border-black mb-2">
          <div className="flex items-center gap-3">
            <img
              src={profile.identity.logoAssetKey}
              alt={profile.identity.name}
              className="h-10 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <span className="text-base font-bold tracking-tight text-black block">{profile.identity.name}</span>
            </div>
          </div>
          <div className="text-right text-[10.5px] leading-tight font-sans">
            <div>Form Number : <span className="font-semibold">{profile.labels.formNumber || data.formNumber}</span></div>
            <div className="text-[9.5px] text-gray-700">{profile.labels.revisionCode || data.revisionCode}</div>
          </div>
        </div>

        {/* Judul Utama Box */}
        <div className="border-2 border-black py-1 text-center font-bold text-sm tracking-wider uppercase mb-2 bg-[#f8f8f8]">
          {profile.labels.title || 'PERMOHONAN CUTI KARYAWAN'}
        </div>

        {/* 2. Seksi DATA KARYAWAN */}
        <div className="mb-2">
          <div className="section-title">DATA KARYAWAN</div>
          <table className="table-f4 text-[10.5px] border-t-0">
            <tbody>
              <tr>
                <td className="w-[18%] font-medium">Nama</td>
                <td className="w-[1%] text-center border-l-0 border-r-0">:</td>
                <td className="w-[39%] border-l-0 font-semibold">{data.employee.fullName}</td>
                <td className="w-[18%] font-medium">Dept/Divisi</td>
                <td className="w-[1%] text-center border-l-0 border-r-0">:</td>
                <td className="w-[23%] border-l-0 font-semibold">{data.employee.department}</td>
              </tr>
              <tr>
                <td className="font-medium">NIP/Absen</td>
                <td className="text-center border-l-0 border-r-0">:</td>
                <td className="border-l-0">{data.employee.employeeCode}</td>
                <td className="font-medium">Jabatan</td>
                <td className="text-center border-l-0 border-r-0">:</td>
                <td className="border-l-0">{data.employee.position}</td>
              </tr>
              <tr>
                <td className="font-medium">Tanggal Bergabung</td>
                <td className="text-center border-l-0 border-r-0">:</td>
                <td colSpan={4} className="border-l-0 font-medium">{formatDateIndo(data.employee.joinDate) || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3. Seksi HAK DAN SISA CUTI KARYAWAN */}
        <div className="mb-2">
          <div className="section-title">HAK DAN SISA CUTI KARYAWAN</div>
          <table className="table-f4 text-[10.5px]">
            <tbody>
              <tr>
                <td className="w-[60%]">Periode Cuti Tahunan</td>
                <td className="w-[2%] text-center border-l-0 border-r-0">:</td>
                <td className="w-[38%] border-l-0" colSpan={2}>Januari {data.balanceYear} - Desember {data.balanceYear}</td>
              </tr>
              <tr>
                <td>Jumlah Hak Cuti Tahunan</td>
                <td className="text-center border-l-0 border-r-0">:</td>
                <td className="border-l-0 font-medium">
                  {data.baseQuota} - {data.collectiveLeaveDays} = {data.cleanAnnualQuota}
                </td>
                <td className="w-[15%] text-right font-medium">Hari</td>
              </tr>
              <tr>
                <td>Jumlah Cuti yang sudah diambil sebelumnya</td>
                <td className="text-center border-l-0 border-r-0">:</td>
                <td className="border-l-0 font-medium">
                  {Math.max(0, data.cleanAnnualQuota - data.availableBefore)}
                </td>
                <td className="text-right font-medium">Hari</td>
              </tr>

              {/* Rincian Cuti yang Sudah Diambil Sebelumnya (Bila > 5 maka terbagi 2 kiri & kanan) */}
              {(() => {
                const items = data.historyItems || [];
                const activeItems = items.filter(h => h.description);
                const isTwoColumn = activeItems.length > 5 || items.length > 5;

                if (isTwoColumn) {
                  // Terbagi 2 Kolom Kiri (1-5) dan Kanan (6-10), penomoran menjorok ke tengah
                  return [0, 1, 2, 3, 4].map((idx) => {
                    const leftItem = items[idx];
                    const rightItem = items[idx + 5];
                    return (
                      <tr key={idx} className="h-[18px]">
                        {/* Kolom Kiri 1 - 5 */}
                        <td colSpan={2} className="pl-8 pr-2 text-[10px] border-r border-black">
                          <span className="inline-block w-4 font-semibold">{idx + 1}.</span>{' '}
                          <span>{leftItem?.description || ''}</span>
                        </td>
                        {/* Kolom Kanan 6 - 10 */}
                        <td colSpan={2} className="pl-8 pr-2 text-[10px]">
                          {rightItem && rightItem.description ? (
                            <>
                              <span className="inline-block w-5 font-semibold">{idx + 6}.</span>{' '}
                              <span>{rightItem.description}</span>
                            </>
                          ) : (items.length > 5 && idx + 6 <= items.length) ? (
                            <span className="text-gray-400">
                              <span className="inline-block w-5 font-semibold text-black">{idx + 6}.</span>
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  });
                }

                // Default <= 5: 1 Kolom dengan penomoran menjorok ke tengah (pl-10)
                const paddedItems = items.length >= 5 ? items.slice(0, 5) : [
                  ...items,
                  ...Array(5 - items.length).fill(null).map((_, i) => ({ no: items.length + i + 1, description: '' }))
                ];

                return paddedItems.map((item, idx) => (
                  <tr key={idx} className="h-[18px]">
                    <td colSpan={4} className="pl-10 text-[10px]">
                      <span className="inline-block w-4 font-semibold">{idx + 1}.</span>{' '}
                      <span>{item.description || ''}</span>
                    </td>
                  </tr>
                ));
              })()}

              <tr>
                <td>Sisa Hak Cuti yang bisa diambil</td>
                <td className="text-center border-l-0 border-r-0">:</td>
                <td className="border-l-0 font-bold">{data.availableBefore}</td>
                <td className="text-right font-medium">Hari</td>
              </tr>
              <tr>
                <td>Cuti yang akan diambil sekarang</td>
                <td className="text-center border-l-0 border-r-0">:</td>
                <td className="border-l-0 font-bold">{data.leaveDaysRequested}</td>
                <td className="text-right font-medium">Hari</td>
              </tr>
              <tr>
                <td className="font-semibold">Sisa Hak Cuti setelah dikurangi Cuti yang akan diambil</td>
                <td className="text-center border-l-0 border-r-0">:</td>
                <td className="border-l-0 font-bold text-base">{data.remainingAfter}</td>
                <td className="text-right font-medium">Hari</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 4. Seksi CUTI YANG AKAN DIAMBIL */}
        <div className="mb-2">
          <div className="section-title">CUTI YANG AKAN DIAMBIL</div>
          <table className="table-f4 text-[10.5px]">
            <tbody>
              <tr>
                <td className="w-[20%]">Alasan Cuti</td>
                <td className="w-[2%] text-center border-l-0 border-r-0">:</td>
                <td className="border-l-0 font-medium" colSpan={4}>{data.reason}</td>
              </tr>
              <tr>
                <td rowSpan={2} className="align-top pt-1">Cuti yang diambil</td>
                <td rowSpan={2} className="text-center border-l-0 border-r-0 align-top pt-1">:</td>
                <td className="border-l-0" colSpan={4}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-4 h-4 border border-black text-xs font-bold">
                      {data.leaveType === 'ANNUAL' ? '✓' : ''}
                    </span>
                    <span>Cuti Tahunan *)</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td className="border-l-0" colSpan={4}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-4 h-4 border border-black text-xs font-bold">
                      {data.leaveType === 'SPECIAL' ? '✓' : ''}
                    </span>
                    <span>
                      Cuti Khusus (Menikah/Melahirkan/Kematian/Lain-lain) **)
                      {data.specialLeaveReason && ` : ${data.specialLeaveReason}`}
                    </span>
                  </div>
                </td>
              </tr>
              <tr>
                <td>Dari Tanggal</td>
                <td className="text-center border-l-0 border-r-0">:</td>
                <td className="border-l-0 font-semibold">{formatDateIndo(data.startDate)}</td>
                <td className="w-[14%] text-center">s/d Tanggal :</td>
                <td className="font-semibold">{formatDateIndo(data.endDate)}</td>
                <td className="w-[14%] text-right font-bold">( {data.leaveDaysRequested} Hari )</td>
              </tr>
              <tr>
                <td>Kembali Bekerja Tgl</td>
                <td className="text-center border-l-0 border-r-0">:</td>
                <td colSpan={4} className="border-l-0 font-bold text-black">
                  {formatDateIndo(data.resumeWorkDate)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 5. Seksi CATATAN HRD */}
        <div className="mb-2">
          <div className="section-title">CATATAN HRD</div>
          <div className="border border-black border-t-0 p-2 min-h-[40px] text-[10px]">
            {data.hrdNotes || <span className="text-transparent">.</span>}
          </div>
        </div>

        {/* 6. Seksi SERAH TERIMA TUGAS SELAMA CUTI (Revisi 3: Kosongan Format Garis untuk Tulis Tangan) */}
        <div className="mb-2">
          <div className="section-title">SERAH TERIMA TUGAS SELAMA CUTI</div>
          <table className="table-f4 text-[10.5px]">
            <tbody>
              <tr>
                <td className="w-[30%]">Kepada</td>
                <td className="w-[2%] text-center border-l-0 border-r-0">:</td>
                <td className="border-l-0 tracking-widest text-gray-400">
                  ....................................................................................................................
                </td>
              </tr>
              <tr>
                <td className="align-top pt-1.5 font-medium">Tugas yang akan diserahkan</td>
                <td className="text-center border-l-0 border-r-0 align-top pt-1.5">:</td>
                <td className="border-l-0 py-1 text-[10px]">
                  {data.handover.taskDescription ? (
                    <div className="font-medium text-black">{data.handover.taskDescription}</div>
                  ) : (
                    <div className="space-y-1 tracking-widest text-gray-400 leading-normal">
                      <div>....................................................................................................................</div>
                      <div>....................................................................................................................</div>
                    </div>
                  )}
                </td>
              </tr>
              <tr>
                <td>
                  <div>Nomor Telp yang bisa dihubungi</div>
                  <div className="text-[9.5px] italic text-gray-700">(selama cuti)</div>
                </td>
                <td className="text-center border-l-0 border-r-0">:</td>
                <td className="border-l-0 font-medium">
                  {data.handover.emergencyPhone ? (
                    <span className="font-semibold text-black">{data.handover.emergencyPhone}</span>
                  ) : (
                    <span className="tracking-widest text-gray-400">
                      ....................................................................................................................
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="h-[64px] pb-1 font-medium align-bottom" style={{ verticalAlign: 'bottom' }}>
                  Tanda Tangan Penerima
                </td>
                <td className="text-center border-l-0 border-r-0 pb-1 align-bottom" style={{ verticalAlign: 'bottom' }}>
                  :
                </td>
                <td className="border-l-0 pb-1 text-[9.5px] text-gray-600 align-bottom" style={{ verticalAlign: 'bottom' }}>
                  <div className="pt-6 italic">( ............................................................ )</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 7. Seksi KOLOM TANDA TANGAN PERSETUJUAN */}
        <div className="mb-2">
          <div className="section-title text-center">KOLOM TANDA TANGAN PERSETUJUAN</div>
          <table className="table-f4 text-[10px] text-center border-t-0">
            <thead>
              <tr className="bg-slate-50 font-semibold">
                <td className="w-[25%] py-1">{profile.signatories[0]?.label || 'Pemohon'}</td>
                <td className="w-[25%] py-1">{profile.signatories[1]?.label || 'Atasan Langsung'}</td>
                <td className="w-[25%] py-1">{profile.signatories[2]?.label || 'HRD'}</td>
                <td className="w-[25%] py-1">{profile.signatories[3]?.label || 'Atasan dari Atasan Langsung'}</td>
              </tr>
            </thead>
            <tbody>
              {/* Kotak Tanda Tangan Manual (Kosong polos untuk tanda tangan basah) */}
              <tr className="h-[56px]">
                <td className="align-middle"></td>
                <td className="align-middle"></td>
                <td className="align-middle"></td>
                <td className="align-middle"></td>
              </tr>
              {/* Nama & Tanggal untuk TDD Manual */}
              <tr className="text-left text-[9.5px] leading-tight">
                <td className="p-1.5">
                  <div>Nama : <span className="font-semibold">{data.employee.fullName}</span></div>
                  <div>Tanggal : <span className="text-gray-400">..........................</span></div>
                </td>
                <td className="p-1.5">
                  <div>Nama : <span className="text-gray-400">{profile.signatories[1]?.name || '...................................'}</span></div>
                  <div>Tanggal : <span className="text-gray-400">..........................</span></div>
                </td>
                <td className="p-1.5">
                  <div>Nama : <span className="text-gray-400">{profile.signatories[2]?.name || '...................................'}</span></div>
                  <div>Tanggal : <span className="text-gray-400">..........................</span></div>
                </td>
                <td className="p-1.5">
                  <div>Nama : <span className="text-gray-400">{profile.signatories[3]?.name || '...................................'}</span></div>
                  <div>Tanggal : <span className="text-gray-400">..........................</span></div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 8. Footer Catatan Kaki & Note Resmi */}
        <div className="pt-1.5 border-t border-black space-y-1">
          <div className="text-[9px] text-black">
            <div className="font-bold">Note :</div>
            <ol className="list-decimal list-inside pl-1 space-y-0.5 leading-snug">
              <li>Pengajuan Permohonan Cuti minimal 3 hari kerja sebelum pelaksanaan cuti</li>
              <li>Maximum 6 hari kerja secara berurutan dalam 1 kali pengajuan</li>
              <li>Jika melebihi batas max (poin 2) akan dikenai Penalti</li>
            </ol>
          </div>
          <div className="text-[8.5px] text-gray-600 pt-0.5 flex items-center justify-between border-t border-dotted border-gray-300">
            <div>*) Check List yang diperlukan</div>
            <div>**) Check List dan Lingkari Yang Diperlukan</div>
          </div>
        </div>
      </div>
    </div>
  );
}
