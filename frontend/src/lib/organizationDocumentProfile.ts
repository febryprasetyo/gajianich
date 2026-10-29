import type { DocumentProfileSnapshot } from '@/types/documentProfile';
export function documentProfileForRender(data: {documentProfileSnapshot?: DocumentProfileSnapshot | null; documentProfilePreview?: DocumentProfileSnapshot | null; status?: string}, kind: 'LEAVE' | 'GA'): DocumentProfileSnapshot | null {
  const profile = data.documentProfileSnapshot ?? (['draft','DRAFT'].includes(data.status ?? '') ? data.documentProfilePreview : null);
  if (!profile || profile.kind !== kind || !profile.identity?.logoAssetKey || !profile.identity?.name) return null;
  const layouts = kind === 'GA' ? ['cmc-ga-v1'] : ['cmc-leave-f4-v1','cmc-leave-f4-new-v1'];
  return layouts.includes(profile.layoutKey) ? profile : null;
}
