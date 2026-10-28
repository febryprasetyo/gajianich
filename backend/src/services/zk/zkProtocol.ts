export const ZK_MAGIC = Buffer.from([0x50, 0x50, 0x82, 0x7d]);

export const ZK_CMD = {
  CONNECT: 1000,
  EXIT: 1001,
  GET_VERSION: 1100,
  AUTH: 1102,
  OPTIONS_RRQ: 11,
  ATTLOG_RRQ: 13,
  PREPARE_DATA: 1500,
  DATA: 1501,
  FREE_DATA: 1502,
  ACK_OK: 2000,
  ACK_ERROR: 2001,
  ACK_DATA: 2002,
  ACK_UNAUTH: 2005,
} as const;

export interface RawDevicePunch {
  pin: string;
  timestamp: string; // YYYY-MM-DD HH:mm:ss
  workDate: string;  // YYYY-MM-DD
  verifyMode: "Fingerprint" | "Face" | "Password" | "Card";
  inOutState: "Masuk" | "Pulang" | "Scan Antara";
  rawStatus: number;
  rawVerify: number;
}

export function checksum(bytes: Buffer): number {
  let sum = 0;
  for (let offset = 0; offset < bytes.length; offset += 2) {
    sum += bytes[offset] | ((bytes[offset + 1] ?? 0) << 8);
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  return (~sum) & 0xffff;
}

export function encodeZkFrame(command: number, session: number, sequence: number, data: Buffer = Buffer.alloc(0)): Buffer {
  const frame = Buffer.alloc(16 + data.length);
  ZK_MAGIC.copy(frame);
  frame.writeUInt32LE(8 + data.length, 4);
  frame.writeUInt16LE(command, 8);
  frame.writeUInt16LE(session, 12);
  frame.writeUInt16LE(sequence, 14);
  data.copy(frame, 16);
  frame.writeUInt16LE(checksum(frame.subarray(8)), 10);
  return frame;
}

export function authenticationPayload(key: number, session: number): Buffer {
  let reversed = 0;
  for (let bit = 0; bit < 32; bit++) reversed = (reversed << 1) | ((key >>> bit) & 1);
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE((reversed + session) >>> 0);
  const mixed = bytes.map((byte, index) => byte ^ Buffer.from("ZKSO")[index]);
  return Buffer.from([mixed[2] ^ 50, mixed[3] ^ 50, 50, mixed[1] ^ 50]);
}

export function decodeZkTime(rawTime: number): string {
  const second = rawTime % 60;
  let remaining = Math.floor(rawTime / 60);
  const minute = remaining % 60;
  remaining = Math.floor(remaining / 60);
  const hour = remaining % 24;
  remaining = Math.floor(remaining / 24);
  const day = (remaining % 31) + 1;
  remaining = Math.floor(remaining / 31);
  const month = (remaining % 12) + 1;
  remaining = Math.floor(remaining / 12);
  const year = remaining + 2000;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

export function encodeZkTime(dateStr: string): number {
  const [datePart, timePart] = dateStr.split(" ");
  const [yearStr, monthStr, dayStr] = datePart.split("-");
  const [hourStr, minStr, secStr] = (timePart || "00:00:00").split(":");

  const year = parseInt(yearStr, 10) - 2000;
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10) - 1;
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);
  const second = parseInt(secStr || "0", 10);

  const days = (year * 12 + month) * 31 + day;
  return (days * 24 + hour) * 3600 + minute * 60 + second;
}

export function mapVerifyMode(modeNum: number): "Fingerprint" | "Face" | "Password" | "Card" {
  switch (modeNum) {
    case 15:
    case 20:
      return "Face";
    case 0:
      return "Password";
    case 2:
      return "Card";
    case 1:
    default:
      return "Fingerprint";
  }
}

export function mapInOutState(stateNum: number): "Masuk" | "Pulang" | "Scan Antara" {
  switch (stateNum) {
    case 0:
    case 4:
      return "Masuk";
    case 1:
    case 5:
      return "Pulang";
    default:
      return "Scan Antara";
  }
}

export function parse40ByteAttendanceRecord(buffer: Buffer): RawDevicePunch | null {
  if (buffer.length < 40) return null;

  let nullPos = buffer.indexOf(0, 0);
  if (nullPos === -1 || nullPos > 24) nullPos = 24;
  const pin = buffer.toString("ascii", 0, nullPos).trim();
  if (!pin) return null;

  const rawStatus = buffer[24];
  const rawVerify = buffer[25];
  const rawTime = buffer.readUInt32LE(26);

  const timestamp = decodeZkTime(rawTime);
  const workDate = timestamp.slice(0, 10);

  return {
    pin,
    timestamp,
    workDate,
    verifyMode: mapVerifyMode(rawVerify),
    inOutState: mapInOutState(rawStatus),
    rawStatus,
    rawVerify,
  };
}

export function parseAttendanceRecordsBuffer(buffer: Buffer): RawDevicePunch[] {
  const records: RawDevicePunch[] = [];
  const RECORD_SIZE = 40;

  for (let offset = 0; offset + RECORD_SIZE <= buffer.length; offset += RECORD_SIZE) {
    const chunk = buffer.subarray(offset, offset + RECORD_SIZE);
    const parsed = parse40ByteAttendanceRecord(chunk);
    if (parsed) {
      records.push(parsed);
    }
  }

  return records;
}
