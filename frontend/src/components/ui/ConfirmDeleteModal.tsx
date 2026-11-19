'use client';

import React, { useEffect, useCallback } from 'react';
import { Trash2, AlertTriangle, AlertCircle, Loader2, X } from 'lucide-react';
import {
  ConfirmDetailItem,
  ConfirmVariant,
  resolveConfirmText,
  resolveVariantStyles,
} from '@/lib/confirmModal';

export type { ConfirmDetailItem, ConfirmVariant };

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  itemName?: string | null;
  itemDetails?: ConfirmDetailItem[];
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  isLoading?: boolean;
  error?: string | null;
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  itemDetails,
  confirmText,
  cancelText = 'Batal',
  variant = 'danger',
  isLoading = false,
  error = null,
}: ConfirmDeleteModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    },
    [isLoading, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const resolvedConfirmText = resolveConfirmText(variant, confirmText);
  const { iconContainerClass, confirmButtonClass } = resolveVariantStyles(variant);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-150 relative">
        {/* Close Button */}
        {!isLoading && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            title="Tutup dialog"
            className="absolute top-4 right-4 p-2 min-h-10 min-w-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Icon Header */}
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto shadow-inner ${iconContainerClass}`}
        >
          {variant === 'danger' ? (
            <Trash2 className="w-6 h-6" />
          ) : (
            <AlertTriangle className="w-6 h-6" />
          )}
        </div>

        {/* Title & Description */}
        <div className="text-center space-y-1.5">
          <h3 id="confirm-modal-title" className="text-base font-bold text-slate-900">
            {title}
          </h3>
          {description && (
            <div className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              {description}
            </div>
          )}
        </div>

        {/* Item Summary / Details Card */}
        {(itemName || (itemDetails && itemDetails.length > 0)) && (
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs">
            {itemName && !itemDetails && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-medium">Data Terpilih:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[240px]">
                  {itemName}
                </span>
              </div>
            )}
            {itemDetails?.map((detail, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-medium shrink-0">{detail.label}:</span>
                <span className="font-semibold text-slate-800 text-right truncate max-w-[240px]">
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* In-modal Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1">
              <span className="font-bold block">Gagal Melakukan Tindakan:</span>
              <span className="text-rose-600">{error}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isLoading}
            className={`px-4 py-2 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${confirmButtonClass}`}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isLoading ? 'Memproses...' : resolvedConfirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
