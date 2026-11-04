import type { LeaveDocumentOrganizationOption } from '@/types/documentProfile';

export const ALLOWED_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_LOGO_BYTE_SIZE = 524288; // 512 KB

export function canSelectLeaveOrganization(
  user: { roleName?: string; role?: string; permissions?: string[] } | null | undefined
): boolean {
  if (!user) return false;
  const normRole = String(user.roleName || user.role || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (normRole === 'superadmin') return true;
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  if (perms.includes('*') || perms.includes('attendance.manage')) return true;
  return false;
}

export function resolveDefaultLeaveOrganizationId(
  options: LeaveDocumentOrganizationOption[],
  initialOrganizationId?: number | null
): number | null {
  if (!Array.isArray(options) || options.length === 0) return null;
  if (
    initialOrganizationId != null &&
    options.some((opt) => opt.organizationId === initialOrganizationId)
  ) {
    return initialOrganizationId;
  }
  const def = options.find((opt) => opt.isEmployeeDefault);
  if (def) return def.organizationId;
  return options[0].organizationId;
}

export function stepOrganizationSelectionByKey(
  options: LeaveDocumentOrganizationOption[],
  currentId: number | null,
  key: string
): number | null {
  if (!Array.isArray(options) || options.length === 0) return null;
  const isNext = key === 'ArrowRight' || key === 'ArrowDown';
  const isPrev = key === 'ArrowLeft' || key === 'ArrowUp';
  if (!isNext && !isPrev) return null;

  const idx = options.findIndex((o) => o.organizationId === currentId);
  if (idx === -1) {
    return options[0].organizationId;
  }
  const delta = isNext ? 1 : -1;
  const nextIndex = (idx + delta + options.length) % options.length;
  return options[nextIndex].organizationId;
}

export function validateLogoFileClient(file: {
  type?: string;
  size?: number;
  name?: string;
} | null | undefined): string | null {
  if (!file) return 'Pilih file logo terlebih dahulu.';
  const mime = (file.type || '').toLowerCase();
  const ext = (file.name || '').toLowerCase().split('.').pop() || '';
  if (
    mime === 'image/svg+xml' ||
    ext === 'svg' ||
    !ALLOWED_LOGO_MIME_TYPES.includes(mime as (typeof ALLOWED_LOGO_MIME_TYPES)[number])
  ) {
    return 'Format file tidak didukung. Gunakan PNG, JPG, atau WebP (SVG tidak diizinkan).';
  }
  if (!file.size || file.size <= 0) {
    return 'File logo kosong atau tidak valid.';
  }
  if (file.size > MAX_LOGO_BYTE_SIZE) {
    return 'Ukuran file melebihi batas maksimal 512 KB.';
  }
  return null;
}

