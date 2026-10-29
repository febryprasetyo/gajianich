import type { AttendanceDataset, AttendanceRepository, AttendanceCommand } from './types';
import { api } from '@/lib/api';
import {organizationRequests} from '@/lib/access/organizationScope';

/**
 * Generate RFC4122 version 4 UUID compliant string.
 * Supports secure context (window.crypto.randomUUID) and non-secure context (LAN HTTP e.g. 192.168.x.x).
 */
export function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createAttendanceRepository(_accountId?: number): AttendanceRepository {
  let current: AttendanceDataset | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let cacheRevision=organizationRequests.revision;

  async function load(signal?: AbortSignal): Promise<AttendanceDataset> {
    if(cacheRevision!==organizationRequests.revision){current=null;cacheRevision=organizationRequests.revision;}
    if (current) return structuredClone(current);

    const response = await api.get<{ success: boolean; data: AttendanceDataset }>(
      '/attendance/workspace',
      { signal }
    );

    if (!response || !response.data) {
      throw new Error('Workspace absensi gagal dimuat dari server.');
    }

    const data = response.data;
    data.batches = (data.batches || []).filter((batch) => batch.filename !== 'MANUAL_ENTRY');
    data.records = data.records || [];
    data.identities = data.identities || [];
    data.departments = data.departments || [];
    data.locations = data.locations || [];
    data.sources = data.sources || [];
    data.employees = data.employees || [];
    data.audit = data.audit || [];
    data.revisions = data.revisions || [];
    data.grants = data.grants || [];
    data.locks = data.locks || [];
    data.shifts = data.shifts || [];
    data.shiftAssignments = data.shiftAssignments || [];

    current = data;
    return structuredClone(current);
  }

  return {
    load,
    async execute(command: AttendanceCommand): Promise<AttendanceDataset> {
      const revision=organizationRequests.revision;
      const operation = queue.then(async () => {
        if(revision!==organizationRequests.revision) throw new DOMException('Kelompok aktif telah berubah','AbortError');
        if(cacheRevision!==revision){current=null;cacheRevision=revision;}
        // sync_employees is client-side metadata alignment with master employee cache
        if (command.type === 'sync_employees') {
          if (!current) {
            await load();
          }
          current!.employees = command.employees;
          if (command.departments) {
            current!.departments = command.departments;
          }
          return structuredClone(current!);
        }

        const operationId = generateUuidV4();

        try {
          const response = await api.post<{
            success: boolean;
            data: { changed: boolean; eventId: string | null; data: AttendanceDataset };
          }>(
            '/attendance/commands',
            {
              operationId,
              command,
            },
            {
              headers: {
                'Idempotency-Key': operationId,
              },
            }
          );

          if (!response || !response.data || !response.data.data) {
            throw new Error('Respons mutasi absensi server tidak valid.');
          }

          const dataset = response.data.data;
          dataset.batches = (dataset.batches || []).filter(
            (batch) => batch.filename !== 'MANUAL_ENTRY'
          );
          current = dataset;
          return structuredClone(current);
        } catch (err: any) {
          // If conflict or state error, reset cache to force fresh reload
          if (err.message && /konflik|kunci|conflict|locked|409/i.test(err.message)) {
            current = null;
          }
          throw err;
        }
      });

      queue = operation.then(
        () => undefined,
        () => undefined
      );
      return operation;
    },
    async reset(): Promise<AttendanceDataset> {
      await queue;
      current = null;
      return load();
    },
  };
}
