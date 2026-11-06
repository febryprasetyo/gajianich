'use client';

import React, { useEffect, useCallback, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  maxWidthClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  isLoading?: boolean;
  showCloseButton?: boolean;
  ariaLabelledBy?: string;
  fullScreen?: boolean;
}

export default function ModalShell({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  maxWidthClass = 'max-w-xl',
  children,
  footer,
  isLoading = false,
  showCloseButton = true,
  ariaLabelledBy,
  fullScreen = false,
}: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const titleId = ariaLabelledBy ?? generatedId;

  // Use refs to stabilize callbacks and prevent re-triggering focus effects on every keystroke
  const onCloseRef = useRef(onClose);
  const isLoadingRef = useRef(isLoading);

  useEffect(() => {
    onCloseRef.current = onClose;
    isLoadingRef.current = isLoading;
  }, [onClose, isLoading]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isLoadingRef.current) {
      onCloseRef.current();
    }
    if (e.key === 'Tab') {
      const elements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
      );
      if (!elements?.length) {
        e.preventDefault();
        return;
      }
      const first = elements[0],
        last = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Only focus the dialog container once upon initial modal open, not on every re-render
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      className={fullScreen ? 'fixed inset-0 z-[100] flex overflow-hidden bg-slate-950' : 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-hidden'}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={fullScreen ? 'relative flex h-dvh w-full flex-col overflow-hidden outline-none' : `bg-white rounded-2xl shadow-2xl border border-slate-200 w-full ${maxWidthClass} max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden relative outline-none`}
      >
        {/* Header */}
        {fullScreen && title && <h3 id={titleId} className="sr-only">{title}</h3>}
        {!fullScreen && (title || showCloseButton) && (
          <div className="shrink-0 flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  {icon}
                </div>
              )}
              <div>
                {title && (
                  <h3 id={titleId} className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {showCloseButton && !isLoading && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup modal"
                className="min-h-10 min-w-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Scrollable Body Content */}
        <div className={fullScreen ? 'relative min-h-0 flex-1' : 'p-5 sm:p-6 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4'}>
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
  return fullScreen ? createPortal(dialog, document.body) : dialog;
}
