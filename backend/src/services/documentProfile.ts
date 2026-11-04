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

export function deriveOrganizationCode(rawCode: string | undefined, name: string): string {
  const trimmedCode = (rawCode ?? '').trim().toUpperCase();
  if (trimmedCode) {
    if (!/^[A-Z0-9_-]{2,50}$/.test(trimmedCode)) {
      throw new DocumentLogoValidationError(
        'Kode organisasi hanya boleh berisi huruf kapital, angka, tanda hubung (-), atau garis bawah (_) (2-50 karakter).',
        400
      );
    }
    return trimmedCode;
  }

  const words = name
    .trim()
    .replace(/^(PT|CV|UD|YAYASAN|KOPERASI)\.?\s+/i, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  if (words.length >= 2) {
    const initials = words.map((w) => w[0].toUpperCase()).join('');
    if (initials.length >= 2) {
      return initials.slice(0, 20);
    }
  }
  const clean = (words[0] || 'ORG').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (clean.length >= 2 ? clean : `ORG-${clean}`).slice(0, 20);
}

export async function createOrganizationWithLogo(
  database: NodePgDatabase<any>,
  input: {
    groupId: number;
    name: string;
    code?: string;
    allowedGroupIds?: number[] | null;
    buffer: Buffer;
    userId: number | null;
    auditContext?: AuditContext | null;
  }
): Promise<{
  organizationId: number;
  groupId: number;
  code: string;
  name: string;
  logoAssetKey: string;
  version: number;
}> {
  if (!Number.isSafeInteger(input.groupId) || input.groupId <= 0) {
    throw new DocumentLogoValidationError('Grup organisasi tidak valid', 400);
  }
  const cleanName = (input.name ?? '').trim();
  if (cleanName.length < 2 || cleanName.length > 255) {
    throw new DocumentLogoValidationError('Nama organisasi wajib diisi (2-255 karakter)', 400);
  }
  const explicitCode = Boolean((input.code ?? '').trim());
  const baseCode = deriveOrganizationCode(input.code, cleanName);

  if (!Buffer.isBuffer(input.buffer) || input.buffer.length === 0) {
    throw new DocumentLogoValidationError('File logo wajib diunggah untuk organisasi baru', 400);
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

  if (Array.isArray(input.allowedGroupIds) && !input.allowedGroupIds.includes(input.groupId)) {
    throw new DocumentLogoValidationError('Grup organisasi berada di luar cakupan akses Anda', 403);
  }

  const newOrgId = await database.transaction(async (tx) => {
    let finalCode = baseCode;
    const [existingCode] = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.code, finalCode))
      .limit(1);

    if (existingCode) {
      if (explicitCode) {
        throw new DocumentLogoValidationError(`Kode organisasi "${finalCode}" sudah digunakan`, 409);
      }
      // Auto-Disambiguate derived code
      let suffix = 2;
      while (suffix < 100) {
        const candidate = `${baseCode.slice(0, 45)}-${suffix}`;
        const [dup] = await tx
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.code, candidate))
          .limit(1);
        if (!dup) {
          finalCode = candidate;
          break;
        }
        suffix += 1;
      }
    }

    const [createdOrg] = await tx
      .insert(organizations)
      .values({
        groupId: input.groupId,
        code: finalCode,
        name: cleanName,
        isActive: true,
      })
      .returning({ id: organizations.id });

    return createdOrg.id;
  });

  const uploaded = await uploadOrganizationLogo(database, {
    organizationId: newOrgId,
    allowedGroupIds: input.allowedGroupIds,
    buffer: input.buffer,
    userId: input.userId,
    auditContext: input.auditContext,
  });

  const [orgRow] = await database
    .select({ code: organizations.code, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, newOrgId))
    .limit(1);

  return {
    organizationId: uploaded.organizationId,
    groupId: uploaded.groupId,
    code: orgRow?.code ?? baseCode,
    name: orgRow?.name ?? cleanName,
    logoAssetKey: uploaded.logoAssetKey,
    version: uploaded.version,
  };
}

