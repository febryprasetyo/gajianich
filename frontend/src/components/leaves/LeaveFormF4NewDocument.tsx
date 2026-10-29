'use client';

import React from 'react';
import { documentProfileForRender } from '@/lib/organizationDocumentProfile';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import type { FullLeaveDocumentData } from '@/types/leaves';
import { formatLeaveDocumentDate as dateLabel, formatLeaveHistoryDescription } from '@/lib/leaves/leaveDocumentFormat';
import './leaveF4New.css';

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  return <div className="f4-new-field"><dt>{label}</dt><dd>{children || <span className="f4-new-write-line" />}</dd></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="f4-new-section"><h2>{title}</h2>{children}</section>;
}

export function LeaveFormF4NewDocument({ data }: { data: FullLeaveDocumentData }) {
  const profile = documentProfileForRender(data,'LEAVE');
  if (!profile || profile.layoutKey !== 'cmc-leave-f4-new-v1') return <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Profil dokumen resmi belum tersedia. Pratinjau dan cetak ditahan sampai identitas dan format organisasi disahkan.<Link href="/dashboard/leaves" className="mt-3 block underline">Kembali ke daftar cuti</Link></div>;
  const historyItems = data.detailedHistoryItems ?? data.historyItems;
  const history = Array.from({ length: Math.max(5, historyItems?.length || 0) }, (_, index) => historyItems?.[index]);
  const approvalLabels = profile.signatories.length ? profile.signatories.map(s => s.label) : ['Pemohon', 'Atasan Langsung', 'HRD', 'Atasan dari Atasan Langsung'];

  return (
    <div className="f4-new-view min-w-0 space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-900">Form cuti F4 · Format baru</h1>
          <p className="mt-1 break-all text-xs text-slate-600">No: {data.requestNumber}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/leaves" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"><ArrowLeft className="size-4" /> Kembali</Link>
          <Link href={`/dashboard/leaves/${data.id}/print`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50">Format lama</Link>
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800"><Printer className="size-4" /> Cetak F4 baru</button>
        </div>
      </div>

      <div className="f4-new-preview" role="region" aria-label="Pratinjau dokumen F4 format baru" tabIndex={0}>
        <article className="f4-new-paper" aria-label="Permohonan cuti karyawan">
          <div className="f4-new-letterhead">
            <div className="f4-new-company">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.identity.logoAssetKey} alt={profile.identity.name} width={48} height={48} />
              <strong>{profile.identity.name}</strong>
            </div>
            <div className="f4-new-document-code">
              <div>Form Number : <strong>{profile.labels.formNumber || data.formNumber}</strong></div>
              <div>{profile.labels.revisionCode || data.revisionCode}</div>
            </div>
          </div>
          <div className="f4-new-title">
            <h2>{profile.labels.title || 'PERMOHONAN CUTI KARYAWAN'}</h2>
            <div>No: {data.requestNumber}</div>
          </div>

          <Section title="DATA KARYAWAN">
            <dl className="f4-new-identity">
              <Field label="Nama">{data.employee.fullName}</Field>
              <Field label="Dept/Divisi">{data.employee.department}</Field>
              <Field label="NIP/Absen">{data.employee.employeeCode}</Field>
              <Field label="Jabatan">{data.employee.position}</Field>
              <Field label="Tanggal Bergabung">{dateLabel(data.employee.joinDate) || '-'}</Field>
            </dl>
          </Section>

          <Section title="HAK DAN SISA CUTI KARYAWAN">
            <div className="f4-new-period">Periode Cuti Tahunan <strong>Januari {data.balanceYear} - Desember {data.balanceYear}</strong></div>
            <table className="f4-new-table f4-new-balances"><tbody>
              <tr><th scope="row">Jumlah Hak Cuti Tahunan</th><td>{data.baseQuota} - {data.collectiveLeaveDays} = {data.cleanAnnualQuota} Hari</td></tr>
              <tr><th scope="row">Jumlah Cuti yang sudah diambil sebelumnya</th><td>{Math.max(0, data.cleanAnnualQuota - data.availableBefore)} Hari</td></tr>
            </tbody></table>
            <ol className="f4-new-history">
              {history.map((item, index) => <li key={index} style={{ gridRow: Math.floor(index / 10) * 5 + (index % 5) + 1, gridColumn: Math.floor(index / 5) % 2 + 1 }}><span>{index + 1}.</span><span>{item?.description ? formatLeaveHistoryDescription(item) : <span className="f4-new-write-line" />}</span></li>)}
            </ol>
            <table className="f4-new-table f4-new-balances"><tbody>
              <tr><th scope="row">Sisa Hak Cuti yang bisa diambil</th><td>{data.availableBefore} Hari</td></tr>
              <tr><th scope="row">Cuti yang akan diambil sekarang</th><td>{data.leaveDaysRequested} Hari</td></tr>
              <tr className="f4-new-total"><th scope="row">Sisa Hak Cuti setelah dikurangi Cuti yang akan diambil</th><td>{data.remainingAfter} Hari</td></tr>
            </tbody></table>
          </Section>

          <Section title="CUTI YANG AKAN DIAMBIL">
            <dl>
              <Field label="Alasan Cuti">{data.reason}</Field>
              <Field label="Cuti yang diambil">
                <div className="f4-new-types">
                  <div><span className="f4-new-check">{data.leaveType === 'ANNUAL' ? '✓' : ''}</span> Cuti Tahunan *)</div>
                  <div><span className="f4-new-check">{data.leaveType === 'SPECIAL' ? '✓' : ''}</span> Cuti Khusus (Menikah/Melahirkan/Kematian/Lain-lain) **){data.specialLeaveReason && ` : ${data.specialLeaveReason}`}</div>
                </div>
              </Field>
            </dl>
            <div className="f4-new-dates">
              <div><span>Dari Tanggal</span><strong>{dateLabel(data.startDate)}</strong></div>
              <div><span>s/d Tanggal</span><strong>{dateLabel(data.endDate)}</strong></div>
              <div><span>Jumlah Cuti</span><strong>{data.leaveDaysRequested} Hari</strong></div>
              <div><span>Kembali Bekerja Tgl</span><strong>{dateLabel(data.resumeWorkDate)}</strong></div>
            </div>
          </Section>

          <Section title="CATATAN HRD"><div className="f4-new-notes">{data.hrdNotes || <span className="f4-new-write-line" />}</div></Section>

          <Section title="SERAH TERIMA TUGAS SELAMA CUTI">
            <dl>
              <Field label="Kepada">{data.handover.recipientName}</Field>
              <Field label="Tugas yang akan diserahkan">{data.handover.taskDescription || <div className="f4-new-task-lines"><span className="f4-new-write-line" /><span className="f4-new-write-line" /></div>}</Field>
              <Field label="Nomor Telp yang bisa dihubungi (selama cuti)">{data.handover.emergencyPhone}</Field>
              <div className="f4-new-recipient"><dt>Tanda Tangan Penerima</dt><dd>( <span className="f4-new-write-line" /> )</dd></div>
            </dl>
          </Section>

          <Section title="KOLOM TANDA TANGAN PERSETUJUAN">
            <table className="f4-new-table f4-new-signatures">
              <thead><tr>{approvalLabels.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
              <tbody>
                <tr>{approvalLabels.map(label => <td key={label} className="f4-new-signature-space" />)}</tr>
                <tr>{approvalLabels.map((label, index) => <td key={label}><div>Nama : {index === 0 ? <strong>{data.employee.fullName}</strong> : profile.signatories[index]?.name || <span className="f4-new-write-line" />}</div><div>Tanggal : <span className="f4-new-write-line" /></div></td>)}</tr>
              </tbody>
            </table>
          </Section>

          <div className="f4-new-footnotes">
            <strong>Note :</strong>
            <ol>
              <li>Pengajuan Permohonan Cuti minimal 3 hari kerja sebelum pelaksanaan cuti</li>
              <li>Maximum 6 hari kerja secara berurutan dalam 1 kali pengajuan</li>
              <li>Jika melebihi batas max (poin 2) akan dikenai Penalti</li>
            </ol>
            <div className="f4-new-legends"><span>*) Check List yang diperlukan</span><span>**) Check List dan Lingkari Yang Diperlukan</span></div>
          </div>
        </article>
      </div>
    </div>
  );
}
