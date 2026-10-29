export interface DocumentProfileSnapshot {
  groupId: number; organizationId: number; kind: 'LEAVE' | 'GA';
  templateVersionId: number; identityVersionId: number; layoutKey: string;
  identity: { name: string; address: string | null; logoAssetKey: string };
  labels: Record<string, string>;
  signatories: Array<{ key: string; label: string; name: string | null }>;
}
