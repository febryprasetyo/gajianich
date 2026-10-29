import type { DocumentProfileSnapshot } from './documentProfile';
export type GoodsRequestStatus =
  | 'draft'
  | 'ready_to_print'
  | 'pending_signature'
  | 'approved_manually'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export interface GoodsRequestAttachment {
  id: string;
  itemId?: number;
  size: number;
}

export interface GoodsRequestItem {
  id?: number;
  requestId?: string;
  position: number;
  name: string;
  quantity: number;
  estimatedPrice: string | number;
  subtotal: string | number;
  notes: string;
  attachments?: GoodsRequestAttachment[];
  attachmentKeys?: string[];
}

export interface SignedDocument {
  id: string;
  requestId?: string;
  fileName: string;
  size: number;
  createdAt: string;
  uploaderName?: string;
}

export interface StatusLog {
  id: number;
  requestId: string;
  fromStatus: string;
  toStatus: string;
  notes: string;
  createdAt: string;
  changerName?: string;
}

export interface GoodsRequest {
  groupId?: number | null;
  organizationId?: number | null;
  documentProfileSnapshot?: DocumentProfileSnapshot | null;
  documentProfilePreview?: DocumentProfileSnapshot | null;
  documentProfileUnavailable?: boolean;
  id: string;
  title: string;
  purpose: string;
  status: GoodsRequestStatus;
  version: number;
  requestDate: string;
  requesterName: string;
  jobTitle: string;
  division: string;
  createdBy: number;
  createdAt: string;
  creatorName?: string;
  itemCount?: number;
  firstItemName?: string | null;
  matchedItemNames?: string[];
  totalEstimated?: string;
  items?: GoodsRequestItem[];
  signedDocuments?: SignedDocument[];
}

export interface GoodsRequestListResponse {
  items: GoodsRequest[];
  total: number;
  page: number;
  pageSize: number;
}
