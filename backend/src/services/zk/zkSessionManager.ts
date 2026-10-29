import net from "node:net";
import {
  ZK_MAGIC,
  ZK_CMD,
  checksum,
  encodeZkFrame,
  authenticationPayload,
  parseAttendanceRecordsBuffer,
  RawDevicePunch,
} from "./zkProtocol";

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10MB limit for bulk att logs
export const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes without process

export interface DeviceConfig {
  id: number;
  ip: string;
  port: number;
  commKey: number;
  timeoutMs?: number;
}

export interface DeviceIdentity {
  firmware: string | null;
  serialNumber: string | null;
  deviceName: string | null;
  platform: string | null;
}

export interface SessionInfo {
  deviceId: number;
  status: "CONNECTED" | "DISCONNECTED" | "CONNECTING" | "ERROR";
  connectedAt: Date | null;
  lastActivityAt: Date | null;
  idleTimeoutMs: number;
  identity: DeviceIdentity;
  error?: string | null;
}

export class ZkClient {
  private socket: net.Socket = new net.Socket();
  private buffer: Buffer = Buffer.alloc(0);
  private pending: { resolve: (res: { code: number; data: Buffer }) => void; reject: (err: any) => void; timer: NodeJS.Timeout } | null = null;
  private streamingBuffer: Buffer = Buffer.alloc(0);
  private isStreaming: boolean = false;
  private streamingResolve: ((records: RawDevicePunch[]) => void) | null = null;
  private streamingReject: ((err: any) => void) | null = null;
  private session: number = 0;
  private sequence: number = 1;
  public authenticated: boolean = false;
  public error: Error | null = null;

  constructor(public readonly config: DeviceConfig) {
    this.setupSocket();
  }

  private setupSocket() {
    this.socket.on("error", (err) => this.handleError(err));
    this.socket.on("close", () => this.handleError(new Error("Peer closed connection")));
    this.socket.on("data", (chunk) => this.onData(chunk));
  }

  private handleError(err: Error) {
    this.error ??= err;
    if (this.pending) {
      const { reject, timer } = this.pending;
      clearTimeout(timer);
      this.pending = null;
      reject(this.error);
    }
    if (this.streamingReject) {
      const rej = this.streamingReject;
      this.streamingReject = null;
      this.streamingResolve = null;
      rej(this.error);
    }
    this.socket.destroy();
  }

  private onData(chunk: Buffer) {
    try {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      if (this.buffer.length > MAX_RESPONSE_BYTES) {
        throw new Error("ZK response exceeds memory bound");
      }

      while (this.buffer.length >= 8) {
        if (!this.buffer.subarray(0, 4).equals(ZK_MAGIC)) {
          throw new Error("Peer did not return ZK TCP framing");
        }
        const length = this.buffer.readUInt32LE(4);
        if (length < 8 || length > MAX_RESPONSE_BYTES) {
          throw new Error("Invalid ZK frame length");
        }
        if (this.buffer.length < length + 8) return; // wait for full frame

        const body = this.buffer.subarray(8, length + 8);
        this.buffer = this.buffer.subarray(length + 8);

        if (checksum(body) !== 0) {
          throw new Error("ZK reply checksum does not match");
        }

        const replyCode = body.readUInt16LE(0);
        if (replyCode === 500) continue; // ACK_UNREG / ping

        this.session = body.readUInt16LE(4);
        this.sequence = (body.readUInt16LE(6) + 1) & 0xffff;
        const payload = Buffer.from(body.subarray(8));

        // If streaming data
        if (this.isStreaming) {
          if (replyCode === ZK_CMD.DATA || replyCode === ZK_CMD.PREPARE_DATA) {
            // Data chunk
            this.streamingBuffer = Buffer.concat([this.streamingBuffer, payload]);
          } else if (replyCode === ZK_CMD.ACK_OK) {
            // End of stream
            this.isStreaming = false;
            const records = parseAttendanceRecordsBuffer(this.streamingBuffer);
            if (this.streamingResolve) {
              const res = this.streamingResolve;
              this.streamingResolve = null;
              this.streamingReject = null;
              res(records);
            }
          }
        }

        if (this.pending) {
          const { resolve, timer } = this.pending;
          clearTimeout(timer);
          this.pending = null;
          resolve({ code: replyCode, data: payload });
        }
      }
    } catch (err: any) {
      this.handleError(err);
    }
  }