export async function uploadOrganizationLogo(
  database: NodePgDatabase<any>,
  input: {
    organizationId: number;
    allowedGroupIds?: number[] | null;
    buffer?: Buffer | null;
    name?: string;
    code?: string;
    userId: number | null;
    auditContext?: AuditContext | null;
  }
): Promise<{ organizationId: number; groupId: number; code: string; name: string; logoAssetKey: string; version: number }> {
  if (!Number.isSafeInteger(input.organizationId) || input.organizationId <= 0) {
    throw new DocumentLogoValidationError('ID organisasi tidak valid', 400);
  }
  const hasBuffer = Buffer.isBuffer(input.buffer) && input.buffer.length > 0;
  const cleanName = input.name !== undefined ? input.name.trim() : undefined;
  const cleanCode = input.code !== undefined && input.code.trim() !== '' ? deriveOrganizationCode(input.code, cleanName || 'ORG') : undefined;

  if (cleanName !== undefined && (cleanName.length < 2 || cleanName.length > 255)) {
    throw new DocumentLogoValidationError('Nama organisasi wajib diisi (2-255 karakter)', 400);
  }

  if (!hasBuffer && cleanName === undefined && cleanCode === undefined) {
    throw new DocumentLogoValidationError('File logo wajib diunggah', 400);
  }

  let mimeType: ReturnType<typeof detectImageMime> = null;
  let sha256: string | null = null;
  if (hasBuffer && input.buffer) {
    if (input.buffer.length > MAX_LOGO_BYTE_SIZE) {
      throw new DocumentLogoValidationError('Ukuran file logo maksimal 512 KB', 400);
    }
    mimeType = detectImageMime(input.buffer);
    if (!mimeType) {
      throw new DocumentLogoValidationError(
        'Format file logo tidak didukung. Gunakan PNG, JPG, atau WebP (SVG tidak diizinkan).',
        400
      );
    }
    sha256 = createHash('sha256').update(input.buffer).digest('hex');
  }

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

    let updatedName = org.name;
    let updatedCode = org.code;

    if (cleanCode && cleanCode !== org.code) {
      const [dup] = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.code, cleanCode))
        .limit(1);
      if (dup && dup.id !== org.id) {
        throw new DocumentLogoValidationError(`Kode organisasi "${cleanCode}" sudah digunakan`, 409);
      }
      updatedCode = cleanCode;
    }
    if (cleanName && cleanName !== org.name) {
      updatedName = cleanName;
    }

    if (updatedName !== org.name || updatedCode !== org.code) {
      await tx
        .update(organizations)
        .set({ name: updatedName, code: updatedCode })
        .where(eq(organizations.id, org.id));
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

    // Find current max version and active identity for this organization
    const existingIdentities = await tx
      .select()
      .from(documentIdentityVersions)
      .where(eq(documentIdentityVersions.organizationId, org.id))
      .orderBy(desc(documentIdentityVersions.version));

    const previousActive = existingIdentities.find((i) => i.isActive) ?? existingIdentities[0] ?? null;

    if (!hasBuffer || !input.buffer || !mimeType || !sha256) {
      if (!previousActive) {
        throw new DocumentLogoValidationError('File logo wajib diunggah karena organisasi belum memiliki logo.', 400);
      }
      if (updatedName !== previousActive.name) {
        await tx
          .update(documentIdentityVersions)
          .set({ name: updatedName })
          .where(eq(documentIdentityVersions.id, previousActive.id));
      }
      return {
        organizationId: org.id,
        groupId: org.groupId,
        code: updatedCode,
        name: updatedName,
        logoAssetKey: previousActive.logoAssetKey,
        version: Number(previousActive.version),
      };
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
        name: updatedName,
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
        entityLabel: `Logo Organisasi ${updatedName}`,
        outcome: 'SUCCESS',
        summary: `Memperbarui logo dokumen cuti ${updatedName} (versi ${nextVersion})`,
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
            entityLabel: `Logo Organisasi ${updatedName}`,
            before: previousActive ? { key: `logo:${updatedCode}`, value: previousActive.logoAssetKey } : null,
            after: { key: `logo:${updatedCode}`, value: logoAssetKey },
            changedFields: ['value'],
          },
        ],
      });
    }

    return {
      organizationId: org.id,
      groupId: org.groupId,
      code: updatedCode,
      name: updatedName,
      logoAssetKey,
      version: nextVersion,
    };
  });
}
