import type { RequestScope } from '../domain/organizationAccess';

interface SqlRunner {
  query(text: string, params?: any[]): Promise<{ rows: Record<string, any>[]; rowCount?: number | null }>;
}

interface PoolLike {
  query(text: string, params?: any[]): Promise<{ rows: Record<string, any>[]; rowCount?: number | null }>;
  connect(): Promise<{
    query(text: string, params?: any[]): Promise<{ rows: Record<string, any>[]; rowCount?: number | null }>;
    release(): void;
  }>;
}

const fail = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });

/**
 * Validates and normalizes IPv4 or CIDR notation.
 * Rejects too broad masks (< 16), invalid octets, 0.0.0.0/0, and non-IPv4 strings.
 */
export function parseSourceCidr(raw: unknown): string {
  if (typeof raw !== 'string') throw fail('IP / CIDR tidak valid.');
  const trimmed = raw.trim();
  if (!trimmed) throw fail('IP / CIDR tidak valid.');

  const parts = trimmed.split('/');
  if (parts.length > 2) throw fail('IP / CIDR tidak valid.');

  const ip = parts[0].trim();
  const maskStr = parts[1]?.trim();

  // Validate IPv4 format
  const octets = ip.split('.');
  if (octets.length !== 4) throw fail('IP / CIDR tidak valid.');

  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet)) throw fail('IP / CIDR tidak valid.');
    const num = Number(octet);
    if (num < 0 || num > 255) throw fail('IP / CIDR tidak valid.');
  }

  // Reject 0.0.0.0
  if (ip === '0.0.0.0') throw fail('IP / CIDR tidak valid.');

  let mask = 32;
  if (maskStr !== undefined) {
    if (!/^\d{1,2}$/.test(maskStr)) throw fail('IP / CIDR tidak valid.');
    mask = Number(maskStr);
    if (mask < 16 || mask > 32) throw fail('IP / CIDR tidak valid (subnet mask harus antara /16 dan /32).');
  }

  return `${ip}/${mask}`;
}

export function parseRegisterInput(input: Record<string, unknown>) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw fail('Input registrasi ADMS tidak valid.');
  }

  const rawDeviceId = input.deviceId;
  if (
    rawDeviceId === undefined ||
    rawDeviceId === null ||
    (!Number.isInteger(rawDeviceId) && !/^\d+$/.test(String(rawDeviceId))) ||
    Number(rawDeviceId) < 1
  ) {
    throw fail('Input registrasi ADMS tidak valid: ID mesin tidak valid.');
  }
  const deviceId = Number(rawDeviceId);

  const rawSerial = input.serial;
  if (typeof rawSerial !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(rawSerial.trim())) {
    throw fail('Input registrasi ADMS tidak valid: Nomor seri (SN) harus alfanumerik 1-100 karakter.');
  }
  const serial = rawSerial.trim();

  const sourceCidr = parseSourceCidr(input.sourceCidr);
  const enabled = input.enabled !== undefined ? Boolean(input.enabled) : true;

  return { deviceId, serial, sourceCidr, enabled };
}

export function parseToggleInput(input: Record<string, unknown>) {
  if (!input || typeof input !== 'object' || typeof input.enabled !== 'boolean') {
    throw fail('Status aktivasi harus berupa boolean (true/false).');
  }
  return { enabled: input.enabled };
}

export async function getAdmsCandidates(runner: SqlRunner, scope: RequestScope) {
  if (scope.module !== 'hr') throw fail('HR scope required', 403);

  const sql = `
    SELECT 
      d.id::text AS id,
      d.name,
      d.serial_number AS "serialNumber",
      d.ip,
      d.port,
      d.connection_type AS "connectionType",
      d.is_enabled AS "isEnabled",
      (a.serial IS NOT NULL) AS "admsRegistered",
      COALESCE(a.enabled, false) AS "admsEnabled",
      host(a.allowed_network) || '/' || masklen(a.allowed_network) AS "allowedNetwork",
      a.last_seen_at AS "lastSeenAt",
      a.last_data_at AS "lastDataAt"
    FROM public.attendance_devices d
    LEFT JOIN adms.devices a ON a.device_id = d.id AND a.group_id = d.group_id
    WHERE ($1::boolean OR d.group_id = ANY($2::bigint[]))
    ORDER BY d.id ASC
  `;

  const { rows } = await runner.query(sql, [
    scope.includeUnmapped && !scope.groupIds.length,
    scope.groupIds,
  ]);

  return rows.map(r => ({
    ...r,
    id: Number(r.id),
  }));
}

