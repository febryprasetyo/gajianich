import { Response } from 'express';
import { AuthenticatedRequest, getUserPermissions } from '../middleware/auth';
import { db } from '../db';
import { users, roles } from '../db/schema/users';
import { eq, or, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { generateToken } from '../utils/jwt';
import { z } from 'zod';
import { validatePasswordStrength } from '../domain/passwordPolicy';

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
  const userPermissions = await getUserPermissions(req.user.roleId, req.user.roleName);
  return res.status(200).json({
    user: {
      ...req.user,
      permissions: userPermissions,
    },
  });
}