  public async connect(): Promise<void> {
    const timeout = this.config.timeoutMs || 5000;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("TCP connection timed out"));
      }, timeout);

      const cleanup = () => {
        clearTimeout(timer);
        this.socket.off("connect", onConnect);
        this.socket.off("error", onError);
      };

      const onConnect = () => {
        cleanup();
        resolve();
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      this.socket.once("connect", onConnect);
      this.socket.once("error", onError);
      this.socket.connect(this.config.port, this.config.ip);
    });
  }

  public request(command: number, data: Buffer = Buffer.alloc(0)): Promise<{ code: number; data: Buffer }> {
    if (this.error || this.socket.destroyed) {
      return Promise.reject(this.error || new Error("Socket is closed"));
    }
    const timeout = this.config.timeoutMs || 5000;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        reject(new Error(`ZK command ${command} timed out`));
      }, timeout);

      this.pending = { resolve, reject, timer };
      const frame = encodeZkFrame(command, this.session, this.sequence, data);
      this.socket.write(frame, (err) => {
        if (err) this.handleError(err);
      });
    });
  }

  public async authenticate(): Promise<void> {
    let handshake = await this.request(ZK_CMD.CONNECT);
    if (handshake.code === ZK_CMD.ACK_UNAUTH || handshake.code === 6001) {
      const auth = await this.request(ZK_CMD.AUTH, authenticationPayload(this.config.commKey, this.session));
      if (auth.code !== ZK_CMD.ACK_OK) {
        throw new Error(`Device rejected authentication (code: ${auth.code})`);
      }
    } else if (handshake.code !== ZK_CMD.ACK_OK) {
      throw new Error(`ZK handshake rejected (code: ${handshake.code})`);
    }
    this.authenticated = true;
  }

  public async readIdentity(): Promise<DeviceIdentity> {
    const identity: DeviceIdentity = {
      firmware: null,
      serialNumber: null,
      deviceName: null,
      platform: null,
    };

    const reads: [keyof DeviceIdentity, number, string][] = [
      ["firmware", ZK_CMD.GET_VERSION, ""],
      ["serialNumber", ZK_CMD.OPTIONS_RRQ, "~SerialNumber"],
      ["deviceName", ZK_CMD.OPTIONS_RRQ, "~DeviceName"],
      ["platform", ZK_CMD.OPTIONS_RRQ, "~Platform"],
    ];

    for (const [key, cmd, opt] of reads) {
      try {
        const res = await this.request(cmd, opt ? Buffer.from(opt + "\0", "ascii") : Buffer.alloc(0));
        let val = res.data.toString("utf8").replace(/\0/g, "").trim();
        if (opt && val.includes("=")) val = val.slice(val.indexOf("=") + 1).trim();
        if (val) identity[key] = val;
      } catch {
        // Optional parameter
      }
    }

    return identity;
  }

  public async fetchAttendanceLogs(): Promise<RawDevicePunch[]> {
    this.isStreaming = true;
    this.streamingBuffer = Buffer.alloc(0);

    return new Promise<RawDevicePunch[]>((resolve, reject) => {
      this.streamingResolve = resolve;
      this.streamingReject = reject;

      // Send CMD_ATTLOG_RRQ (13)
      this.request(ZK_CMD.ATTLOG_RRQ).catch((err) => {
        this.isStreaming = false;
        reject(err);
      });
    });
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.authenticated && !this.socket.destroyed) {
        await this.request(ZK_CMD.EXIT).catch(() => {});
      }
    } finally {
      this.socket.destroy();
    }
  }
}

export type DisconnectListener = (deviceId: number, reason: string) => void | Promise<void>;

export class AttendanceDeviceSessionManager {
  private static instance: AttendanceDeviceSessionManager | null = null;
  private sessions: Map<number, { client: ZkClient | null; info: SessionInfo; idleTimer: NodeJS.Timeout | null }> = new Map();
  private idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS;
  private disconnectListeners: DisconnectListener[] = [];

  private constructor() {}

  public static getInstance(): AttendanceDeviceSessionManager {
    if (!AttendanceDeviceSessionManager.instance) {
      AttendanceDeviceSessionManager.instance = new AttendanceDeviceSessionManager();
    }
    return AttendanceDeviceSessionManager.instance;
  }

  public onDisconnect(listener: DisconnectListener) {
    this.disconnectListeners.push(listener);
  }

