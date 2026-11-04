import { createHash } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  documentAssets,
  documentProfiles,
  documentTemplateVersions,
  documentIdentityVersions,
  type DocumentAssetMimeType,
  type DocumentKind,
  type DocumentProfileSnapshot,
} from '../db/schema/documentProfiles';
import { organizations, organizationGroups } from '../db/schema/organizations';
import { appendHrAudit } from './hrAudit';
import type { AuditContext } from '../domain/hrAudit';

export type { DocumentAssetMimeType, DocumentKind, DocumentProfileSnapshot } from '../db/schema/documentProfiles';

export const MAX_LOGO_BYTE_SIZE = 524288; // 512 KB

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
  code: string;
  name: string;
  logoAssetKey: string | null;
  version: number | null;
  updatedAt: string | null;
}

export class DocumentProfileUnavailableError extends Error {
  readonly status = 409;
  constructor(message = 'Profil dokumen resmi belum tersedia untuk organisasi ini. Hubungi administrator.') {
    super(message);
  }
}

export class DocumentLogoValidationError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export class IssuingOrganizationInvalidError extends Error {
  readonly status = 422;
  readonly statusCode = 422;
  constructor(message = 'Organisasi tidak valid untuk form cuti') {
    super(message);
  }
}

export async function resolveIssuingOrganizationForLeave(
  tx: Pick<NodePgDatabase<any>, 'select'>,
  input: {
    groupId: number;
    defaultOrganizationId: number | null | undefined;
    requestedOrganizationId?: number | null | undefined;
    canSelectOrganization: boolean;
  }
): Promise<{
  organizationId: number | null;
  documentProfileSnapshot: DocumentProfileSnapshot | null;
}> {
  const explicitOrgId =
    input.canSelectOrganization &&
    input.requestedOrganizationId !== undefined &&
    input.requestedOrganizationId !== null
      ? Number(input.requestedOrganizationId)
      : null;

  if (explicitOrgId !== null) {
    if (!Number.isSafeInteger(explicitOrgId) || explicitOrgId <= 0) {
      throw new IssuingOrganizationInvalidError();
    }
    try {
      const snapshot = await resolveDocumentProfile(tx, {
        groupId: input.groupId,
        organizationId: explicitOrgId,
        kind: 'LEAVE',
      });
      return {
        organizationId: explicitOrgId,
        documentProfileSnapshot: snapshot,
      };
    } catch (err) {
      if (err instanceof DocumentProfileUnavailableError) {
        throw new IssuingOrganizationInvalidError();
      }
      throw err;
    }
  }

  const fallbackOrgId = input.defaultOrganizationId ?? null;
  if (!fallbackOrgId) {
    return {
      organizationId: null,
      documentProfileSnapshot: null,
    };
  }

  try {
    const snapshot = await resolveDocumentProfile(tx, {
      groupId: input.groupId,
      organizationId: fallbackOrgId,
      kind: 'LEAVE',
    });
    return {
      organizationId: fallbackOrgId,
      documentProfileSnapshot: snapshot,
    };
  } catch (err) {
    if (err instanceof DocumentProfileUnavailableError) {
      return {
        organizationId: fallbackOrgId,
        documentProfileSnapshot: null,
      };
    }
    throw err;
  }
}

/**
 * Inspect file magic bytes to verify PNG, JPEG, or WebP format.
 * SVG and any other formats are strictly rejected.
 */
export function detectImageMime(buffer: Buffer): DocumentAssetMimeType | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

