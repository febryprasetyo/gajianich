import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt';
import { db } from '../db';
import { roles, permissions, rolePermissions } from '../db/schema/users';
import { eq, and, or, inArray } from 'drizzle-orm';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export async function getUserPermissions(roleId?: number, roleName?: string): Promise<string[]> {
  const normRole = (roleName || '').toLowerCase().replace(/_/g, '');
  if (normRole === 'superadmin') {
    const allPerms = await db.select({ code: permissions.code }).from(permissions);
    return allPerms.map((p) => p.code);
  }

  let effectiveRoleId = roleId;
  if (!effectiveRoleId && roleName) {
    const roleRecord = await db
      .select({ id: roles.id })
      .from(roles)
      .where(or(
        eq(roles.name, roleName),
        eq(roles.code, normRole),
        eq(roles.code, normRole === "hrd" ? "hr_attendance" : normRole)
      ))
      .limit(1);
    if (roleRecord.length > 0) {
      effectiveRoleId = roleRecord[0].id;
    }
  }

  if (!effectiveRoleId) return [];

  const rows = await db
    .select({ code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, effectiveRoleId));

  return rows.map((r) => r.code);
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Access token missing' });
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    const path = (req.originalUrl || '').split('?')[0];
    const canCompletePasswordChange =
      (req.method === 'GET' && path === '/api/v1/auth/me') ||
      (req.method === 'POST' && path === '/api/v1/auth/change-password');
    if (payload.mustChangePassword && !canCompletePasswordChange) {
      return res.status(403).json({ error: 'Password change required before accessing the application' });
    }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
  }
}

export function requireRoles(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRoleNormalized = (req.user.roleName || '').toLowerCase().replace(/_/g, '');
    const isAllowed = allowedRoles.some((role) => {
      const allowedRoleNormalized = role.toLowerCase().replace(/_/g, '');
      return userRoleNormalized === allowedRoleNormalized;
    });

    if (allowedRoles.length > 0 && !isAllowed) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }

    next();
  };
}

export function requirePermission(permissionCode: string | string[]) {
  const codes = Array.isArray(permissionCode) ? permissionCode : [permissionCode];

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const normRole = (req.user.roleName || '').toLowerCase().replace(/_/g, '');
    if (normRole === 'superadmin') {
      return next();
    }

    const effectiveRoleId = req.user.roleId;

    try {
      let match: { id: number }[] = [];
      if (effectiveRoleId) {
        match = await db
          .select({ id: rolePermissions.permissionId })
          .from(rolePermissions)
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(
            and(
              eq(rolePermissions.roleId, effectiveRoleId),
              inArray(permissions.code, codes)
            )
          )
          .limit(1);
      }

      if (match.length === 0 && req.user.roleName) {
        const roleByCode = await db
          .select({ id: roles.id })
          .from(roles)
          .where(or(eq(roles.name, req.user.roleName), eq(roles.code, normRole)))
          .limit(1);
        if (roleByCode.length > 0 && roleByCode[0].id !== effectiveRoleId) {
          match = await db
            .select({ id: rolePermissions.permissionId })
            .from(rolePermissions)
            .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
            .where(
              and(
                eq(rolePermissions.roleId, roleByCode[0].id),
                inArray(permissions.code, codes)
              )
            )
            .limit(1);
        }
      }

      if (match.length === 0) {
        if (normRole === 'itadmin' && codes.some((c) => c.startsWith('assets.') || c.startsWith('tickets.') || c.startsWith('licenses.') || c.startsWith('infrastructure.') || c.startsWith('hardware_audits.') || c.startsWith('master.'))) {
          return next();
        }
        if (normRole === 'itstaff' && codes.some((c) => c === 'assets.view' || c === 'assets.assign' || c.startsWith('tickets.') || c === 'licenses.view' || c === 'hardware_audits.view' || c === 'master.view')) {
          return next();
        }
        if ((normRole.includes('hr') || normRole.includes('attendance')) && codes.some((c) => c === 'access.users.view' || c === 'access.users.manage')) {
          return next();
        }
      }

      if (match.length === 0) {
        return res.status(403).json({ error: 'Forbidden: Missing permission ' + codes.join(' or ') });
      }

      return next();
    } catch (err) {
      return res.status(500).json({ error: 'Error checking permissions' });
    }
  };
}
