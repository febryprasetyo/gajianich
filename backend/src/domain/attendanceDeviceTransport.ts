interface ConnectionDevice {
  connectionType: string;
  isEnabled: boolean;
  status: string;
  lastAdmsSeenAt?: Date | null;
}
export function attendanceConnectionStatus(device: ConnectionDevice, sessionStatus: string, now = Date.now()): 'connected' | 'disconnected' | 'error' {
  if (!device.isEnabled) return 'disconnected';
  if (device.connectionType === 'ADMS') {
    const age = device.lastAdmsSeenAt ? now - device.lastAdmsSeenAt.getTime() : Infinity;
    return age >= 0 && age <= 180000 ? 'connected' : 'disconnected';
  }
  return sessionStatus === 'CONNECTED' ? 'connected' : device.status === 'ERROR' ? 'error' : 'disconnected';
}
export function attendanceIdentitySourceId(deviceId: number, source: string | null, configuredId: string | null): number {
  if (source !== 'ADMS' && source !== 'MANUAL_IMPORT') return deviceId;
  const id = Number(configuredId);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}
