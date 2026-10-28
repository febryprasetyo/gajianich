import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { runDiagnostics, validateDevices } from './lib/zk-connection.mjs';

const help = `Uji koneksi mesin ZKTeco/Solution dari Ubuntu (TCP).

Jalankan dari direktori backend:
  npm run attendance:devices:test -- --config config/attendance-devices.example.json
  npm run attendance:devices:test -- --config .attendance-diagnostics/attendance-devices.local.json --device solution-x900-utama
  node scripts/attendance-device-test.mjs --config .attendance-diagnostics/attendance-devices.local.json --json

Opsi:
  --config PATH   File JSON berisi daftar devices (wajib).
  --device ID     Uji hanya ID ini; dapat diulang. Default: seluruh mesin aktif.
  --json          Tampilkan laporan JSON, tanpa tabel.
  --help          Bantuan.

Status: ok = handshake dan identitas lengkap; partial = handshake berhasil,
metadata/disconnect belum lengkap; failed = tes tidak selesai.
Exit code: 0 semua ok, 1 ada partial/failed, 2 argumen/config salah.
Tidak mengambil log, mengakses database, menonaktifkan, atau mengubah mesin.`;

try {
  const { values } = parseArgs({ options: {
    config: { type: 'string' }, device: { type: 'string', multiple: true },
    json: { type: 'boolean', default: false }, help: { type: 'boolean', default: false },
  }, allowPositionals: false });
  if (values.help) {
    console.log(help);
  } else {
    if (!values.config) throw new Error('Gunakan --config PATH. Lihat --help.');
    const devices = validateDevices(JSON.parse(await readFile(values.config, 'utf8')));
    const selection = new Set(values.device ?? []);
    for (const id of selection) {
      const selected = devices.find(device => device.id === id);
      if (!selected) throw new Error(`Unknown device id: ${id}`);
      if (!selected.enabled) throw new Error(`Device ${id} is disabled; aktifkan di config sebelum diuji.`);
    }
    const targets = devices.filter(device => device.enabled && (!selection.size || selection.has(device.id)));
    if (!targets.length) throw new Error('Tidak ada mesin aktif untuk diuji.');
    const results = await runDiagnostics(targets);
    const report = { checkedAt: new Date().toISOString(), transport: 'zk-tcp', results };
    if (values.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.table(results.map(result => ({
        id: result.id, address: `${result.ip}:${result.port}`, status: result.status,
        tcp: result.tcpConnected, zk: result.protocolConnected,
        model: result.identity.deviceName ?? '-', serial: result.identity.serialNumber ?? '-',
        firmware: result.identity.firmware ?? '-', durationMs: result.durationMs,
      })));
      for (const result of results) {
        if (result.error) console.log(`${result.id}: ${result.error.code}: ${result.error.message}`);
        for (const warning of result.warnings) console.log(`${result.id}: ${warning.field}: ${warning.code}: ${warning.message}`);
      }
    }
    process.exitCode = results.every(result => result.status === 'ok') ? 0 : 1;
  }
} catch (error) {
  console.error(`Konfigurasi/argumen tidak valid: ${error.message}`);
  process.exitCode = 2;
}
