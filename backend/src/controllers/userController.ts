import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db';
import { users, roles } from '../db/schema/users';
import { employees } from '../db/schema/employees';
import { departments } from '../db/schema/master';
import { eq, and, ne, sql, or, isNull, inArray } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { generateSecureTemporaryPassword, validatePasswordStrength } from '../domain/passwordPolicy';
import { generateSmartUsernames } from '../domain/usernameGenerator';
import crypto from 'crypto';
import {
  normalizeIndonesianPhoneNumber,
  generateAccountBlastMessage,
  generateActivationBlastMessage,
  sendWhatsAppMessage,
} from '../services/whatsappService';
import { accountAccess, accountListPredicate, assertAccountTarget, validateAccountAssignment, withAccountMutation, replaceAccountGroups } from '../services/userOrganizationScope';
import type { OrganizationScopedRequest } from '../middleware/organizationScope';
import { userOrganizationGroupAccess } from '../db/schema/organizations';

const createUserSchema = z.object({
  username: z.string().min(3).max(100),
  email: z.string().email().max(255).optional().or(z.literal("")).nullable(),
  password: z.string().optional(),
  roleId: z.number().int().positive(),
  employeeId: z.number().int().positive().nullable().optional(),
  groupIds: z.array(z.number().int().positive()).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const updateUserSchema = z.object({
  username: z.string().min(3).max(100),
  email: z.string().email().max(255).optional().or(z.literal("")).nullable(),
  roleId: z.number().int().positive(),
  employeeId: z.number().int().positive().nullable().optional(),
  groupIds: z.array(z.number().int().positive()).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const toggleStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().optional(),
}).optional();

export function isCallerHrd(req: AuthenticatedRequest): boolean {
  const normRole = (req.user?.roleName || '').toLowerCase().replace(/[\s_-]+/g, '');
  return normRole.startsWith('hrattendance') || normRole === 'hrd';
}

async function isLastActiveSuperAdmin(userId: number): Promise<boolean> {
  // Count how many active users have SuperAdmin role or role.code === 'super_admin'
  const superAdminRole = (await db.select().from(roles).where(eq(roles.code, 'super_admin')).limit(1))[0];
  const activeAdmins = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.status, 'active'),
        or(superAdminRole ? eq(users.roleId,superAdminRole.id):undefined,
          and(isNull(users.roleId),sql`replace(lower(${users.role}),'_','')='superadmin'`))
      )
    );

  return activeAdmins.length === 1 && activeAdmins[0].id === userId;
}

