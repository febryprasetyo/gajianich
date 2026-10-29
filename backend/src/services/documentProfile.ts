import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { documentProfiles, documentTemplateVersions, documentIdentityVersions, type DocumentKind, type DocumentProfileSnapshot } from '../db/schema/documentProfiles';
import { organizations, organizationGroups } from '../db/schema/organizations';
export type { DocumentKind, DocumentProfileSnapshot } from '../db/schema/documentProfiles';
export class DocumentProfileUnavailableError extends Error {
  readonly status = 409;
  constructor() { super('Profil dokumen resmi belum tersedia untuk organisasi ini. Hubungi administrator.'); }
}
export async function resolveDocumentProfile(tx: Pick<NodePgDatabase, 'select'>, input: { groupId: number; organizationId: number; kind: DocumentKind }): Promise<DocumentProfileSnapshot> {
  const [row] = await tx.select({ profile: documentProfiles, template: documentTemplateVersions, identity: documentIdentityVersions })
    .from(documentProfiles)
    .innerJoin(documentTemplateVersions, and(eq(documentProfiles.templateVersionId,documentTemplateVersions.id),eq(documentProfiles.groupId,documentTemplateVersions.groupId),eq(documentProfiles.kind,documentTemplateVersions.kind)))
    .innerJoin(documentIdentityVersions, and(eq(documentProfiles.identityVersionId,documentIdentityVersions.id),eq(documentProfiles.groupId,documentIdentityVersions.groupId),eq(documentProfiles.organizationId,documentIdentityVersions.organizationId)))
    .innerJoin(organizations,and(eq(organizations.id,documentProfiles.organizationId),eq(organizations.groupId,documentProfiles.groupId)))
    .innerJoin(organizationGroups,eq(organizationGroups.id,documentProfiles.groupId))
    .where(and(eq(documentProfiles.groupId,input.groupId),eq(documentProfiles.organizationId,input.organizationId),eq(documentProfiles.kind,input.kind),eq(documentProfiles.isActive,true),eq(documentTemplateVersions.isActive,true),eq(documentIdentityVersions.isActive,true),eq(organizations.isActive,true),eq(organizationGroups.isActive,true)));
  const supportedLayouts = input.kind === 'GA' ? ['cmc-ga-v1'] : ['cmc-leave-f4-v1','cmc-leave-f4-new-v1'];
  if (!row || !supportedLayouts.includes(row.template.layoutKey) || !row.identity.logoAssetKey.trim() || !row.identity.name.trim() || !row.identity.approvedReference.trim() || !row.template.approvedReference.trim()) throw new DocumentProfileUnavailableError();
  return structuredClone({ ...input, templateVersionId: row.template.id, identityVersionId: row.identity.id, layoutKey: row.template.layoutKey,
    identity: {name:row.identity.name,address:row.identity.address,logoAssetKey:row.identity.logoAssetKey}, labels:row.template.labels,signatories:row.template.signatories });
}
