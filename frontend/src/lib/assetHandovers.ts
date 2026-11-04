import { api } from './api';
import type {
  AssetHandover,
  HandoverStats,
  HandoverFormInput,
  HandoverListResponse,
  AssetHandoverItem,
} from '@/types/assetHandover';

export const HANDOVER_ITEM_TYPE_OPTIONS = [
  { id: 'laptop', label: 'Laptop' },
  { id: 'monitor', label: 'Monitor' },
  { id: 'printer', label: 'Printer' },
  { id: 'pc', label: 'PC' },
  { id: 'mouse', label: 'Mouse' },
  { id: 'lainnya', label: 'Lainya' },
] as const;

export function getItemTypeLabel(type: string): string {
  const match = HANDOVER_ITEM_TYPE_OPTIONS.find((opt) => opt.id === type.toLowerCase());
  return match ? match.label : type;
}

export function formatHandoverDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return dateStr;
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
  } catch {
    return dateStr;
  }
}

export function padHandoverItems(
  items: Array<Partial<AssetHandoverItem>> = [],
  minRows = 6
): Array<{ order: number; itemName: string; description: string }> {
  const result: Array<{ order: number; itemName: string; description: string }> = [];

  items.forEach((item, index) => {
    result.push({
      order: item.itemOrder || index + 1,
      itemName: item.itemName || '',
      description: item.description || '',
    });
  });

  const currentCount = result.length;
  for (let i = currentCount; i < minRows; i++) {
    result.push({
      order: i + 1,
      itemName: '',
      description: '',
    });
  }

  return result;
}

export async function fetchHandovers(params: {
  search?: string;
  itemType?: string;
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<HandoverListResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.itemType) query.set('itemType', params.itemType);
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const url = `/assets/handovers${query.toString() ? `?${query.toString()}` : ''}`;
  return await api.get<HandoverListResponse>(url);
}

export async function fetchHandoverStats(): Promise<HandoverStats> {
  return await api.get<HandoverStats>('/assets/handovers/stats');
}

export async function fetchHandoverById(id: number | string): Promise<AssetHandover> {
  return await api.get<AssetHandover>(`/assets/handovers/${id}`);
}

export async function createHandover(data: HandoverFormInput): Promise<AssetHandover> {
  return await api.post<AssetHandover>('/assets/handovers', data);
}

export async function updateHandover(id: number | string, data: HandoverFormInput): Promise<AssetHandover> {
  return await api.put<AssetHandover>(`/assets/handovers/${id}`, data);
}

export async function deleteHandover(id: number | string): Promise<{ success: boolean }> {
  return await api.delete<{ success: boolean }>(`/assets/handovers/${id}`);
}

