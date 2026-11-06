export type SubscriptionCategory = 'DOMAIN' | 'HOSTING' | 'EMAIL' | 'SSL' | 'SAAS';
export type BillingCycle = 'Tahunan' | 'Bulanan' | '2 Tahun' | '3 Tahun';

export interface SubscriptionItem {
  id: number;
  name: string;
  category: SubscriptionCategory;
  provider: string;
  registeredDomain?: string | null;
  startDate?: string | null;
  expiryDate: string; // YYYY-MM-DD
  renewalCost: number | string;
  billingCycle: BillingCycle;
  autoRenew: boolean;
  loginUrl?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export function getDaysRemaining(expiryDateString: string, nowInput?: Date): number {
  if (!expiryDateString) return 0;
  const now = nowInput ? new Date(nowInput) : new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateString);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function formatRupiah(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : Number(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

export function calculateSubscriptionStats(
  items: SubscriptionItem[],
  nowInput?: Date
): { total: number; expiringSoon: number; expired: number; safe: number } {
  const total = items.length;
  let expiringSoon = 0;
  let expired = 0;
  let safe = 0;

  items.forEach((sub) => {
    const days = getDaysRemaining(sub.expiryDate, nowInput);
    if (days < 0) {
      expired++;
    } else if (days <= 30) {
      expiringSoon++;
    } else {
      safe++;
    }
  });

  return { total, expiringSoon, expired, safe };
}

export function filterSubscriptions(
  items: SubscriptionItem[],
  query: string,
  category: string,
  status: string,
  nowInput?: Date
): SubscriptionItem[] {
  const cleanQ = query.trim().toLowerCase();

  return items.filter((sub) => {
    const days = getDaysRemaining(sub.expiryDate, nowInput);

    // Status filter
    if (status === 'EXPIRED' && days >= 0) return false;
    if (status === 'EXPIRING_SOON' && (days < 0 || days > 30)) return false;
    if (status === 'ACTIVE' && days <= 30) return false;

    // Category filter
    if (category !== 'ALL' && sub.category !== category) return false;

    // Search query (without PIC field)
    if (cleanQ) {
      const matchName = sub.name.toLowerCase().includes(cleanQ);
      const matchDomain = sub.registeredDomain?.toLowerCase().includes(cleanQ) || false;
      const matchProvider = sub.provider.toLowerCase().includes(cleanQ);
      const matchNotes = sub.notes?.toLowerCase().includes(cleanQ) || false;
      return matchName || matchDomain || matchProvider || matchNotes;
    }

    return true;
  });
}