export async function registerAdmsDevice(
  pool: PoolLike,
  scope: RequestScope,
  input: ReturnType<typeof parseRegisterInput>
) {
  if (scope.module !== 'hr') throw fail('HR scope required', 403);
  if (scope.selectedGroupId === null || !scope.groupIds.includes(scope.selectedGroupId)) {
    throw fail('Pilih kelompok organisasi aktif terlebih dahulu.', 403);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify device exists in active group
    const checkSql = `
      SELECT id, group_id, serial_number, is_enabled
      FROM public.attendance_devices
      WHERE id = $1 AND group_id = $2
      FOR UPDATE
    `;
    const checkRes = await client.query(checkSql, [input.deviceId, scope.selectedGroupId]);
    if (!checkRes.rows.length) {
      throw fail('Mesin tidak ditemukan dalam kelompok organisasi aktif.', 404);
    }
    const dev = checkRes.rows[0];
    if (!dev.is_enabled) {
      throw fail('Aktifkan perangkat pada menu Mesin Presensi sebelum mendaftarkannya ke ADMS.', 400);
    }

    // 2. Update attendance_devices connection_type to ADMS
    await client.query(
      `UPDATE public.attendance_devices 
       SET connection_type = 'ADMS',
           serial_number = COALESCE(NULLIF($2, ''), serial_number),
           updated_at = NOW()
       WHERE id = $1`,
      [input.deviceId, input.serial]
    );

    // 3. Upsert into adms.devices
    const upsertSql = `
      INSERT INTO adms.devices(serial, device_id, group_id, allowed_network, enabled)
      VALUES ($1, $2, $3, $4::cidr, $5)
      ON CONFLICT (serial) DO UPDATE SET
        allowed_network = EXCLUDED.allowed_network,
        enabled = EXCLUDED.enabled
      WHERE adms.devices.device_id = EXCLUDED.device_id AND adms.devices.group_id = EXCLUDED.group_id
      RETURNING serial, device_id, allowed_network, enabled
    `;
    const upsertRes = await client.query(upsertSql, [
      input.serial,
      input.deviceId,
      scope.selectedGroupId,
      input.sourceCidr,
      input.enabled,
    ]);

    if (!upsertRes.rows.length) {
      throw fail('Nomor seri ini sudah digunakan oleh perangkat atau kelompok lain.', 409);
    }

    await client.query('COMMIT');

    return {
      deviceId: input.deviceId,
      serial: input.serial,
      allowedNetwork: input.sourceCidr,
      enabled: input.enabled,
      message: 'Mesin ADMS berhasil didaftarkan dan allowlist diperbarui.',
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      throw fail('Nomor seri sudah terdaftar pada mesin lain.', 409);
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function toggleAdmsDevice(
  runner: SqlRunner,
  scope: RequestScope,
  deviceId: number,
  enabled: boolean
) {
  if (scope.module !== 'hr') throw fail('HR scope required', 403);
  if (scope.selectedGroupId === null || !scope.groupIds.includes(scope.selectedGroupId)) {
    throw fail('Pilih kelompok organisasi aktif terlebih dahulu.', 403);
  }

  const sql = `
    UPDATE adms.devices
    SET enabled = $1
    WHERE device_id = $2 AND group_id = $3
    RETURNING serial, device_id, enabled
  `;
  const res = await runner.query(sql, [enabled, deviceId, scope.selectedGroupId]);
  if (!res.rowCount) {
    throw fail('Perangkat ADMS tidak ditemukan pada kelompok organisasi ini.', 404);
  }

  return {
    deviceId,
    serial: res.rows[0].serial,
    enabled: res.rows[0].enabled,
    message: enabled ? 'Penerimaan data ADMS diaktifkan.' : 'Penerimaan data ADMS dinonaktifkan.',
  };
}