export async function resolveDocumentProfile(
  tx: Pick<NodePgDatabase<any>, 'select'>,
  input: { groupId: number; organizationId: number; kind: DocumentKind }
): Promise<DocumentProfileSnapshot> {
  const [row] = await tx
    .select({
      profile: documentProfiles,
      template: documentTemplateVersions,
      identity: documentIdentityVersions,
    })
    .from(documentProfiles)
    .innerJoin(
      documentTemplateVersions,
      and(
        eq(documentProfiles.templateVersionId, documentTemplateVersions.id),
        eq(documentProfiles.groupId, documentTemplateVersions.groupId),
        eq(documentProfiles.kind, documentTemplateVersions.kind)
      )
    )
    .innerJoin(
      documentIdentityVersions,
      and(
        eq(documentProfiles.identityVersionId, documentIdentityVersions.id),
        eq(documentProfiles.groupId, documentIdentityVersions.groupId),
        eq(documentProfiles.organizationId, documentIdentityVersions.organizationId)
      )
    )
    .innerJoin(
      organizations,
      and(
        eq(organizations.id, documentProfiles.organizationId),
        eq(organizations.groupId, documentProfiles.groupId)
      )
    )
    .innerJoin(organizationGroups, eq(organizationGroups.id, documentProfiles.groupId))
    .where(
      and(
        eq(documentProfiles.groupId, input.groupId),
        eq(documentProfiles.organizationId, input.organizationId),
        eq(documentProfiles.kind, input.kind),
        eq(documentProfiles.isActive, true),
        eq(documentTemplateVersions.isActive, true),
        eq(documentIdentityVersions.isActive, true),
        eq(organizations.isActive, true),
        eq(organizationGroups.isActive, true)
      )
    );
  const supportedLayouts = input.kind === 'GA' ? ['cmc-ga-v1'] : ['cmc-leave-f4-v1', 'cmc-leave-f4-new-v1'];
  if (
    !row ||
    !supportedLayouts.includes(row.template.layoutKey) ||
    !row.identity.logoAssetKey.trim() ||
    !row.identity.name.trim() ||
    !row.identity.approvedReference.trim() ||
    !row.template.approvedReference.trim()
  ) {
    throw new DocumentProfileUnavailableError();
  }
  return structuredClone({
    ...input,
    templateVersionId: row.template.id,
    identityVersionId: row.identity.id,
    layoutKey: row.template.layoutKey,
    identity: {
      name: row.identity.name,
      address: row.identity.address,
      logoAssetKey: row.identity.logoAssetKey,
    },
    labels: row.template.labels,
    signatories: row.template.signatories,
  });
}

export async function listLeaveDocumentOrganizations(
  tx: Pick<NodePgDatabase<any>, 'select'>,
  input: { groupId: number; defaultOrganizationId?: number | null }
): Promise<LeaveDocumentOrganizationOption[]> {
  const rows = await tx
    .select({
      organizationId: organizations.id,
      groupId: organizations.groupId,
      name: documentIdentityVersions.name,
      logoAssetKey: documentIdentityVersions.logoAssetKey,
      layoutKey: documentTemplateVersions.layoutKey,
      identityApprovedRef: documentIdentityVersions.approvedReference,
      templateApprovedRef: documentTemplateVersions.approvedReference,
    })
    .from(documentProfiles)
    .innerJoin(
      documentTemplateVersions,
      and(
        eq(documentProfiles.templateVersionId, documentTemplateVersions.id),
        eq(documentProfiles.groupId, documentTemplateVersions.groupId),
        eq(documentProfiles.kind, documentTemplateVersions.kind)
      )
    )
    .innerJoin(
      documentIdentityVersions,
      and(
        eq(documentProfiles.identityVersionId, documentIdentityVersions.id),
        eq(documentProfiles.groupId, documentIdentityVersions.groupId),
        eq(documentProfiles.organizationId, documentIdentityVersions.organizationId)
      )
    )
    .innerJoin(
      organizations,
      and(
        eq(organizations.id, documentProfiles.organizationId),
        eq(organizations.groupId, documentProfiles.groupId)
      )
    )
    .innerJoin(organizationGroups, eq(organizationGroups.id, documentProfiles.groupId))
    .where(
      and(
        eq(documentProfiles.groupId, input.groupId),
        eq(documentProfiles.kind, 'LEAVE'),
        eq(documentProfiles.isActive, true),
        eq(documentTemplateVersions.isActive, true),
        eq(documentIdentityVersions.isActive, true),
        eq(organizations.isActive, true),
        eq(organizationGroups.isActive, true)
      )
    )
    .orderBy(asc(organizations.id));

  const supportedLayouts = ['cmc-leave-f4-v1', 'cmc-leave-f4-new-v1'];
  return rows
    .filter(
      (r) =>
        supportedLayouts.includes(r.layoutKey) &&
        r.logoAssetKey.trim().length > 0 &&
        r.name.trim().length > 0 &&
        r.identityApprovedRef.trim().length > 0 &&
        r.templateApprovedRef.trim().length > 0
    )
    .map((r) => ({
      organizationId: r.organizationId,
      groupId: r.groupId,
      name: r.name,
      logoAssetKey: r.logoAssetKey,
      isEmployeeDefault: input.defaultOrganizationId != null && r.organizationId === input.defaultOrganizationId,
    }));
}

