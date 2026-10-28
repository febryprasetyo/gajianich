import assert from 'node:assert/strict';
import net from 'node:net';
import { test } from 'node:test';
import { probeDevice, runDiagnostics, validateDevices } from './lib/zk-connection.mjs';

function reply(command, session, sequence, data = Buffer.alloc(0)) {
  const packet = Buffer.alloc(16 + data.length);
  packet.set([0x50, 0x50, 0x82, 0x7d]);
  packet.writeUInt32LE(8 + data.length, 4);
  packet.writeUInt16LE(command, 8);
  packet.writeUInt16LE(session, 12);
  packet.writeUInt16LE(sequence, 14);
  packet.set(data, 16);
  let sum = 0;
  for (let i = 8; i < packet.length; i += 2) {
    sum += packet[i] + ((packet[i + 1] ?? 0) << 8);
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  packet.writeUInt16LE(0xffff - sum, 10);
  return packet;
}

async function fakeDevice(t, respond) {
  const sockets = new Set();
  const commands = [];
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
    let buffered = Buffer.alloc(0);
    socket.on('data', chunk => {
      buffered = Buffer.concat([buffered, chunk]);
      while (buffered.length >= 8 && buffered.length >= 8 + buffered.readUInt32LE(4)) {
        const length = 8 + buffered.readUInt32LE(4);
        const packet = buffered.subarray(0, length);
        buffered = buffered.subarray(length);
        const command = packet.readUInt16LE(8);
        commands.push(command);
        respond(socket, packet, command);
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  });
  return {
    commands,
    config: { id: 'test', name: 'Loopback fixture', ip: '127.0.0.1', port: server.address().port, commKey: 0, timeoutMs: 200 },
  };
}

function identityReply(socket, packet, command) {
  const sequence = packet.readUInt16LE(14);
  const query = packet.subarray(16).toString('ascii').replace(/\0/g, '');
  const values = { '~SerialNumber': 'TEST-SERIAL', '~DeviceName': 'X900', '~Platform': 'ZAM180_TFT' };
  const data = command === 1100 ? 'Ver 6.60 fixture' : command === 11 ? `${query}=${values[query]}\0` : '';
  const response = reply(2000, 0x1234, sequence, Buffer.from(data));
  // Exercise a prefix split across separate TCP reads.
  socket.write(response.subarray(0, 3));
  setImmediate(() => { if (!socket.destroyed) socket.write(response.subarray(3)); });
}

test('performs a ZK handshake and reads identity over fragmented TCP without write commands', async t => {
  const fake = await fakeDevice(t, (socket, packet, command) => {
    if (command === 1000) assert.equal(packet.toString('hex'), '5050827d08000000e80316fc00000100');
    identityReply(socket, packet, command);
  });
  const result = await probeDevice(fake.config);
  assert.equal(result.status, 'ok');
  assert.equal(result.protocolConnected, true);
  assert.equal(result.identity.serialNumber, 'TEST-SERIAL');
  assert.equal(result.identity.deviceName, 'X900');
  assert.equal(result.identity.platform, 'ZAM180_TFT');
  assert.equal(result.identity.firmware, 'Ver 6.60 fixture');
  assert.deepEqual(fake.commands, [1000, 1100, 11, 11, 11, 1001]);
});

test('does not report TCP success as ZK success when the device rejects authentication', async t => {
  const fake = await fakeDevice(t, (socket, packet) => socket.write(reply(2005, 0x1234, packet.readUInt16LE(14))));
  const result = await probeDevice(fake.config);
  assert.equal(result.status, 'failed');
  assert.equal(result.tcpConnected, true);
  assert.equal(result.protocolConnected, false);
  assert.equal(result.error.code, 'AUTH_FAILED');
});

test('times out a TCP peer that never answers the protocol request', async t => {
  const fake = await fakeDevice(t, () => {});
  const started = Date.now();
  const result = await probeDevice(fake.config);
  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'TIMEOUT');
  assert.ok(Date.now() - started < 2000);
});

test('rejects a non-ZK response instead of treating arbitrary service bytes as device identity', async t => {
  const fake = await fakeDevice(t, socket => socket.write('HTTP/1.1 200 OK\r\n\r\n'));
  const result = await probeDevice(fake.config);
  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'INVALID_FRAME');
});

