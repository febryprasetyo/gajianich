import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db';
import { users, roles } from '../db/schema/users';
import { employees } from '../db/schema/employees';
import { eq, and, ne, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { generateSecureTemporaryPassword, validatePasswordStrength } from '../domain/passwordPolicy';

const createUserSchema = z.object({
  username: z.string().min(3).max(100),
  email: z.string().email().max(255).optional().or(z.literal("")),
  password: z.string().optional(),
  roleId: z.number().int().positive(),
  employeeId: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const updateUserSchema = z.object({
  username: z.string().min(3).max(100),
  email: z.string().email().max(255).optional().or(z.literal("")),
  roleId: z.number().int().positive(),
  employeeId: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const toggleStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().optional(),
}).optional();

async function isLastActiveSuperAdmin(userId: number): Promise<boolean> {
  // Count how many active users have SuperAdmin role or role.code === 'super_admin'
  const superAdminRole = (await db.select().from(roles).where(eq(roles.code, 'super_admin')).limit(1))[0];
  const activeAdmins = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.status, 'active'),
        superAdminRole
          ? eq(users.roleId, superAdminRole.id)
          : eq(users.role, 'SuperAdmin')
      )
    );

  return activeAdmins.length === 1 && activeAdmins[0].id === userId;
}

export async function getUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const userRows = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        mustChangePassword: users.mustChangePassword,
        roleId: users.roleId,
        role: users.role,
        employeeId: users.employeeId,
        status: users.status,
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
      .leftJoin(employees, eq(users.employeeId, employees.id))
      .orderBy(users.id);

    return res.status(200).json({ users: userRows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = createUserSchema.parse(req.body);
    const cleanUsername = parsed.username.trim();

    // Determine email (fallback to employee email or @ams.internal)
    let finalEmail = parsed.email?.trim() || "";
    if (!finalEmail) {
      if (parsed.employeeId) {
        const emp = (await db.select().from(employees).where(eq(employees.id, parsed.employeeId)).limit(1))[0];
        if (emp?.email) {
          finalEmail = emp.email.trim();
        }
      }
      if (!finalEmail) {
        finalEmail = `${cleanUsername.toLowerCase()}@ams.internal`;
      }
    }

    // Check duplicate email
    let existingEmail = await db.select().from(users).where(eq(users.email, finalEmail)).limit(1);
    if (existingEmail.length > 0) {
      if (!parsed.email?.trim()) {
        finalEmail = `${cleanUsername.toLowerCase()}.${Date.now()}@ams.internal`;
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

    // Check employee if provided
    if (parsed.employeeId) {
      const emp = (await db.select().from(employees).where(eq(employees.id, parsed.employeeId)).limit(1))[0];
      if (!emp) {
        return res.status(400).json({ error: 'Selected employee does not exist' });
      }
    }

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

    const [inserted] = await db
      .insert(users)
      .values({
        username: parsed.username,
        email: finalEmail,
        passwordHash,
        mustChangePassword: true,
        roleId: parsed.roleId,
        role: targetRole.name,
        employeeId: parsed.employeeId || null,
        status: parsed.status,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        mustChangePassword: users.mustChangePassword,
        roleId: users.roleId,
        role: users.role,
        employeeId: users.employeeId,
        status: users.status,
        createdAt: users.createdAt,
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
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const existingUser = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const parsed = updateUserSchema.parse(req.body);
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
        finalEmail = `${cleanUsername.toLowerCase()}@ams.internal`;
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
        finalEmail = `${cleanUsername.toLowerCase()}.${Date.now()}@ams.internal`;
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

    // Anti-lockout: if changing role away from SuperAdmin for the last active SuperAdmin
    if (targetRole.code !== 'super_admin') {
      const isLastAdmin = await isLastActiveSuperAdmin(userId);
      if (isLastAdmin) {
        return res.status(400).json({ error: 'Cannot demote the last active SuperAdmin account' });
      }
    }

    // Check employee if provided
    if (parsed.employeeId) {
      const emp = (await db.select().from(employees).where(eq(employees.id, parsed.employeeId)).limit(1))[0];
      if (!emp) {
        return res.status(400).json({ error: 'Selected employee does not exist' });
      }
    }

    const [updated] = await db
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

    return res.status(200).json({ message: 'User updated successfully', user: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function toggleUserStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const parsed = toggleStatusSchema.parse(req.body);

    const existingUser = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

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

    const [updated] = await db
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
      });

    return res.status(200).json({ message: `User status changed to ${parsed.status}`, user: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function resetPassword(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const parsed = resetPasswordSchema ? resetPasswordSchema.parse(req.body) : {};

    const existingUser = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

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

    await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return res.status(200).json({
      message: 'User password reset successfully',
      temporaryPassword: rawPassword,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const existingUser = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
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

    await db.delete(users).where(eq(users.id, userId));

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
