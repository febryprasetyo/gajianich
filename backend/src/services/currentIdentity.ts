import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { db } from '../db';
import { users, roles } from '../db/schema/users';
import type { TokenPayload } from '../utils/jwt';
export async function loadCurrentIdentity(userId: number, database: Pick<NodePgDatabase, 'select'> = db): Promise<(TokenPayload & {isGlobalAdministrator: boolean}) | null> {
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;
  const [row] = await database.select({id: users.id, username: users.username, email: users.email,
    roleId: users.roleId, legacyRole: users.role, status: users.status, mustChangePassword: users.mustChangePassword,
    roleName: roles.name, roleCode: roles.code}).from(users).leftJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, userId)).limit(1);
  if (!row || row.status.toLowerCase() !== 'active') return null;
  const normalize = (value: string) => value.toLowerCase().replace(/_/g, '');
  const isGlobalAdministrator = row.roleId === null ? normalize(row.legacyRole) === 'superadmin' : normalize(row.roleCode ?? '') === 'superadmin';
  return {userId: row.id, username: row.username, email: row.email, roleId: row.roleId ?? 0,
    roleName: row.roleId === null ? row.legacyRole : row.roleName ?? '',
    mustChangePassword: row.mustChangePassword, isGlobalAdministrator};
}
