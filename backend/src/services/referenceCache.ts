import type { NextFunction, Request, Response } from 'express';
import type { RequestScope } from '../domain/organizationAccess';
import { getOrSetCache, invalidateCache } from '../lib/redis';

const REF_TTL_SECONDS = 600;       // 10 minutes for reference data
const KPI_TTL_SECONDS = 60;        // 60 seconds for KPI / summaries
const ADMS_PIN_TTL_SECONDS = 3600; // 1 hour for ADMS PIN mappings

export type MasterDataType = 'departments' | 'locations' | 'vendors';

/**
 * Formats an organization RequestScope into a deterministic, collision-free cache key segment.
 * Prevents cross-organization data leakage between CMC, MGM, and Global Admin views.
 */
export function formatScopeKey(scope?: RequestScope | null): string {
  if (!scope) return 'global';
  const sortedGroups = [...new Set(scope.groupIds)]
    .filter((id) => Number.isSafeInteger(id) && id > 0)
    .sort((a, b) => a - b);
  const groupsPart = sortedGroups.length > 0 ? sortedGroups.join(',') : 'none';
  const unmappedPart = scope.includeUnmapped ? '1' : '0';
  const selectedPart = scope.selectedGroupId !== null && scope.selectedGroupId !== undefined
    ? String(scope.selectedGroupId)
    : 'all';
  return `g:${groupsPart}:u:${unmappedPart}:s:${selectedPart}`;
}

export function getCachedAssetCategories<T>(
  scope: RequestScope | null | undefined,
  loader: () => Promise<T>
): Promise<T> {
  return getOrSetCache(`ref:asset-categories:${formatScopeKey(scope)}`, REF_TTL_SECONDS, loader);
}

export async function invalidateAssetCategoriesCache(): Promise<void> {
  await Promise.all([
    invalidateCache('ref:asset-categories:*'),
    invalidateCache('kpi:assets:*'),
  ]);
}

export function getCachedMasterData<T>(
  type: MasterDataType,
  scope: RequestScope | null | undefined,
  loader: () => Promise<T>
): Promise<T> {
  return getOrSetCache(`ref:master:${type}:${formatScopeKey(scope)}`, REF_TTL_SECONDS, loader);
}

export async function invalidateMasterDataCache(type?: MasterDataType): Promise<void> {
  if (!type) {
    await Promise.all([
      invalidateCache('ref:master:*'),
      invalidateCache('auth:org-access:*'),
      invalidateCache('kpi:assets:*'),
    ]);
    return;
  }
  const tasks: Promise<void>[] = [invalidateCache(`ref:master:${type}:*`)];
  if (type === 'departments' || type === 'locations') {
    tasks.push(invalidateCache('auth:org-access:*'));
    tasks.push(invalidateCache('kpi:assets:*'));
  }
  await Promise.all(tasks);
}

export function getCachedAssetDashboardSummary<T>(
  scope: RequestScope | null | undefined,
  loader: () => Promise<T>
): Promise<T> {
  return getOrSetCache(`kpi:assets:${formatScopeKey(scope)}`, KPI_TTL_SECONDS, loader);
}

export async function invalidateAssetKpiCache(): Promise<void> {
  await invalidateCache('kpi:assets:*');
}

export function getCachedAttendanceSummary<T>(
  scopeKey: string,
  date: string,
  loader: () => Promise<T>
): Promise<T> {
  return getOrSetCache(`attendance:summary:${scopeKey}:${date}`, KPI_TTL_SECONDS, loader);
}

export async function invalidateAttendanceSummaryCache(): Promise<void> {
  await invalidateCache('attendance:summary:*');
}

export function getCachedAdmsPin(
  groupId: number,
  pin: string,
  loader: () => Promise<number | null>
): Promise<number | null> {
  return getOrSetCache(`adms:pin:${groupId}:${pin.trim()}`, ADMS_PIN_TTL_SECONDS, loader);
}

export async function invalidateAdmsPinCache(groupId?: number): Promise<void> {
  await invalidateCache(groupId !== undefined ? `adms:pin:${groupId}:*` : 'adms:pin:*');
}

/**
 * Express middleware that flushes the given cache patterns after a successful (2xx) non-GET request.
 */
export function invalidateCacheOnMutation(patterns: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          void Promise.all(patterns.map((p) => invalidateCache(p)));
        }
      });
    }
    next();
  };
}
