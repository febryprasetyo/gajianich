'use client';

import React from 'react';
import Image from 'next/image';
import type { AssetHandover } from '@/types/assetHandover';
import { formatHandoverDate, padHandoverItems } from '@/lib/assetHandovers';
import './handoverPrint.css';

interface HandoverDocumentViewProps {
  handover: AssetHandover;
  logoSrc?: string;
}

export function HandoverDocumentView({
  handover,
  logoSrc = '/images/logo-cmc.png',
}: HandoverDocumentViewProps) {
  const formattedDate = formatHandoverDate(handover.handoverDate);
  const itemTypes = (handover.itemTypes || []).map((t) => t.toLowerCase());

  // Checkbox helper
  const isChecked = (type: string) => itemTypes.includes(type.toLowerCase());

  // Table items padded to at least 6 rows to balance the sheet visual
  const paddedItems = padHandoverItems(handover.items || [], 6);

  // Split address into 2 lines if long
  const address = handover.recipientAddress || '';
  let addressLine1 = address;
  let addressLine2 = '';
  if (address.length > 55) {
    const splitIndex = address.lastIndexOf(' ', 55);
    if (splitIndex > 20) {
      addressLine1 = address.slice(0, splitIndex);
      addressLine2 = address.slice(splitIndex + 1);
    }
  }

  return (
    <div className="handover-document-sheet w-full max-w-[210mm] mx-auto bg-white text-black font-sans p-6 sm:p-10 shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0">
      {/* 1. KOP SURAT */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 sm:w-16 sm:h-16 relative flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="Logo Perusahaan"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase leading-tight font-serif">
            {handover.organizationName || 'PT. CAHAYA MAS CEMERLANG'}
          </h1>
          <p className="text-[9px] sm:text-[10px] font-bold tracking-tight text-slate-800 uppercase mt-0.5">
            ENVIRONMENTAL CONTROL & MEDICAL GAS ENGINEERING AND CONTRACTOR
          </p>
        </div>
        {/* Nomor Dokumen di Pojok Kanan Atas */}
        <div className="text-right text-[11px] font-mono font-medium text-slate-500">
          <div>{handover.handoverNumber}</div>
        </div>
      </div>

      {/* 2. KOTAK FORMULIR UTAMA */}
      <div className="border border-black p-4 sm:p-6 space-y-4">
        {/* Banner Judul */}
        <div className="bg-[#78c5f5] border border-black py-1.5 text-center">
          <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-black">
            Form Tanda Terima
          </h2>
        </div>

        {/* Form Metadata Fields */}
        <div className="space-y-2 text-xs sm:text-sm pt-1">
          {/* Tanggal */}
          <div className="flex items-center">
            <span className="w-28 sm:w-32 font-semibold">Tanggal</span>
            <span className="mr-2 font-semibold">:</span>
            <div className="flex-1 border-b border-black pb-0.5 font-medium min-h-[22px]">
              {formattedDate}
            </div>
          </div>

          {/* Nama */}
          <div className="flex items-center">
            <span className="w-28 sm:w-32 font-semibold">Nama</span>
            <span className="mr-2 font-semibold">:</span>
            <div className="flex-1 border-b border-black pb-0.5 font-medium min-h-[22px]">
              {handover.recipientName}
            </div>
          </div>

          {/* Alamat Baris 1 */}
          <div className="flex items-center">
            <span className="w-28 sm:w-32 font-semibold">Alamat</span>
            <span className="mr-2 font-semibold">:</span>
            <div className="flex-1 border-b border-black pb-0.5 font-medium min-h-[22px]">
              {addressLine1}
            </div>
          </div>

          {/* Alamat Baris 2 */}
          <div className="flex items-center">
            <span className="w-28 sm:w-32 font-semibold"></span>
            <span className="mr-2 opacity-0">:</span>
            <div className="flex-1 border-b border-black pb-0.5 font-medium min-h-[22px]">
              {addressLine2}
            </div>
          </div>

          {/* Jabatan */}
          <div className="flex items-center">
            <span className="w-28 sm:w-32 font-semibold">Jabatan</span>
            <span className="mr-2 font-semibold">:</span>
            <div className="flex-1 border-b border-black pb-0.5 font-medium min-h-[22px]">
              {handover.recipientPosition || '-'}
            </div>
          </div>

          {/* Nomor Kontak */}
          <div className="flex items-center">
            <span className="w-28 sm:w-32 font-semibold">Nomor Kontak</span>
            <span className="mr-2 font-semibold">:</span>
            <div className="flex-1 border-b border-black pb-0.5 font-medium min-h-[22px]">
              {handover.recipientPhone || '-'}
            </div>
          </div>
        </div>

        {/* 3. CHECKBOX JENIS BARANG */}
        <div className="pt-2">
          <h3 className="text-xs sm:text-sm font-bold text-black mb-2">
            Jenis Barang
          </h3>

          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-xs sm:text-sm">
            {/* Kolom 1 */}
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-default">
                <span className="w-4 h-4 border border-black inline-flex items-center justify-center font-bold text-xs">
                  {isChecked('laptop') ? '✓' : ''}
                </span>
                <span>Laptop</span>
              </label>

              <label className="flex items-center gap-3 cursor-default">
                <span className="w-4 h-4 border border-black inline-flex items-center justify-center font-bold text-xs">
                  {isChecked('printer') ? '✓' : ''}
                </span>
                <span>Printer</span>
              </label>

              <label className="flex items-center gap-3 cursor-default">
                <span className="w-4 h-4 border border-black inline-flex items-center justify-center font-bold text-xs">
                  {isChecked('mouse') ? '✓' : ''}
                </span>
                <span>Mouse</span>
              </label>
            </div>

            {/* Kolom 2 */}
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-default">
                <span className="w-4 h-4 border border-black inline-flex items-center justify-center font-bold text-xs">
                  {isChecked('monitor') ? '✓' : ''}
                </span>
                <span>Monitor</span>
              </label>

              <label className="flex items-center gap-3 cursor-default">
                <span className="w-4 h-4 border border-black inline-flex items-center justify-center font-bold text-xs">
                  {isChecked('pc') ? '✓' : ''}
                </span>
                <span>PC</span>
              </label>

              <label className="flex items-center gap-3 cursor-default">
                <span className="w-4 h-4 border border-black inline-flex items-center justify-center font-bold text-xs">
                  {isChecked('lainnya') ? '✓' : ''}
                </span>
                <span>
                  Lainya
                  {handover.itemTypesCustom ? ` (${handover.itemTypesCustom})` : ''}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* 4. TABEL RINCIAN BARANG */}
        <div className="pt-2">
          <table className="w-full border-collapse border border-black text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="w-10 border border-black py-1 px-2 text-center font-bold">
                  #
                </th>
                <th className="w-[45%] border border-black py-1 px-3 text-left font-bold">
                  Nama barang
                </th>
                <th className="border border-black py-1 px-3 text-left font-bold">
                  keterangan
                </th>
              </tr>
            </thead>
            <tbody>
              {paddedItems.map((item, idx) => (
                <tr key={idx} className="h-7 sm:h-8">
                  <td className="border border-black px-2 text-center font-medium">
                    {item.itemName ? item.order : ''}
                  </td>
                  <td className="border border-black px-3 font-medium">
                    {item.itemName}
                  </td>
                  <td className="border border-black px-3 text-slate-700">
                    {item.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 5. TANDA TANGAN BERSANDING */}
        <div className="pt-3">
          <div className="grid grid-cols-2 gap-6 sm:gap-10">
            {/* Box Diberikan */}
            <div className="border border-black flex flex-col justify-between">
              <div className="border-b border-black text-center py-1 font-bold text-xs sm:text-sm bg-slate-50/50">
                Diberikan
              </div>
              <div className="h-20 sm:h-24"></div>
              <div className="border-t border-black text-center py-1 text-xs sm:text-sm font-semibold">
                {handover.givenByName || ' '}
              </div>
            </div>

            {/* Box Diterima Oleh */}
            <div className="border border-black flex flex-col justify-between">
              <div className="border-b border-black text-center py-1 font-bold text-xs sm:text-sm bg-slate-50/50">
                Diterima Oleh
              </div>
              <div className="h-20 sm:h-24"></div>
              <div className="border-t border-black text-center py-1 text-xs sm:text-sm font-semibold">
                {handover.receivedByName || handover.recipientName || ' '}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

