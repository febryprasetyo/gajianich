export interface DocumentProfileSnapshot {
  groupId: number; organizationId: number; kind: 'LEAVE' | 'GA';
  templateVersionId: number; identityVersionId: number; layoutKey: string;
  identity: { name: string; address: string | null; logoAssetKey: string };
  labels: Record<string, string>;
  signatories: Array<{ key: string; label: string; name: string | null }>;
}

export interface LeaveDocumentOrganizationOption {
  organizationId: number;
  groupId: number;
  name: string;
  logoAssetKey: string;
  isEmployeeDefault: boolean;
}

export interface OrganizationLogoRow {
  organizationId: number;
  groupId: number;
  code?: string;
  name: string;
  logoAssetKey: string | null;
  version: number | null;
  updatedAt: string | null;
}