test('rejects an advertised frame length above the diagnostic response bound', async t => {
  const fake = await fakeDevice(t, socket => socket.write(Buffer.from('5050827dffffff7f', 'hex')));
  const result = await probeDevice(fake.config);
  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'INVALID_FRAME');
});

test('continues after a failed machine and never probes disabled entries', async t => {
  const good = await fakeDevice(t, identityReply);
  const bad = await fakeDevice(t, socket => socket.destroy());
  const results = await runDiagnostics([
    { ...bad.config, id: 'offline' },
    { ...good.config, id: 'working' },
    { ...good.config, id: 'disabled', enabled: false },
  ]);
  assert.deepEqual(results.map(result => [result.id, result.status]), [['offline', 'failed'], ['working', 'ok']]);
  assert.equal(good.commands.filter(command => command === 1000).length, 1);
});

test('reports missing optional metadata as partial while retaining a proven handshake', async t => {
  const fake = await fakeDevice(t, (socket, packet, command) => {
    if (command === 11) socket.write(reply(2001, 0x1234, packet.readUInt16LE(14)));
    else identityReply(socket, packet, command);
  });
  const result = await probeDevice(fake.config);
  assert.equal(result.status, 'partial');
  assert.equal(result.protocolConnected, true);
  assert.equal(result.identity.serialNumber, null);
  assert.equal(result.warnings.length, 3);
});

test('validates multiple-machine configuration before opening connections', () => {
  const result = validateDevices({ devices: [{ id: 'main', ip: '192.168.10.224' }] });
  assert.equal(result[0]?.port, 4370);
  assert.equal(result[0]?.commKey, 0);
  assert.throws(() => validateDevices({ devices: [{ id: 'x', ip: '127.0.0.1' }, { id: 'x', ip: '127.0.0.2' }] }), /duplicate/i);
  assert.throws(() => validateDevices({ devices: [{ id: 'x', ip: '127.0.0.1', port: 0 }] }), /port/i);
  assert.throws(() => validateDevices({ devices: [{ id: 'x', ip: 'example.invalid' }] }), /IPv4/i);
  assert.throws(() => validateDevices({ devices: [{ id: 'x', ip: '127.0.0.1', enabled: 'false' }] }), /enabled/i);
  assert.equal(validateDevices({ devices: [{ id: 'x', ip: '127.0.0.1', commKey: 123 }] })[0].commKey, 123);
  assert.throws(() => validateDevices({ devices: [{ id: 'x', ip: '127.0.0.1', commKey: -1 }] }), /commKey/i);
});

for (const [commKey, expectedAuth] of [[0, '617d326b'], [123, '61a3326b']]) {
  test(`answers the authentication challenge using configured key ${commKey}`, async t => {
    const fake = await fakeDevice(t, (socket, packet, command) => {
      if (command === 1000) socket.write(reply(2005, 0x1234, packet.readUInt16LE(14)));
      else {
        if (command === 1102) assert.equal(packet.subarray(16).toString('hex'), expectedAuth);
        identityReply(socket, packet, command);
      }
    });
    const result = await probeDevice({ ...fake.config, commKey });
    assert.equal(result.status, 'ok');
    assert.equal(result.protocolConnected, true);
    assert.equal(result.identity.serialNumber, 'TEST-SERIAL');
    assert.deepEqual(fake.commands, [1000, 1102, 1100, 11, 11, 11, 1001]);
  });
}

