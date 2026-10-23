import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs } from '../db/schema/system';
import { users } from '../db/schema/users';
import { generateToken } from '../utils/jwt';

/** Each integration test owns its operator; no seeded user IDs are required. */
export async function createTestOperator() {
  const suffix = randomUUID();
  const [user] = await db.insert(users).values({
    username: `test-operator-${suffix}`,
    email: `test-operator-${suffix}@example.test`,
    passwordHash: 'test-fixture-no-password-login',
    role: 'SuperAdmin',
  }).returning();

  return {
    userId: user.id,
    email: user.email || "",
    token(roleName = 'SuperAdmin') {
      return generateToken({ userId: user.id, email: user.email, roleId: user.id, roleName });
    },
    // Delete this test's assets/history/custodians before its operator.
    async cleanup() {
      await db.transaction(async tx => {
        await tx.delete(auditLogs).where(eq(auditLogs.userId, user.id));
        await tx.delete(users).where(eq(users.id, user.id));
      });
    },
  };
}
