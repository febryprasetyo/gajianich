import { Request, Response } from 'express';
import { AuthenticatedRequest, getUserPermissions } from '../middleware/auth';
import { db } from '../db';
import { users, roles } from '../db/schema/users';
import { employees } from '../db/schema/employees';
import { eq, or, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { generateToken } from '../utils/jwt';
import { z } from 'zod';
import { validatePasswordStrength } from '../domain/passwordPolicy';
import { loadOrganizationAccess } from '../services/organizationScope';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export async function login(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = loginSchema.parse(req.body);
    const cleanUsername = parsed.username.trim();

    const userResult = await db.select()
      .from(users)
      .where(sql`lower(${users.username}) = lower(${cleanUsername})`)
      .limit(1);

    if (userResult.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = userResult[0];

    // Case-insensitive status check
    const normalizedStatus = (user.status || '').toLowerCase();
    if (normalizedStatus !== 'active') {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const isMatch = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    let userRoleId = user.roleId;
    if (!userRoleId && user.role) {
      const norm = user.role.toLowerCase().replace(/_/g, '');
      const matched = await db
        .select({ id: roles.id })
        .from(roles)
        .where(or(eq(roles.name, user.role), eq(roles.code, norm)))
        .limit(1);
      if (matched.length > 0) {
        userRoleId = matched[0].id;
        await db.update(users).set({ roleId: userRoleId }).where(eq(users.id, user.id));
      }
    }

    const userPermissions = await getUserPermissions(userRoleId ?? undefined, user.role);

    const token = generateToken({
      userId: user.id,
      email: user.email || "",
      username: user.username,
      roleId: userRoleId ?? 0,
      roleName: user.role,
      permissions: userPermissions,
      mustChangePassword: Boolean(user.mustChangePassword),
    });

    return res.status(200).json({
      message: 'Login successful',
      token,
      mustChangePassword: Boolean(user.mustChangePassword),
      user: {
        id: user.id,
        username: user.username,
        email: user.email || "",
        fullName: user.username,
        roleId: userRoleId ?? undefined,
        roleName: user.role,
        employeeId: user.employeeId ?? null,
        permissions: userPermissions,
        mustChangePassword: Boolean(user.mustChangePassword),
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues || err.message });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const parsed = changePasswordSchema.parse(req.body);

    // Validate password complexity according to policy
    const policyResult = validatePasswordStrength(parsed.newPassword);
    if (!policyResult.isValid) {
      return res.status(400).json({ error: policyResult.error });
    }

    const userResult = await db.select()
      .from(users)
      .where(eq(users.id, req.user.userId))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult[0];
    const passwordHash = await bcrypt.hash(parsed.newPassword, 10);

    await db.update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const userPermissions = await getUserPermissions(user.roleId ?? undefined, user.role);

    const token = generateToken({
      userId: user.id,
      email: user.email || "",
      username: user.username,
      roleId: user.roleId ?? 0,
      roleName: user.role,
      permissions: userPermissions,
      mustChangePassword: false,
    });

    return res.status(200).json({
      message: 'Password changed successfully',
      token,
      mustChangePassword: false,
      user: {
        id: user.id,
        username: user.username,
        email: user.email || "",
        fullName: user.username,
        roleId: user.roleId ?? undefined,
        roleName: user.role,
        permissions: userPermissions,
        mustChangePassword: false,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues || err.message });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function me(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const userPermissions = await getUserPermissions(req.user.roleId, req.user.roleName);
    const access = await loadOrganizationAccess(req.user.userId);
    return res.status(200).json({
      user: { ...req.user, permissions: userPermissions, ...access },
    });
  } catch {
    return res.status(503).json({ error: 'Account access temporarily unavailable' });
  }
}

const activateAccountSchema = z.object({
  token: z.string().min(1, 'Token aktivasi wajib diisi'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Konfirmasi password tidak cocok',
  path: ['confirmPassword'],
});

export async function getActivationInfo(req: Request, res: Response) {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    if (!token) {
      return res.status(400).json({ valid: false, error: 'Token aktivasi tidak disertakan' });
    }

    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        status: users.status,
        activationTokenExpiresAt: users.activationTokenExpiresAt,
        employeeName: employees.fullName,
        employeeCode: employees.employeeCode,
      })
      .from(users)
      .leftJoin(employees, eq(users.employeeId, employees.id))
      .where(eq(users.activationToken, token))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({
        valid: false,
        error: 'Tautan aktivasi tidak valid atau sudah digunakan.',
      });
    }

    const targetUser = rows[0];

    // Check expiration
    if (targetUser.activationTokenExpiresAt && new Date(targetUser.activationTokenExpiresAt) < new Date()) {
      return res.status(400).json({
        valid: false,
        error: 'Tautan aktivasi telah kedaluwarsa. Silakan hubungi admin HR untuk tautan baru.',
      });
    }

    return res.status(200).json({
      valid: true,
      username: targetUser.username,
      fullName: targetUser.employeeName || targetUser.username,
      employeeCode: targetUser.employeeCode || null,
    });
  } catch (err: any) {
    return res.status(500).json({ valid: false, error: err.message || 'Internal server error' });
  }
}

export async function activateAccount(req: Request, res: Response) {
  try {
    const parsed = activateAccountSchema.parse(req.body);

    const policy = validatePasswordStrength(parsed.password);
    if (!policy.isValid) {
      return res.status(400).json({ error: policy.error });
    }

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.activationToken, parsed.token.trim()))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Tautan aktivasi tidak valid atau sudah digunakan.',
      });
    }

    const targetUser = rows[0];

    if (targetUser.activationTokenExpiresAt && new Date(targetUser.activationTokenExpiresAt) < new Date()) {
      return res.status(400).json({
        error: 'Tautan aktivasi telah kedaluwarsa. Silakan hubungi admin HR untuk tautan baru.',
      });
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10);

    // Update user: activate account, clear activation token
    await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        activationToken: null,
        activationTokenExpiresAt: null,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUser.id));

    const userPermissions = await getUserPermissions(targetUser.roleId ?? undefined, targetUser.role);

    const token = generateToken({
      userId: targetUser.id,
      email: targetUser.email || '',
      username: targetUser.username,
      roleId: targetUser.roleId ?? 0,
      roleName: targetUser.role,
      permissions: userPermissions,
      mustChangePassword: false,
    });

    return res.status(200).json({
      message: 'Akun berhasil diaktifkan',
      token,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email || '',
        roleId: targetUser.roleId ?? undefined,
        roleName: targetUser.role,
        permissions: userPermissions,
        mustChangePassword: false,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validasi gagal', details: err.issues });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
