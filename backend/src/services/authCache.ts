import type { NextFunction, Request, Response } from 'express';
import { getOrSetCache, invalidateCache } from '../lib/redis';

const IDENTITY_TTL_SECONDS = 60;
const PERMISSIONS_TTL_SECONDS = 300;

/** Identity lookup cached per user. A null result (inactive/missing account) is never cached. */
export function getCachedIdentity<T>(userId: number, loader: () => Promise<T | null>): Promise<T | null> {
  return getOrSetCache(`auth:identity:${userId}`, IDENTITY_TTL_SECONDS, loader);
}

/** Permission codes cached per role (by id, or by normalized name when the id is unknown). */
export function getCachedPermissions(
  roleId: number | undefined,
  roleName: string | undefined,
  loader: () => Promise<string[]>
): Promise<string[]> {
  const scope = roleId ? `id:${roleId}` : `name:${(roleName || '').toLowerCase().replace(/_/g, '')}`;
  return getOrSetCache(`auth:perms:${scope}`, PERMISSIONS_TTL_SECONDS, loader);
}

/** Drop every cached identity and permission set. Mutations are rare, so coarse invalidation is safest. */
export async function invalidateAuthCache(): Promise<void> {
  await invalidateCache('auth:*');
}

/** Express middleware: after a successful non-GET response, flush the auth caches. */
export function invalidateAuthOnSuccessfulMutation(req: Request, res: Response, next: NextFunction): void {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void invalidateAuthCache();
      }
    });
  }
  next();
}
