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

export type RegisterAdmsInput =
  | {
      mode: 'existing';
      deviceId: number;
      serial: string;
      sourceCidr: string;
      enabled: boolean;
    }
  | {
      mode: 'new';
      name: string;
      ip: string;
      port: number;
      groupId?: number;
      serial: string;
      sourceCidr: string;
      enabled: boolean;
    };

export function parseRegisterInput(input: Record<string, unknown>): RegisterAdmsInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw fail('Input registrasi ADMS tidak valid.');
  }

  const rawSerial = input.serial;
  if (typeof rawSerial !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(rawSerial.trim())) {
    throw fail('Input registrasi ADMS tidak valid: Nomor seri (SN) harus alfanumerik 1-100 karakter.');
  }
  const serial = rawSerial.trim();

  const enabled = input.enabled !== undefined ? Boolean(input.enabled) : true;
  const rawDeviceId = input.deviceId;

  // Mode 1: Existing Device Registration
  if (
    rawDeviceId !== undefined &&
    rawDeviceId !== null &&
    rawDeviceId !== '' &&
    rawDeviceId !== 0 &&
    rawDeviceId !== '0'
  ) {
    if ((!Number.isInteger(rawDeviceId) && !/^\d+$/.test(String(rawDeviceId))) || Number(rawDeviceId) < 1) {
      throw fail('Input registrasi ADMS tidak valid: ID mesin tidak valid.');
    }
    const deviceId = Number(rawDeviceId);
    const sourceCidr = parseSourceCidr(input.sourceCidr);
    return { mode: 'existing', deviceId, serial, sourceCidr, enabled };
  }

  // Mode 2: New Device Registration
  const rawName = input.name;
  if (typeof rawName !== 'string' || !rawName.trim() || rawName.trim().length > 100) {
    throw fail('Input registrasi ADMS tidak valid: Nama mesin harus diisi (maksimal 100 karakter).');
  }
  const name = rawName.trim();

  const rawIp = input.ip;
  if (typeof rawIp !== 'string' || !rawIp.trim()) {
    throw fail('Input registrasi ADMS tidak valid: Alamat IP mesin harus diisi.');
  }
  const ip = rawIp.trim();
  // Validate IPv4 format
  const octets = ip.split('.');
  if (octets.length !== 4 || octets.some(o => !/^\d{1,3}$/.test(o) || Number(o) < 0 || Number(o) > 255)) {
    throw fail('Input registrasi ADMS tidak valid: Format IP mesin tidak valid.');
  }

  let port = 4370;
  if (input.port !== undefined && input.port !== null && input.port !== '') {
    const parsedPort = Number(input.port);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      throw fail('Input registrasi ADMS tidak valid: Port harus antara 1 dan 65535.');
    }
    port = parsedPort;
  }

  let groupId: number | undefined;
  if (input.groupId !== undefined && input.groupId !== null && input.groupId !== '') {
    const parsedGroupId = Number(input.groupId);
    if (!Number.isInteger(parsedGroupId) || parsedGroupId < 1) {
      throw fail('Input registrasi ADMS tidak valid: Kelompok organisasi tidak valid.');
    }
    groupId = parsedGroupId;
  }

  const rawSourceCidr = input.sourceCidr ? String(input.sourceCidr).trim() : `${ip}/32`;
  const sourceCidr = parseSourceCidr(rawSourceCidr);

  return { mode: 'new', name, ip, port, groupId, serial, sourceCidr, enabled };
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
      d.group_id AS "groupId",
      og.name AS "groupName",
      (a.serial IS NOT NULL) AS "admsRegistered",
      COALESCE(a.enabled, false) AS "admsEnabled",
      host(a.allowed_network) || '/' || masklen(a.allowed_network) AS "allowedNetwork",
      a.last_seen_at AS "lastSeenAt",
      a.last_data_at AS "lastDataAt"
    FROM public.attendance_devices d
    LEFT JOIN public.organization_groups og ON og.id = d.group_id
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
    groupId: r.groupId ? Number(r.groupId) : null,
    groupName: r.groupName || null,
  }));
}

