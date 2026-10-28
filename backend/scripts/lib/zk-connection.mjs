import net from 'node:net';

const MAGIC = Buffer.from([0x50, 0x50, 0x82, 0x7d]);
const READ_ONLY_COMMANDS = new Set([1000, 1001, 1100, 1102, 11]);
const MAX_RESPONSE_BYTES = 65536;

function failure(code, message) {
  return Object.assign(new Error(message), { code });
}

export function validateDevices(config) {
  if (!config || !Array.isArray(config.devices) || !config.devices.length || config.devices.length > 64) {
    throw new Error('Config must contain 1–64 devices.');
  }
  const ids = new Set();
  const endpoints = new Set();
  return config.devices.map(entry => {
    if (!entry || typeof entry.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(entry.id)) {
      throw new Error('Each device needs an id containing letters, numbers, underscores or hyphens.');
    }
    if (ids.has(entry.id)) throw new Error(`Duplicate device id: ${entry.id}`);
    ids.add(entry.id);
    if (typeof entry.ip !== 'string' || net.isIP(entry.ip) !== 4) throw new Error(`${entry.id}: ip must be IPv4.`);
    const port = entry.port ?? 4370;
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${entry.id}: invalid port.`);
    const commKey = entry.commKey ?? 0;
    if (!Number.isInteger(commKey) || commKey < 0 || commKey > 999999) throw new Error(`${entry.id}: commKey must be an integer from 0 to 999999.`);
    const timeoutMs = entry.timeoutMs ?? 5000;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) throw new Error(`${entry.id}: timeoutMs must be 100–30000.`);
    if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') throw new Error(`${entry.id}: enabled must be boolean.`);
    if (entry.name !== undefined && (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 150)) {
      throw new Error(`${entry.id}: invalid name.`);
    }
    const enabled = entry.enabled ?? true;
    const endpoint = `${entry.ip}:${port}`;
    if (enabled && endpoints.has(endpoint)) throw new Error(`Duplicate active endpoint: ${endpoint}`);
    if (enabled) endpoints.add(endpoint);
    return { id: entry.id, name: entry.name ?? entry.id, ip: entry.ip, port, commKey, timeoutMs, enabled };
  });
}

function checksum(bytes) {
  let sum = 0;
  for (let offset = 0; offset < bytes.length; offset += 2) {
    sum += bytes[offset] | ((bytes[offset + 1] ?? 0) << 8);
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  return (~sum) & 0xffff;
}

function encode(command, session, sequence, data) {
  const frame = Buffer.alloc(16 + data.length);
  MAGIC.copy(frame);
  frame.writeUInt32LE(8 + data.length, 4);
  frame.writeUInt16LE(command, 8);
  frame.writeUInt16LE(session, 12);
  frame.writeUInt16LE(sequence, 14);
  data.copy(frame, 16);
  frame.writeUInt16LE(checksum(frame.subarray(8)), 10);
  return frame;
}

function authenticationPayload(key, session) {
  let reversed = 0;
  for (let bit = 0; bit < 32; bit++) reversed = (reversed << 1) | ((key >>> bit) & 1);
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE((reversed + session) >>> 0);
  const mixed = bytes.map((byte, index) => byte ^ Buffer.from('ZKSO')[index]);
  return Buffer.from([mixed[2] ^ 50, mixed[3] ^ 50, 50, mixed[1] ^ 50]);
}

class ZkTcpSession {
  socket = new net.Socket();
  buffer = Buffer.alloc(0);
  pending = null;
  error = null;
  session = 0;
  sequence = 1;
  authenticated = false;

  constructor(device) {
    this.device = device;
    this.socket.on('error', error => this.fail(error));
    this.socket.on('close', () => this.fail(failure('CONNECTION_CLOSED', 'Peer closed the connection.')));
    this.socket.on('data', chunk => {
      try {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        if (this.buffer.length > MAX_RESPONSE_BYTES * 2) throw failure('INVALID_FRAME', 'Response exceeds diagnostic memory limit.');
        while (this.buffer.length >= 8) {
          if (!this.buffer.subarray(0, 4).equals(MAGIC)) throw failure('INVALID_FRAME', 'Peer did not return ZK TCP framing.');
          const length = this.buffer.readUInt32LE(4);
          if (length < 8 || length > MAX_RESPONSE_BYTES) throw failure('INVALID_FRAME', 'Invalid ZK frame length.');
          if (this.buffer.length < length + 8) return;
          const body = this.buffer.subarray(8, length + 8);
          this.buffer = this.buffer.subarray(length + 8);
          if (checksum(body) !== 0) throw failure('INVALID_CHECKSUM', 'ZK reply checksum does not match.');
          if (body.readUInt16LE(0) === 500) continue;
          if (!this.pending) throw failure('UNEXPECTED_REPLY', 'Unsolicited non-event ZK response.');
          if (this.authenticated && body.readUInt16LE(4) !== this.session) throw failure('SESSION_MISMATCH', 'Reply belongs to another ZK session.');
          this.session = body.readUInt16LE(4);
          this.sequence = (body.readUInt16LE(6) + 1) & 0xffff;
          const { resolve } = this.pending;
          this.settle();
          resolve({ code: body.readUInt16LE(0), data: Buffer.from(body.subarray(8)) });
        }
      } catch (error) { this.fail(error); }
    });
  }

  settle() {
    clearTimeout(this.pending?.timer);
    this.pending = null;
  }

  fail(error) {
    this.error ??= error;
    if (this.pending) {
      const { reject } = this.pending;
      this.settle();
      reject(this.error);
    }
    this.socket.destroy();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const finish = error => {
        clearTimeout(timer);
        this.socket.off('connect', connected);
        this.socket.off('error', failed);
        this.socket.off('close', closed);
        if (error) reject(error); else resolve();
      };
      const connected = () => finish();
      const failed = error => finish(error);
      const closed = () => finish(this.error ?? failure('CONNECTION_CLOSED', 'Connection closed before handshake.'));
      const timer = setTimeout(() => {
        const error = failure('TIMEOUT', 'TCP connection timed out.');
        finish(error);
        this.fail(error);
      }, this.device.timeoutMs);
      this.socket.once('connect', connected);
      this.socket.once('error', failed);
      this.socket.once('close', closed);
      this.socket.connect(this.device.port, this.device.ip);
    });
  }

  request(command, data = Buffer.alloc(0)) {
    if (!READ_ONLY_COMMANDS.has(command)) throw new Error('Command is outside the diagnostic allowlist.');
    if (this.error || this.socket.destroyed) return Promise.reject(this.error ?? failure('CONNECTION_CLOSED', 'Socket is closed.'));
    if (this.pending) throw new Error('Only one request may be active per device.');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(failure('TIMEOUT', `ZK command ${command} timed out.`)), this.device.timeoutMs);
      this.pending = { resolve, reject, timer };
      this.socket.write(encode(command, this.session, this.sequence, data), error => { if (error) this.fail(error); });
    });
  }
}

function requireSuccess(response) {
  if (response.code === 2005) throw failure('AUTH_REQUIRED', 'Device requires authentication; confirm its communication key.');
  if (response.code !== 2000 && response.code !== 2002) throw failure('COMMAND_REJECTED', `Device returned ZK code ${response.code}.`);
  return response.data;
}

export async function probeDevice(input) {
  const device = validateDevices({ devices: [input] })[0];
  const started = Date.now();
  const result = {
    id: device.id, name: device.name, ip: device.ip, port: device.port,
    checkedAt: new Date().toISOString(), status: 'failed', tcpConnected: false, protocolConnected: false,
    identity: { firmware: null, serialNumber: null, deviceName: null, platform: null }, warnings: [], error: null,
  };
  const connection = new ZkTcpSession(device);
  try {
    await connection.connect();
    result.tcpConnected = true;
    let handshake = await connection.request(1000);
    if (handshake.code === 2005 || handshake.code === 6001) {
      handshake = await connection.request(1102, authenticationPayload(device.commKey, connection.session));
      if (handshake.code !== 2000) throw failure('AUTH_FAILED', `Device rejected authentication (ZK code ${handshake.code}). Check the communication key and firmware/protocol compatibility.`);
    }
    if (handshake.code !== 2000) throw failure('HANDSHAKE_REJECTED', `ZK handshake returned code ${handshake.code}.`);
    connection.authenticated = true;
    result.protocolConnected = true;
    const reads = [
      ['firmware', 1100, ''], ['serialNumber', 11, '~SerialNumber'],
      ['deviceName', 11, '~DeviceName'], ['platform', 11, '~Platform'],
    ];
    for (const [field, command, option] of reads) {
      try {
        const response = await connection.request(command, option ? Buffer.from(option + '\0', 'ascii') : Buffer.alloc(0));
        let value = requireSuccess(response).toString('utf8').replace(/\0/g, '').trim();
        if (option && value.includes('=')) value = value.slice(value.indexOf('=') + 1).trim();
        if (!value || value.length > 512) throw failure('FIELD_UNAVAILABLE', `Device did not return a usable ${field}.`);
        result.identity[field] = value;
      } catch (error) {
        if (!['COMMAND_REJECTED', 'FIELD_UNAVAILABLE'].includes(error.code)) throw error;
        result.warnings.push({ field, code: error.code, message: error.message });
      }
    }
    result.status = result.warnings.length ? 'partial' : 'ok';
  } catch (error) {
    result.error = { code: error.code ?? 'CONNECTION_ERROR', message: error.message };
  } finally {
    if (result.protocolConnected && !connection.error && !connection.socket.destroyed) {
      try { requireSuccess(await connection.request(1001)); }
      catch (error) {
        result.warnings.push({ field: 'disconnect', code: error.code ?? 'DISCONNECT_ERROR', message: error.message });
        if (result.status === 'ok') result.status = 'partial';
      }
    }
    connection.socket.destroy();
    result.durationMs = Date.now() - started;
  }
  return result;
}

export async function runDiagnostics(devices) {
  const validated = validateDevices({ devices });
  const results = [];
  for (const device of validated.filter(device => device.enabled)) results.push(await probeDevice(device));
  return results;
}
