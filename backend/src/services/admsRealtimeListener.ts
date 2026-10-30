import type { PoolClient } from 'pg';
import { getPool, pool } from '../db';
import { cleanseAndIngestAdmsLogs } from './admsAttendanceSync';

interface PunchNotificationPayload {
  id?: number;
  group_id?: number;
  employee_id?: number | null;
  work_date?: string;
}

let listenerClient: PoolClient | null = null;
let sweepIntervalTimer: NodeJS.Timeout | null = null;
let debounceTimeout: NodeJS.Timeout | null = null;
let isStopping = false;
let isProcessing = false;

// Pending items to process in format "groupId:workDate"
const pendingBatch = new Set<string>();

/**
 * Process all queued (groupId, workDate) pairs through cleanseAndIngestAdmsLogs.
 */
export async function flushAdmsQueue(): Promise<void> {
  if (isProcessing || pendingBatch.size === 0) return;
  isProcessing = true;

  const currentItems = Array.from(pendingBatch);
  pendingBatch.clear();

  try {
    for (const item of currentItems) {
      const [gStr, workDate] = item.split(':');
      const groupId = Number(gStr);
      if (!Number.isInteger(groupId) || groupId <= 0 || !workDate) continue;

      try {
        await cleanseAndIngestAdmsLogs(pool, {
          groupId,
          startDate: workDate,
          endDate: workDate,
          onlyUningested: true,
        });
      } catch (err: any) {
        console.error(`[admsRealtimeListener] Ingestion error for group ${groupId} on date ${workDate}:`, err?.message || err);
      }
    }
  } finally {
    isProcessing = false;
    // If new items arrived while processing, schedule next cycle
    if (pendingBatch.size > 0) {
      scheduleDebouncedProcessing();
    }
  }
}

/**
 * Debounce queue processing by 150ms to aggregate rapid succession taps.
 */
function scheduleDebouncedProcessing(delayMs = 150) {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    flushAdmsQueue().catch((err) => {
      console.error('[admsRealtimeListener] Error flushing queue:', err);
    });
  }, delayMs);
}

/**
 * Failsafe background sweep to capture any uningested logs with mapped employees
 * (e.g. if the backend was offline when the NOTIFY event fired).
 */
export async function sweepUningestedLogs(): Promise<number> {
  if (isStopping) return 0;
  try {
    const res = await pool.query(`
      SELECT DISTINCT r.group_id, to_char(r.punched_at, 'YYYY-MM-DD') AS work_date
      FROM adms.review_logs r
      WHERE r.ingested_at IS NULL
        AND r.employee_id IS NOT NULL
      LIMIT 20
    `);

    if (res.rows.length === 0) return 0;

    for (const row of res.rows) {
      if (row.group_id && row.work_date) {
        pendingBatch.add(`${row.group_id}:${row.work_date}`);
      }
    }

    scheduleDebouncedProcessing(50);
    return res.rows.length;
  } catch (err: any) {
    console.warn('[admsRealtimeListener] Failsafe sweep failed:', err?.message || err);
    return 0;
  }
}

/**
 * Starts the PostgreSQL LISTEN connection on channel 'adms_new_punch'
 * and initiates the background failsafe sweep timer.
 */
export async function startAdmsRealtimeListener(): Promise<void> {
  if (listenerClient || isStopping) return;
  isStopping = false;

  try {
    listenerClient = await getPool().connect();

    // Listen on dedicated channel
    await listenerClient.query('LISTEN adms_new_punch');
    console.log('[admsRealtimeListener] Subscribed to PostgreSQL notification channel: adms_new_punch');

    listenerClient.on('notification', (msg) => {
      if (msg.channel !== 'adms_new_punch' || !msg.payload) return;

      try {
        const data: PunchNotificationPayload = JSON.parse(msg.payload);
        // Only enqueue if group_id and work_date exist, and employee is mapped
        if (data.group_id && data.work_date && data.employee_id) {
          pendingBatch.add(`${data.group_id}:${data.work_date}`);
          scheduleDebouncedProcessing(150);
        }
      } catch (e) {
        console.warn('[admsRealtimeListener] Failed to parse punch notification JSON payload:', msg.payload);
      }
    });

    listenerClient.on('error', (err) => {
      console.error('[admsRealtimeListener] Dedicated client error:', err?.message || err);
      reconnectListener();
    });

    listenerClient.on('end', () => {
      if (!isStopping) {
        console.warn('[admsRealtimeListener] Dedicated client connection ended unexpectedly, reconnecting...');
        reconnectListener();
      }
    });

    // Run initial sweep immediately upon startup
    await sweepUningestedLogs();

    // Set recurring 30s failsafe interval
    sweepIntervalTimer = setInterval(() => {
      sweepUningestedLogs().catch(() => {});
    }, 30000);
  } catch (err: any) {
    console.error('[admsRealtimeListener] Failed to start listener:', err?.message || err);
    reconnectListener(5000);
  }
}

function reconnectListener(delayMs = 3000) {
  if (isStopping) return;
  if (listenerClient) {
    try {
      listenerClient.release(true);
    } catch {}
    listenerClient = null;
  }
  setTimeout(() => {
    if (!isStopping) {
      startAdmsRealtimeListener().catch((e) => {
        console.error('[admsRealtimeListener] Reconnect attempt failed:', e);
      });
    }
  }, delayMs);
}

/**
 * Gracefully stops the listener, clears timers, and releases database client.
 */
export async function stopAdmsRealtimeListener(): Promise<void> {
  isStopping = true;
  if (sweepIntervalTimer) {
    clearInterval(sweepIntervalTimer);
    sweepIntervalTimer = null;
  }
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
    debounceTimeout = null;
  }
  if (listenerClient) {
    try {
      await listenerClient.query('UNLISTEN adms_new_punch').catch(() => {});
      listenerClient.release();
    } catch {}
    listenerClient = null;
  }
  console.log('[admsRealtimeListener] Realtime listener stopped cleanly.');
}