test('rejects checksum corruption after the TCP prefix is accepted', async t => {
  const fake = await fakeDevice(t, (socket, packet) => {
    const frame = reply(2000, 0x1234, packet.readUInt16LE(14));
    frame[10] ^= 1;
    socket.write(frame);
  });
  const result = await probeDevice(fake.config);
  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'INVALID_CHECKSUM');
});

test('rejects identity replies belonging to a different session', async t => {
  const fake = await fakeDevice(t, (socket, packet, command) => {
    if (command === 1000) identityReply(socket, packet, command);
    else socket.write(reply(2000, 0x5678, packet.readUInt16LE(14), Buffer.from('wrong device')));
  });
  const result = await probeDevice(fake.config);
  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'SESSION_MISMATCH');
  assert.equal(result.identity.firmware, null);
});

const { execFile } = await import('node:child_process');
const { promisify } = await import('node:util');
const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');
const exec = promisify(execFile);
const cli = new URL('./attendance-device-test.mjs', import.meta.url).pathname;

async function configFile(t, devices) {
  const directory = await mkdtemp(join(tmpdir(), 'ams-zk-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'devices.json');
  await writeFile(path, JSON.stringify({ devices }));
  return path;
}

test('CLI selects one machine and emits parseable JSON without exposing its communication key', async t => {
  const selected = await fakeDevice(t, identityReply);
  const other = await fakeDevice(t, identityReply);
  const path = await configFile(t, [{ ...selected.config, id: 'selected' }, { ...other.config, id: 'other' }]);
  const { stdout, stderr } = await exec(process.execPath, [cli, '--config', path, '--device', 'selected', '--json']);
  const report = JSON.parse(stdout);
  assert.equal(stderr, '');
  assert.equal(report.results.length, 1);
  assert.equal(report.results[0].id, 'selected');
  assert.equal(report.results[0].status, 'ok');
  assert.equal(other.commands.length, 0);
  assert.equal(stdout.includes('commKey'), false);
});

test('CLI returns configuration exit code 2 for an unknown selection without contacting devices', async t => {
  const fake = await fakeDevice(t, identityReply);
  const path = await configFile(t, [fake.config]);
  await assert.rejects(exec(process.execPath, [cli, '--config', path, '--device', 'unknown']), error => error.code === 2 && /unknown/i.test(error.stderr));
  assert.equal(fake.commands.length, 0);
});

test('CLI reports failed devices in JSON and returns exit code 1', async t => {
  const fake = await fakeDevice(t, socket => socket.destroy());
  const path = await configFile(t, [fake.config]);
  await assert.rejects(exec(process.execPath, [cli, '--config', path, '--json']), error => {
    assert.equal(error.code, 1);
    assert.equal(JSON.parse(error.stdout).results[0].status, 'failed');
    return true;
  });
});

test('handles newer firmware authentication challenge 6001 using only the configured key', async t => {
  const fake = await fakeDevice(t, (socket, packet, command) => {
    if (command === 1000) socket.write(reply(6001, 0x1234, packet.readUInt16LE(14)));
    else {
      if (command === 1102) assert.equal(packet.subarray(16).toString('hex'), '617d326b');
      identityReply(socket, packet, command);
    }
  });
  const result = await probeDevice(fake.config);
  assert.equal(result.status, 'ok');
  assert.equal(result.identity.deviceName, 'X900');
  assert.equal(fake.commands.filter(command => command === 1102).length, 1);
});

test('reports a rejected 6001 authentication exchange without trying other keys', async t => {
  const fake = await fakeDevice(t, (socket, packet, command) => {
    socket.write(reply(command === 1000 ? 6001 : 2032, 0x1234, packet.readUInt16LE(14)));
  });
  const result = await probeDevice(fake.config);
  assert.equal(result.status, 'failed');
  assert.equal(result.protocolConnected, false);
  assert.equal(result.error.code, 'AUTH_FAILED');
  assert.match(result.error.message, /2032/);
  assert.deepEqual(fake.commands, [1000, 1102]);
});