export async function listOrganizationLogos(
  tx: Pick<NodePgDatabase<any>, 'select'>,
  allowedGroupIds: number[]
): Promise<OrganizationLogoRow[]> {
  const orgWhere = allowedGroupIds.length
    ? and(eq(organizations.isActive, true), inArray(organizations.groupId, allowedGroupIds))
    : eq(organizations.isActive, true);

  const orgRows = await tx
    .select({
      id: organizations.id,
      groupId: organizations.groupId,
      code: organizations.code,
      name: organizations.name,
    })
    .from(organizations)
    .innerJoin(organizationGroups, eq(organizationGroups.id, organizations.groupId))
    .where(and(orgWhere, eq(organizationGroups.isActive, true)))
    .orderBy(asc(organizations.groupId), asc(organizations.id));

  if (orgRows.length === 0) return [];

  const orgIds = orgRows.map((o) => o.id);
  const activeIdentities = await tx
    .select({
      organizationId: documentIdentityVersions.organizationId,
      logoAssetKey: documentIdentityVersions.logoAssetKey,
      version: documentIdentityVersions.version,
      createdAt: documentIdentityVersions.createdAt,
    })
    .from(documentIdentityVersions)
    .where(
      and(
        inArray(documentIdentityVersions.organizationId, orgIds),
        eq(documentIdentityVersions.isActive, true)
      )
    )
    .orderBy(desc(documentIdentityVersions.version));

  const identityByOrg = new Map<number, (typeof activeIdentities)[number]>();
  for (const row of activeIdentities) {
    if (!identityByOrg.has(row.organizationId)) {
      identityByOrg.set(row.organizationId, row);
    }
  }

  return orgRows.map((org) => {
    const active = identityByOrg.get(org.id);
    return {
      organizationId: org.id,
      groupId: org.groupId,
      code: org.code,
      name: org.name,
      logoAssetKey: active?.logoAssetKey ?? null,
      version: active?.version ?? null,
      updatedAt: active?.createdAt ? active.createdAt.toISOString() : null,
    };
  });
}

export async function getDocumentAssetById(
  tx: Pick<NodePgDatabase<any>, 'select'>,
  assetId: number,
  allowedGroupIds?: number[] | null
) {
  if (!Number.isSafeInteger(assetId) || assetId <= 0) return null;
  const conditions = [eq(documentAssets.id, assetId)];
  if (Array.isArray(allowedGroupIds)) {
    if (allowedGroupIds.length === 0) return null;
    conditions.push(inArray(documentAssets.groupId, allowedGroupIds));
  }
  const [asset] = await tx
    .select()
    .from(documentAssets)
    .where(and(...conditions))
    .limit(1);
  return asset || null;
}

