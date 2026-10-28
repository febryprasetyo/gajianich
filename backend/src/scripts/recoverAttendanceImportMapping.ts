/** Explicit, rerunnable repair for production incident batches 140–143. Preview by default. */
import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { db, pool } from '../db';
import { employees } from '../db/schema/employees';
import { users } from '../db/schema/users';
import { attendanceBatches, attendanceRecords } from '../db/schema/attendance';
import { attendanceIdentities, attendanceImportRows, attendanceLocks } from '../db/schema/attendanceWorkspace';
import { appendHrAudit } from '../services/hrAudit';
import { planImportRecovery } from '../domain/attendanceImportRecovery';

async function main() {
  const apply = process.argv.includes('--apply');
  const result = await db.transaction(async tx => {
    await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
    const batches = await tx.select().from(attendanceBatches).where(inArray(attendanceBatches.id, [140, 141, 142, 143])).for('update');
    if (batches.length !== 4 || batches.some(b => b.status !== 'COMMITTED')) throw new Error('Expected four affected committed batches; inspect before recovery');
    const input = await tx.select().from(attendanceImportRows).where(inArray(attendanceImportRows.batchId, batches.map(b => b.id))).for('update');
    for (const date of [...new Set(input.map(r => r.workDate))].sort()) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'att_date_' + date}))`);
    }
    const employeeRows = await tx.select().from(employees);
    const identities = await tx.select().from(attendanceIdentities);
    const existing = await tx.select().from(attendanceRecords);
    const locks = await tx.select().from(attendanceLocks);
    const plan = planImportRecovery(input.map(r => ({ ...r, sourceId: batches.find(b => b.id === r.batchId)!.sourceId })), employeeRows, identities, existing, locks.map(l => l.workDate));
    const reports = [];
    for (const batch of batches) {
      const rows = plan.rows.filter(r => r.batchId === batch.id);
      const changes = rows.filter(r => input.find(old => old.id === r.id)!.employeeId !== r.employeeId);
      const blocked = rows.filter(r => !r.employeeId && r.reviewStatus !== 'SKIPPED' && r.reviewStatus !== 'BLOCKED');
      const candidates = plan.candidates.filter(r => r.batchId === batch.id);
      let inserted = 0;
      if (apply) {
        for (const row of changes) await tx.update(attendanceImportRows).set({ employeeId: row.employeeId, updatedAt: new Date() }).where(eq(attendanceImportRows.id, row.id));
        for (const row of blocked) await tx.update(attendanceImportRows).set({ reviewStatus: 'BLOCKED', note: 'Pemulihan import: ID tidak ditemukan atau ambigu; perlu pemetaan manual.', updatedAt: new Date() }).where(eq(attendanceImportRows.id, row.id));
        for (const row of candidates) {
          const saved = await tx.insert(attendanceRecords).values({ employeeId: row.employeeId!, workDate: row.workDate, scanIn: row.scanIn, scanOut: row.scanOut, rawScanIn: row.rawScanIn, rawScanOut: row.rawScanOut, lateMinutes: row.lateMinutes, earlyMinutes: row.earlyMinutes, overtimeMinutes: row.overtimeMinutes, normalized: row.normalized, attendanceStatus: row.attendanceStatus || 'PRESENT', sourceBatchId: batch.id }).onConflictDoNothing({ target: [attendanceRecords.employeeId, attendanceRecords.workDate] }).returning({ id: attendanceRecords.id });
          inserted += saved.length;
        }
        if (changes.length || blocked.length || inserted) {
          await tx.update(attendanceBatches).set({ validRows: rows.filter(r => r.employeeId && r.reviewStatus === 'READY').length, revision: batch.revision + 1 }).where(eq(attendanceBatches.id, batch.id));
          const [actor] = await tx.select().from(users).where(eq(users.id, batch.createdById!));
          if (!actor) throw new Error('Original import actor missing');
          await appendHrAudit(tx, { operationId: randomUUID(), actor: { id: String(actor.id), username: actor.username, name: actor.username }, action: 'UPDATE', entityType: 'attendance_batch', entityId: String(batch.id), entityLabel: batch.filename, outcome: 'SUCCESS', summary: `Pemulihan pemetaan import: ${changes.length} baris dipetakan, ${inserted} absensi ditambahkan; catatan final yang ada dipertahankan.`, metadata: { repair: 'attendance-import-mapping-2026-10-22', executedBy: 'maintenance-script', mappedRows: changes.length, blockedRows: blocked.length, insertedRecords: inserted } });
        }
      }
      reports.push({ batchId: batch.id, totalRows: rows.length, mapped: rows.filter(r => r.employeeId).length, mappingChanges: changes.length, unresolved: rows.filter(r => !r.employeeId).length, needsReview: rows.filter(r => r.reviewStatus === 'NEEDS_REVIEW').length, candidates: candidates.length, inserted });
    }
    return { mode: apply ? 'apply' : 'preview', batches: reports };
  });
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
