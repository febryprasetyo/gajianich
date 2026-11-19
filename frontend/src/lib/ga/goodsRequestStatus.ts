export type GoodsRequestStatus =
  | 'draft'
  | 'ready_to_print'
  | 'pending_signature'
  | 'approved_manually'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export const STATUS_LABELS: Record<GoodsRequestStatus, string> = {
  draft: 'Draft',
  ready_to_print: 'Menunggu Persetujuan',
  pending_signature: 'Menunggu Tanda Tangan',
  approved_manually: 'Disetujui',
  processing: 'Diproses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  rejected: 'Ditolak',
};

export const ALLOWED_STATUS_TRANSITIONS: Record<GoodsRequestStatus, GoodsRequestStatus[]> = {
  draft: ['approved_manually', 'rejected'],
  ready_to_print: ['approved_manually', 'rejected'],
  pending_signature: ['approved_manually', 'rejected'],
  approved_manually: ['cancelled'],
  processing: ['approved_manually', 'rejected'],
  completed: [],
  cancelled: [],
  rejected: [],
};

export function getStatusLabel(status: GoodsRequestStatus): string {
  return STATUS_LABELS[status] || status;
}

export function getAllowedTransitions(currentStatus: GoodsRequestStatus): GoodsRequestStatus[] {
  return ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
}

export interface StatusBadgeConfig {
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
}

export function getStatusBadgeConfig(status: GoodsRequestStatus): StatusBadgeConfig {
  switch (status) {
    case 'approved_manually':
    case 'completed':
      return {
        bgClass: 'bg-emerald-100',
        textClass: 'text-emerald-800',
        borderClass: 'border-emerald-300',
        dotClass: 'bg-emerald-1000',
      };
    case 'ready_to_print':
    case 'pending_signature':
      return {
        bgClass: 'bg-amber-100',
        textClass: 'text-amber-800',
        borderClass: 'border-amber-300',
        dotClass: 'bg-amber-1000',
      };
    case 'processing':
      return {
        bgClass: 'bg-teal-100',
        textClass: 'text-teal-800',
        borderClass: 'border-teal-300',
        dotClass: 'bg-teal-500',
      };
    case 'rejected':
      return {
        bgClass: 'bg-rose-100',
        textClass: 'text-rose-800',
        borderClass: 'border-rose-300',
        dotClass: 'bg-rose-1000',
      };
    case 'cancelled':
    case 'draft':
    default:
      return {
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-800',
        borderClass: 'border-slate-300',
        dotClass: 'bg-slate-600',
      };
  }
}

export function getStatusSelectionClass(status: GoodsRequestStatus | 'all'): string {
  switch (status) {
    case 'rejected':
      return 'border-rose-700 bg-rose-50 ring-1 ring-inset ring-rose-700';
    case 'draft':
    case 'cancelled':
      return 'border-slate-600 bg-slate-100 ring-1 ring-inset ring-slate-600';
    default:
      return 'border-emerald-700 bg-emerald-50 ring-1 ring-inset ring-emerald-700';
  }
}

export function isRequestEditable(status?: string | null): boolean {
  if (!status) return false;
  return ['draft', 'ready_to_print', 'pending_signature'].includes(status);
}