export async function uploadOrganizationLogo(
  database: NodePgDatabase<any>,
  input: {
    organizationId: number;
    allowedGroupIds?: number[] | null;
    buffer: Buffer;
    userId: number | null;
    auditContext?: AuditContext | null;
  }
): Promise<{ organizationId: number; groupId: number; logoAssetKey: string; version: number }> {
  if (!Number.isSafeInteger(input.organizationId) || input.organizationId <= 0) {
    throw new DocumentLogoValidationError('ID organisasi tidak valid', 400);
  }
  if (!Buffer.isBuffer(input.buffer) || input.buffer.length === 0) {
    throw new DocumentLogoValidationError('File logo wajib diunggah', 400);
  }
  if (input.buffer.length > MAX_LOGO_BYTE_SIZE) {
    throw new DocumentLogoValidationError('Ukuran file logo maksimal 512 KB', 400);
  }

  const mimeType = detectImageMime(input.buffer);
  if (!mimeType) {
    throw new DocumentLogoValidationError(
      'Format file logo tidak didukung. Gunakan PNG, JPG, atau WebP (SVG tidak diizinkan).',
      400
    );
  }

  const sha256 = createHash('sha256').update(input.buffer).digest('hex');

  return await database.transaction(async (tx) => {
    const [org] = await tx
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, input.organizationId), eq(organizations.isActive, true)))
      .limit(1);

    if (!org) {
      throw new DocumentLogoValidationError('Organisasi tidak ditemukan atau tidak aktif', 404);
    }

    if (Array.isArray(input.allowedGroupIds) && !input.allowedGroupIds.includes(org.groupId)) {
      throw new DocumentLogoValidationError('Organisasi berada di luar cakupan akses Anda', 403);
    }

    // Check active LEAVE template in the group
    const [leaveTemplate] = await tx
      .select()
      .from(documentTemplateVersions)
      .where(
        and(
          eq(documentTemplateVersions.groupId, org.groupId),
          eq(documentTemplateVersions.kind, 'LEAVE'),
          eq(documentTemplateVersions.isActive, true)
        )
      )
      .orderBy(desc(documentTemplateVersions.version))
      .limit(1);

    if (!leaveTemplate) {
      throw new DocumentLogoValidationError(
        'Template form cuti F4 aktif belum tersedia untuk grup organisasi ini.',
        409
      );
    }

    // Deduplicate or insert asset
    let [asset] = await tx
      .select({ id: documentAssets.id })
      .from(documentAssets)
      .where(and(eq(documentAssets.groupId, org.groupId), eq(documentAssets.sha256, sha256)))
      .limit(1);

    if (!asset) {
      const [insertedAsset] = await tx
        .insert(documentAssets)
        .values({
          groupId: org.groupId,
          mimeType,
          byteSize: input.buffer.length,
          sha256,
          content: input.buffer,
          createdById: input.userId ?? null,
        })
        .returning({ id: documentAssets.id });
      asset = insertedAsset;
    }

    const logoAssetKey = `/api/v1/document-assets/${asset.id}`;

    // Find current max version and active identity for this organization
    const existingIdentities = await tx
      .select()
      .from(documentIdentityVersions)
      .where(eq(documentIdentityVersions.organizationId, org.id))
      .orderBy(desc(documentIdentityVersions.version));

    const previousActive = existingIdentities.find((i) => i.isActive) ?? existingIdentities[0] ?? null;
    const nextVersion = existingIdentities.length > 0 ? Number(existingIdentities[0].version) + 1 : 1;

    if (existingIdentities.some((i) => i.isActive)) {
      await tx
        .update(documentIdentityVersions)
        .set({ isActive: false })
        .where(
          and(
            eq(documentIdentityVersions.organizationId, org.id),
            eq(documentIdentityVersions.isActive, true)
          )
        );
    }

    const [newIdentity] = await tx
      .insert(documentIdentityVersions)
      .values({
        groupId: org.groupId,
        organizationId: org.id,
        version: nextVersion,
        name: previousActive?.name || org.name,
        address: previousActive?.address ?? null,
        logoAssetKey,
        approvedReference: `hr-logo-upload-v${nextVersion}`,
        isActive: true,
      })
      .returning();

    // Upsert LEAVE document profile for this organization
    const [existingProfile] = await tx
      .select()
      .from(documentProfiles)
      .where(
        and(
          eq(documentProfiles.organizationId, org.id),
          eq(documentProfiles.kind, 'LEAVE')
        )
      )
      .limit(1);

    if (existingProfile) {
      await tx
        .update(documentProfiles)
        .set({
          templateVersionId: leaveTemplate.id,
          identityVersionId: newIdentity.id,
          isActive: true,
        })
        .where(eq(documentProfiles.id, existingProfile.id));
    } else {
      await tx.insert(documentProfiles).values({
        groupId: org.groupId,
        organizationId: org.id,
        kind: 'LEAVE',
        templateVersionId: leaveTemplate.id,
        identityVersionId: newIdentity.id,
        isActive: true,
      });
    }

    if (input.auditContext) {
      await appendHrAudit(tx as any, {
        operationId: input.auditContext.operationId,
        actor: input.auditContext.actor,
        action: 'UPDATE',
        entityType: 'hr_setting',
        entityId: String(org.id),
        entityLabel: `Logo Organisasi ${org.name}`,
        outcome: 'SUCCESS',
        summary: `Memperbarui logo dokumen cuti ${org.name} (versi ${nextVersion})`,
        metadata: {
          groupId: org.groupId,
          organizationId: org.id,
          previousVersion: previousActive?.version ?? null,
          newVersion: nextVersion,
          logoAssetKey,
        },
        targets: [
          {
            entityType: 'hr_setting',
            entityId: String(org.id),
            entityLabel: `Logo Organisasi ${org.name}`,
            before: previousActive ? { key: `logo:${org.code}`, value: previousActive.logoAssetKey } : null,
            after: { key: `logo:${org.code}`, value: logoAssetKey },
            changedFields: ['value'],
          },
        ],
      });
    }

    return {
      organizationId: org.id,
      groupId: org.groupId,
      logoAssetKey,
      version: nextVersion,
    };
  });
}