  public setIdleTimeoutMs(ms: number) {
    this.idleTimeoutMs = ms;
  }

  public getSessionInfo(deviceId: number): SessionInfo {
    const entry = this.sessions.get(deviceId);
    if (!entry) {
      return {
        deviceId,
        status: "DISCONNECTED",
        connectedAt: null,
        lastActivityAt: null,
        idleTimeoutMs: this.idleTimeoutMs,
        identity: { firmware: null, serialNumber: null, deviceName: null, platform: null },
      };
    }
    return entry.info;
  }

  public getIdleSecondsLeft(deviceId: number): number | null {
    const entry = this.sessions.get(deviceId);
    if (!entry || entry.info.status !== "CONNECTED" || !entry.info.lastActivityAt) {
      return null;
    }
    const elapsed = Date.now() - entry.info.lastActivityAt.getTime();
    const remaining = Math.max(0, Math.floor((this.idleTimeoutMs - elapsed) / 1000));
    return remaining;
  }

  public async connect(config: DeviceConfig, mockClient?: ZkClient): Promise<SessionInfo> {
    await this.disconnect(config.id);

    const info: SessionInfo = {
      deviceId: config.id,
      status: "CONNECTING",
      connectedAt: null,
      lastActivityAt: new Date(),
      idleTimeoutMs: this.idleTimeoutMs,
      identity: { firmware: null, serialNumber: null, deviceName: null, platform: null },
    };

    const entry = {
      client: mockClient || new ZkClient(config),
      info,
      idleTimer: null as NodeJS.Timeout | null,
    };
    this.sessions.set(config.id, entry);

    try {
      if (!mockClient) {
        await entry.client.connect();
        await entry.client.authenticate();
        entry.info.identity = await entry.client.readIdentity();
      }

      entry.info.status = "CONNECTED";
      entry.info.connectedAt = new Date();
      entry.info.lastActivityAt = new Date();
      this.resetIdleTimer(config.id);
      return entry.info;
    } catch (err: any) {
      entry.info.status = "ERROR";
      entry.info.error = err.message || "Failed to connect to attendance device";
      if (entry.client) {
        await entry.client.disconnect().catch(() => {});
      }
      throw err;
    }
  }

  public touchActivity(deviceId: number) {
    const entry = this.sessions.get(deviceId);
    if (entry && entry.info.status === "CONNECTED") {
      entry.info.lastActivityAt = new Date();
      this.resetIdleTimer(deviceId);
    }
  }

  private resetIdleTimer(deviceId: number) {
    const entry = this.sessions.get(deviceId);
    if (!entry) return;

    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = null;
    }

    entry.idleTimer = setTimeout(async () => {
      console.log(`[AttendanceDeviceSessionManager] Device ${deviceId} reached 5-minute idle limit. Auto-disconnecting.`);
      await this.disconnect(deviceId, "IDLE_TIMEOUT");
    }, this.idleTimeoutMs);
  }

  public async fetchAttendanceLogs(deviceId: number): Promise<RawDevicePunch[]> {
    const entry = this.sessions.get(deviceId);
    if (!entry || entry.info.status !== "CONNECTED" || !entry.client) {
      throw new Error(`Device ${deviceId} is not connected`);
    }

    this.touchActivity(deviceId);
    return await entry.client.fetchAttendanceLogs();
  }

  public async disconnect(deviceId: number, reason: string = "USER_REQUEST"): Promise<void> {
    const entry = this.sessions.get(deviceId);
    if (!entry) return;

    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = null;
    }

    if (entry.client) {
      await entry.client.disconnect().catch(() => {});
      entry.client = null;
    }

    entry.info.status = "DISCONNECTED";
    entry.info.connectedAt = null;
    entry.info.lastActivityAt = null;
    entry.info.error = null;

    for (const listener of this.disconnectListeners) {
      try {
        await listener(deviceId, reason);
      } catch (err) {
        console.error(`[AttendanceDeviceSessionManager] Error in disconnect listener for device ${deviceId}:`, err);
      }
    }
  }

  public async disconnectAll(): Promise<void> {
    for (const deviceId of Array.from(this.sessions.keys())) {
      await this.disconnect(deviceId);
    }
    this.sessions.clear();
  }
}

export const attendanceDeviceSessionManager = AttendanceDeviceSessionManager.getInstance();