export async function registerAdmsDevice(
  pool: PoolLike,
  scope: RequestScope,
  input: RegisterAdmsInput
) {
  if (scope.module !== 'hr') throw fail('HR scope required', 403);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let targetGroupId: number;
    let targetDeviceId: number;
    let successMessage: string;

    if (input.mode === 'new') {
      // Mode 2: New Device Registration
      if (input.groupId !== undefined) {
        if (!scope.groupIds.includes(input.groupId)) {
          throw fail('Kelompok organisasi tujuan tidak diizinkan atau tidak ditemukan.', 403);
        }
        targetGroupId = input.groupId;
      } else if (scope.selectedGroupId !== null && scope.groupIds.includes(scope.selectedGroupId)) {
        targetGroupId = scope.selectedGroupId;
      } else if (scope.groupIds.length === 1) {
        targetGroupId = scope.groupIds[0];
      } else {
        throw fail('Pilih kelompok organisasi tujuan untuk mesin absensi baru.', 400);
      }

      // Check if IP or serial already used
      const existingCheck = await client.query(
        `SELECT id, name FROM public.attendance_devices WHERE (ip = $1 OR serial_number = $2) AND group_id = $3 LIMIT 1`,
        [input.ip, input.serial, targetGroupId]
      );
      if (existingCheck.rows.length) {
        throw fail('Alamat IP atau nomor seri mesin sudah terdaftar di kelompok organisasi ini.', 409);
      }

      // Insert new device into public.attendance_devices
      const code = `adms-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const devInsertSql = `
        INSERT INTO public.attendance_devices(code, name, ip, port, serial_number, connection_type, is_enabled, group_id)
        VALUES ($1, $2, $3, $4, $5, 'ADMS', true, $6)
        RETURNING id
      `;
      const devInsertRes = await client.query(devInsertSql, [
        code,
        input.name,
        input.ip,
        input.port,
        input.serial,
        targetGroupId,
      ]);
      targetDeviceId = Number(devInsertRes.rows[0].id);
      successMessage = `Mesin baru "${input.name}" berhasil dibuat dan didaftarkan ke ADMS.`;
    } else {
      // Mode 1: Existing Device Registration
      if (scope.selectedGroupId === null || !scope.groupIds.includes(scope.selectedGroupId)) {
        throw fail('Pilih kelompok organisasi aktif terlebih dahulu.', 403);
      }
      targetGroupId = scope.selectedGroupId;
      targetDeviceId = input.deviceId;

      // Verify device exists in active group
      const checkSql = `
        SELECT id, group_id, serial_number, is_enabled
        FROM public.attendance_devices
        WHERE id = $1 AND group_id = $2
        FOR UPDATE
      `;
      const checkRes = await client.query(checkSql, [targetDeviceId, targetGroupId]);
      if (!checkRes.rows.length) {
        throw fail('Mesin tidak ditemukan dalam kelompok organisasi aktif.', 404);
      }
      const dev = checkRes.rows[0];
      if (!dev.is_enabled) {
        throw fail('Aktifkan perangkat pada menu Mesin Presensi sebelum mendaftarkannya ke ADMS.', 400);
      }

      // Update attendance_devices connection_type to ADMS
      await client.query(
        `UPDATE public.attendance_devices 
         SET connection_type = 'ADMS',
             serial_number = COALESCE(NULLIF($2, ''), serial_number),
             updated_at = NOW()
         WHERE id = $1`,
        [targetDeviceId, input.serial]
      );
      successMessage = 'Mesin ADMS berhasil didaftarkan dan allowlist diperbarui.';
    }

    // Upsert into adms.devices
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
      targetDeviceId,
      targetGroupId,
      input.sourceCidr,
      input.enabled,
    ]);

    if (!upsertRes.rows.length) {
      throw fail('Nomor seri ini sudah digunakan oleh perangkat atau kelompok lain.', 409);
    }

    await client.query('COMMIT');

    return {
      deviceId: targetDeviceId,
      serial: input.serial,
      allowedNetwork: input.sourceCidr,
      enabled: input.enabled,
      message: successMessage,
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