export async function getUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const isHrd = isCallerHrd(req);
    const access = await accountAccess(req);
    const predicate = accountListPredicate(access, (req as OrganizationScopedRequest).organizationScope?.selectedGroupId ?? null);
    const query = db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        mustChangePassword: users.mustChangePassword,
        roleId: users.roleId,
        role: users.role,
        employeeId: users.employeeId,
        status: users.status,
        whatsappNotifiedAt: users.whatsappNotifiedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        roleCode: roles.code,
        roleName: roles.name,
        roleIsSystem: roles.isSystem,
        employeeName: employees.fullName,
        employeeCode: employees.employeeCode,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(employees, eq(users.employeeId, employees.id));

    const userRows = isHrd
      ? await query.where(and(predicate,eq(roles.code, 'employee'))).orderBy(users.id)
      : await query.where(predicate).orderBy(users.id);
    const memberships = await db.select().from(userOrganizationGroupAccess);

    return res.status(200).json({ users: userRows.map(user=>({...user,groupIds:memberships.filter(m=>m.userId===user.id).map(m=>m.groupId)})) });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = createUserSchema.parse(req.body);
    await validateAccountAssignment(req,parsed);
    const cleanUsername = parsed.username.trim();

    // Determine email (fallback to employee email or @gajianich.internal)
    let finalEmail = parsed.email?.trim() || "";
    if (!finalEmail) {
      if (parsed.employeeId) {
        const emp = (await db.select().from(employees).where(eq(employees.id, parsed.employeeId)).limit(1))[0];
        if (emp?.email) {
          finalEmail = emp.email.trim();
        }
      }
      if (!finalEmail) {
        finalEmail = `${cleanUsername.toLowerCase()}@gajianich.internal`;
      }
    }

    // Check duplicate email
    let existingEmail = await db.select().from(users).where(eq(users.email, finalEmail)).limit(1);
    if (existingEmail.length > 0) {
      if (!parsed.email?.trim()) {
        finalEmail = `${cleanUsername.toLowerCase()}.${Date.now()}@gajianich.internal`;
      } else {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
    }

    // Check duplicate username
    const existingUsername = await db.select().from(users).where(eq(users.username, parsed.username)).limit(1);
    if (existingUsername.length > 0) {
      return res.status(400).json({ error: 'User with this username already exists' });
    }

    // Check role exists
    const targetRole = (await db.select().from(roles).where(eq(roles.id, parsed.roleId)).limit(1))[0];
    if (!targetRole) {
      return res.status(400).json({ error: 'Selected role does not exist' });
    }

    // HRD scope restriction: HRD can only create Employee user accounts
    if (isCallerHrd(req) && targetRole.code !== 'employee') {
      return res.status(403).json({ error: 'Forbidden: HRD is only permitted to create Employee user accounts' });
    }

    // Check employee if provided in create
    if (parsed.employeeId) {
      const emp = (await db.select().from(employees).where(eq(employees.id, parsed.employeeId)).limit(1))[0];
      if (!emp) {
        return res.status(400).json({ error: 'Selected employee does not exist' });
      }

      // Strict 1 Employee = 1 Account: Check if employee already has an account
      const existingAccount = (await db.select({ id: users.id, username: users.username }).from(users).where(eq(users.employeeId, parsed.employeeId)).limit(1))[0];
      if (existingAccount) {
        return res.status(400).json({
          error: `Karyawan "${emp.fullName}" sudah memiliki akun pengguna (${existingAccount.username}). 1 karyawan hanya boleh memiliki 1 akun.`,
        });
      }

      // HRD caller cannot bind user to their own employee record
      if (isCallerHrd(req) && req.user?.userId) {
        const [caller] = await db.select({ employeeId: users.employeeId }).from(users).where(eq(users.id, req.user.userId)).limit(1);
        if (caller?.employeeId === parsed.employeeId) {
          return res.status(403).json({
            error: 'Forbidden: HRD tidak diizinkan membuat akun tambahan untuk diri sendiri.',
          });
        }
      }
    }

    // Password generation: if provided, validate complexity; if not, generate secure temporary password
    let rawPassword = parsed.password;
    if (rawPassword) {
      const policyCheck = validatePasswordStrength(rawPassword);
      if (!policyCheck.isValid) {
        return res.status(400).json({ error: policyCheck.error });
      }
    } else {
      rawPassword = generateSecureTemporaryPassword(12);
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const inserted = await db.transaction(async tx => {
    const groupIds=await validateAccountAssignment(req,parsed,[],tx);
    const [created] = await tx
      .insert(users)
      .values({
        username: parsed.username,
        email: finalEmail,
        passwordHash,
        mustChangePassword: true, // Must change on first login
        roleId: parsed.roleId,
        role: targetRole.name,
        employeeId: parsed.employeeId || null,
        status: parsed.status,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        roleId: users.roleId,
        role: users.role,
        employeeId: users.employeeId,
        status: users.status,
        mustChangePassword: users.mustChangePassword,
        createdAt: users.createdAt,
      });
    await replaceAccountGroups(tx,created.id,groupIds);
    return {...created,groupIds};
    });

    return res.status(201).json({
      message: 'User created successfully',
      user: inserted,
      temporaryPassword: rawPassword,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    const ownership = await assertAccountTarget(req,userId);

    const existing = (
      await db
        .select({ user: users, roleCode: roles.code })
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.id, userId))
        .limit(1)
    )[0];
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }
    const existingUser = existing.user;

    // HRD scope restriction: HRD can only manage accounts with role 'employee'
    if (isCallerHrd(req) && existing.roleCode !== 'employee') {
      return res.status(403).json({ error: 'Forbidden: HRD can only manage Employee user accounts' });
    }

    const parsed = updateUserSchema.parse(req.body);
    await validateAccountAssignment(req,parsed,ownership.groupIds);
    const cleanUsername = parsed.username.trim();

    let finalEmail = parsed.email?.trim() || existingUser.email;
    if (!finalEmail) {
      if (parsed.employeeId) {
        const emp = (await db.select().from(employees).where(eq(employees.id, parsed.employeeId)).limit(1))[0];
        if (emp?.email) {
          finalEmail = emp.email.trim();
        }
      }
      if (!finalEmail) {
        finalEmail = `${cleanUsername.toLowerCase()}@gajianich.internal`;
      }
    }

    // Check duplicate email
    const duplicateEmail = await db
      .select()
      .from(users)
      .where(and(eq(users.email, finalEmail), ne(users.id, userId)))
      .limit(1);
    if (duplicateEmail.length > 0) {
      if (!parsed.email?.trim()) {
        finalEmail = `${cleanUsername.toLowerCase()}.${Date.now()}@gajianich.internal`;
      } else {
        return res.status(400).json({ error: 'Email is already used by another user' });
      }
    }

    // Check duplicate username
    const duplicateUsername = await db
      .select()
      .from(users)
      .where(and(eq(users.username, parsed.username), ne(users.id, userId)))
      .limit(1);
    if (duplicateUsername.length > 0) {
      return res.status(400).json({ error: 'Username is already used by another user' });
    }

    // Check role exists
    const targetRole = (await db.select().from(roles).where(eq(roles.id, parsed.roleId)).limit(1))[0];
    if (!targetRole) {
      return res.status(400).json({ error: 'Selected role does not exist' });
    }

    // HRD scope restriction: HRD cannot assign roles other than Employee
    if (isCallerHrd(req) && targetRole.code !== 'employee') {
      return res.status(403).json({ error: 'Forbidden: HRD cannot assign roles other than Employee' });
    }

    // Anti-lockout: if changing role away from SuperAdmin for the last active SuperAdmin
    if (targetRole.code !== 'super_admin') {
      const isLastAdmin = await isLastActiveSuperAdmin(userId);
      if (isLastAdmin) {
        return res.status(400).json({ error: 'Cannot demote the last active SuperAdmin account' });
      }
    }

    // Check employee if provided in update
    if (parsed.employeeId) {
      const emp = (await db.select().from(employees).where(eq(employees.id, parsed.employeeId)).limit(1))[0];
      if (!emp) {
        return res.status(400).json({ error: 'Selected employee does not exist' });
      }

      // Strict 1 Employee = 1 Account: Check if employee already has another account
      const existingAccount = (await db.select({ id: users.id, username: users.username }).from(users).where(and(eq(users.employeeId, parsed.employeeId), ne(users.id, userId))).limit(1))[0];
      if (existingAccount) {
        return res.status(400).json({
          error: `Karyawan "${emp.fullName}" sudah memiliki akun pengguna (${existingAccount.username}). 1 karyawan hanya boleh memiliki 1 akun.`,
        });
      }

      // HRD caller cannot bind user to their own employee record
      if (isCallerHrd(req) && req.user?.userId && existingUser.id !== req.user.userId) {
        const [caller] = await db.select({ employeeId: users.employeeId }).from(users).where(eq(users.id, req.user.userId)).limit(1);
        if (caller?.employeeId === parsed.employeeId) {
          return res.status(403).json({
            error: 'Forbidden: HRD tidak diizinkan mengubah akun menjadi milik diri sendiri.',
          });
        }
      }
    }
    const updated = await withAccountMutation(req,userId,async tx=>{
    const groupIds=await validateAccountAssignment(req,parsed,ownership.groupIds,tx);
    const [changed] = await tx
      .update(users)
      .set({
        username: parsed.username,
        email: finalEmail,
        roleId: parsed.roleId,
        role: targetRole.name,
        employeeId: parsed.employeeId || null,
        status: parsed.status || existingUser.status,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        roleId: users.roleId,
        role: users.role,
        employeeId: users.employeeId,
        status: users.status,
        updatedAt: users.updatedAt,
      });
    await replaceAccountGroups(tx,userId,groupIds);
    return {...changed,groupIds};
    });

    return res.status(200).json({ message: 'User updated successfully', user: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}

export async function toggleUserStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    await assertAccountTarget(req,userId);

    const existing = (
      await db
        .select({ user: users, roleCode: roles.code })
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.id, userId))
        .limit(1)
    )[0];
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }
    const existingUser = existing.user;

    // HRD scope restriction: HRD can only manage accounts with role 'employee'
    if (isCallerHrd(req) && existing.roleCode !== 'employee') {
      return res.status(403).json({ error: 'Forbidden: HRD can only manage Employee user accounts' });
    }

    const parsed = toggleStatusSchema.parse(req.body);

    // Anti-lockout: Cannot deactivate own account
    if (req.user && req.user.userId === userId && parsed.status === 'inactive') {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    // Anti-lockout: Cannot deactivate last active SuperAdmin
    if (parsed.status === 'inactive') {
      const isLastAdmin = await isLastActiveSuperAdmin(userId);
      if (isLastAdmin) {
        return res.status(400).json({ error: 'Cannot deactivate the last active SuperAdmin account' });
      }
    }

    const [updated] = await withAccountMutation(req,userId,tx=>tx
      .update(users)
      .set({
        status: parsed.status,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        status: users.status,
        updatedAt: users.updatedAt,
      }));

    return res.status(200).json({ message: `User status changed to ${parsed.status}`, user: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}

export async function resetPassword(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    await assertAccountTarget(req,userId);

    const existing = (
      await db
        .select({ user: users, roleCode: roles.code })
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.id, userId))
        .limit(1)
    )[0];
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    // HRD scope restriction: HRD can only manage accounts with role 'employee'
    if (isCallerHrd(req) && existing.roleCode !== 'employee') {
      return res.status(403).json({ error: 'Forbidden: HRD can only manage Employee user accounts' });
    }

    const parsed = resetPasswordSchema ? resetPasswordSchema.parse(req.body) : {};

    let rawPassword = parsed?.newPassword;
    if (rawPassword) {
      const policyCheck = validatePasswordStrength(rawPassword);
      if (!policyCheck.isValid) {
        return res.status(400).json({ error: policyCheck.error });
      }
    } else {
      rawPassword = generateSecureTemporaryPassword(12);
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);

    await withAccountMutation(req,userId,tx=>tx
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId)));

    return res.status(200).json({
      message: 'User password reset successfully',
      temporaryPassword: rawPassword,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    await assertAccountTarget(req,userId);

    const existing = (
      await db
        .select({ user: users, roleCode: roles.code })
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.id, userId))
        .limit(1)
    )[0];
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    // HRD scope restriction: HRD can only manage accounts with role 'employee'
    if (isCallerHrd(req) && existing.roleCode !== 'employee') {
      return res.status(403).json({ error: 'Forbidden: HRD can only manage Employee user accounts' });
    }

    // Anti-lockout: Cannot delete own account
    if (req.user && req.user.userId === userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Anti-lockout: Cannot delete last active SuperAdmin
    const isLastAdmin = await isLastActiveSuperAdmin(userId);
    if (isLastAdmin) {
      return res.status(400).json({ error: 'Cannot delete the last active SuperAdmin account' });
    }

    await withAccountMutation(req,userId,tx=>tx.delete(users).where(eq(users.id, userId)));

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (err: any) {
    if (err && (err.code === '23503' || (err.message && err.message.includes('foreign key constraint')))) {
      return res.status(400).json({
        error: 'Tidak dapat menghapus pengguna karena masih memiliki riwayat data terkait (seperti permohonan pengadaan barang, log transaksi, atau audit). Silakan nonaktifkan akun terlebih dahulu.',
      });
    }
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}

export async function getUnprovisionedSummary(req: AuthenticatedRequest, res: Response) {
  try {
    const activeEmployees = await db
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        fullName: employees.fullName,
        phone: employees.phone,
        mobilePhone: employees.mobilePhone,
        email: employees.email,
        departmentId: employees.departmentId,
        departmentName: departments.name,
        userId: users.id,
        username: users.username,
        whatsappNotifiedAt: users.whatsappNotifiedAt,
      })
      .from(employees)
      .leftJoin(users, eq(users.employeeId, employees.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(eq(employees.status, 'Active'))
      .orderBy(employees.fullName);

    const items = activeEmployees.map(emp => {
      const rawPhone = emp.phone || emp.mobilePhone || null;
      const normalizedPhone = normalizeIndonesianPhoneNumber(rawPhone);
      return {
        id: emp.id,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        department: emp.departmentName || null,
        phone: rawPhone,
        normalizedPhone,
        hasValidPhone: Boolean(normalizedPhone),
        email: emp.email || null,
        hasAccount: Boolean(emp.userId),
        userId: emp.userId || null,
        username: emp.username || null,
        whatsappNotifiedAt: emp.whatsappNotifiedAt ? emp.whatsappNotifiedAt.toISOString() : null,
      };
    });

    const unprovisioned = items.filter(i => !i.hasAccount);
    const unnotified = items.filter(i => i.hasAccount && !i.whatsappNotifiedAt);

    return res.status(200).json({
      totalActiveEmployees: items.length,
      unprovisionedCount: unprovisioned.length,
      unnotifiedCount: unnotified.length,
      employees: items,
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}

const bulkProvisionSchema = z.object({
  employeeIds: z.array(z.number().int().positive()).optional(),
  sendWhatsApp: z.boolean().default(false),
  loginUrl: z.string().optional(),
});

export async function bulkProvisionAndBlast(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = bulkProvisionSchema.parse(req.body);

    // Fetch active employees who do not yet have an account
    let query = db
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        fullName: employees.fullName,
        phone: employees.phone,
        mobilePhone: employees.mobilePhone,
        email: employees.email,
      })
      .from(employees)
      .leftJoin(users, eq(users.employeeId, employees.id))
      .where(and(eq(employees.status, 'Active'), isNull(users.id)))
      .orderBy(employees.id);

    const unprovisionedList = await query;
    let targetEmployees = unprovisionedList;

    if (parsed.employeeIds && parsed.employeeIds.length > 0) {
      const allowedIds = new Set(parsed.employeeIds);
      targetEmployees = unprovisionedList.filter(emp => allowedIds.has(emp.id));
    }

    if (targetEmployees.length === 0) {
      return res.status(200).json({
        total: 0,
        created: 0,
        whatsappSent: 0,
        whatsappFailed: 0,
        whatsappSkipped: 0,
        results: [],
      });
    }

    // Role check: must assign standard Employee role
    const employeeRole = (
      await db.select().from(roles).where(eq(roles.code, 'employee')).limit(1)
    )[0];
    if (!employeeRole) {
      return res.status(500).json({ error: 'Default employee role not found in system' });
    }

    // Load existing usernames to ensure zero collisions
    const existingUsers = await db.select({ username: users.username }).from(users);
    const existingUsernames = new Set(existingUsers.map(u => u.username.toLowerCase()));

    // Generate smart usernames based on employee names and collision rules
    const usernameMap = generateSmartUsernames(targetEmployees, existingUsernames);

    const origin = (typeof req.get === 'function' && (req.get('origin') || `${req.protocol}://${req.get('host')}`)) || 'http://localhost:3000';
    const loginUrl = parsed.loginUrl || `${origin}/login`;

    let createdCount = 0;
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    const results: Array<{
      employeeId: number;
      fullName: string;
      username: string;
      phone: string | null;
      normalizedPhone?: string | null;
      temporaryPassword: string;
      activationToken?: string;
      activationUrl?: string;
      whatsappMessage?: string;
      whatsappLink?: string | null;
      whatsappStatus: 'sent' | 'failed' | 'skipped_no_phone' | 'disabled';
      whatsappError?: string;
    }> = [];

    for (let i = 0; i < targetEmployees.length; i++) {
      const emp = targetEmployees[i];
      const username = usernameMap.get(emp.id) || `emp${emp.id}`;
      const tempPassword = generateSecureTemporaryPassword(10);
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const cleanEmail = emp.email?.trim() || `${username}@gajianich.internal`;

      // Generate 48-hour secure activation token
      const activationToken = crypto.randomBytes(32).toString('hex');
      const activationTokenExpiresAt = new Date(Date.now() + 48 * 3600 * 1000);
      const activationUrl = `${origin}/activate?token=${activationToken}`;

      // Insert new user
      const [createdUser] = await db
        .insert(users)
        .values({
          username,
          email: cleanEmail,
          passwordHash,
          mustChangePassword: true,
          roleId: employeeRole.id,
          role: employeeRole.name,
          employeeId: emp.id,
          status: 'active',
          activationToken,
          activationTokenExpiresAt,
        })
        .returning({ id: users.id, username: users.username });

      createdCount++;

      // Handle WhatsApp blast
      const rawPhone = emp.phone || emp.mobilePhone || null;
      const normalizedPhone = normalizeIndonesianPhoneNumber(rawPhone);

      // Generate pre-formatted ready-to-copy WhatsApp message with Magic Activation Link
      const whatsappMessage = generateActivationBlastMessage({
        fullName: emp.fullName,
        username,
        activationUrl,
      });

      const whatsappLink = normalizedPhone
        ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(whatsappMessage)}`
        : null;

      let whatsappStatus: 'sent' | 'failed' | 'skipped_no_phone' | 'disabled' = 'disabled';
      let whatsappError: string | undefined;

      if (parsed.sendWhatsApp) {
        if (normalizedPhone) {
          const sendResult = await sendWhatsAppMessage({
            to: normalizedPhone,
            message: whatsappMessage,
          });

          if (sendResult.success) {
            whatsappStatus = 'sent';
            sentCount++;
            await db
              .update(users)
              .set({ whatsappNotifiedAt: new Date() })
              .where(eq(users.id, createdUser.id));
          } else {
            whatsappStatus = 'failed';
            whatsappError = sendResult.error;
            failedCount++;
          }

          // Polite pacing: 1200ms delay between consecutive WhatsApp requests
          if (i < targetEmployees.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1200));
          }
        } else {
          whatsappStatus = 'skipped_no_phone';
          skippedCount++;
        }
      }

      results.push({
        employeeId: emp.id,
        fullName: emp.fullName,
        username,
        phone: rawPhone,
        normalizedPhone,
        temporaryPassword: tempPassword,
        activationToken,
        activationUrl,
        whatsappMessage,
        whatsappLink,
        whatsappStatus,
        whatsappError,
      });
    }

    return res.status(201).json({
      total: targetEmployees.length,
      created: createdCount,
      whatsappSent: sentCount,
      whatsappFailed: failedCount,
      whatsappSkipped: skippedCount,
      results,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}

export async function blastUserWhatsApp(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    await assertAccountTarget(req, userId);

    const userRow = (
      await db
        .select({
          id: users.id,
          username: users.username,
          employeeId: users.employeeId,
          fullName: employees.fullName,
          phone: employees.phone,
          mobilePhone: employees.mobilePhone,
        })
        .from(users)
        .leftJoin(employees, eq(users.employeeId, employees.id))
        .where(eq(users.id, userId))
        .limit(1)
    )[0];

    if (!userRow) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!userRow.employeeId) {
      return res.status(400).json({ error: 'User is not linked to any employee record' });
    }

    const rawPhone = userRow.phone || userRow.mobilePhone || null;
    const normalizedPhone = normalizeIndonesianPhoneNumber(rawPhone);
    if (!normalizedPhone) {
      return res.status(400).json({
        error: 'Nomor WhatsApp karyawan belum terisi atau tidak valid (harus nomor handphone Indonesia yang valid)',
      });
    }

    // Generate fresh 48-hour activation token for the resend
    const activationToken = crypto.randomBytes(32).toString('hex');
    const activationTokenExpiresAt = new Date(Date.now() + 48 * 3600 * 1000);

    const tempPassword = generateSecureTemporaryPassword(10);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: true,
        activationToken,
        activationTokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    const origin = (typeof req.get === 'function' && (req.get('origin') || `${req.protocol}://${req.get('host')}`)) || 'http://localhost:3000';
    const activationUrl = `${origin}/activate?token=${activationToken}`;

    const message = generateActivationBlastMessage({
      fullName: userRow.fullName || userRow.username,
      username: userRow.username,
      activationUrl,
    });

    const whatsappLink = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;

    const sendResult = await sendWhatsAppMessage({
      to: normalizedPhone,
      message,
    });

    if (sendResult.success) {
      await db
        .update(users)
        .set({ whatsappNotifiedAt: new Date() })
        .where(eq(users.id, userId));
    }

    return res.status(200).json({
      message: sendResult.success
        ? 'Tautan aktivasi berhasil dikirim via WhatsApp Gateway'
        : 'Tautan aktivasi siap disalin & dikirim ke WhatsApp',
      phone: normalizedPhone,
      activationToken,
      activationUrl,
      whatsappMessage: message,
      whatsappLink,
      gatewaySent: sendResult.success,
      gatewayError: sendResult.error,
      whatsappNotifiedAt: sendResult.success ? new Date().toISOString() : null,
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}
