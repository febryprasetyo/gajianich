import { sql } from 'drizzle-orm';
import { pgTable, bigint, varchar, text, jsonb, boolean, timestamp, integer, unique, foreignKey, check, customType } from 'drizzle-orm/pg-core';
import { organizationGroups, organizations } from './organizations';
import { users } from './users';

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export type DocumentKind = 'LEAVE' | 'GA';
export type DocumentAssetMimeType = 'image/png' | 'image/jpeg' | 'image/webp';
export interface DocumentProfileSnapshot {
  groupId: number; organizationId: number; kind: DocumentKind;
  templateVersionId: number; identityVersionId: number; layoutKey: string;
  identity: { name: string; address: string | null; logoAssetKey: string };
  labels: Record<string, string>;
  signatories: Array<{ key: string; label: string; name: string | null }>;
}

export const documentAssets = pgTable('document_assets', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  groupId: bigint('group_id', { mode: 'number' }).notNull().references(() => organizationGroups.id),
  mimeType: varchar('mime_type', { length: 50 }).$type<DocumentAssetMimeType>().notNull(),
  byteSize: integer('byte_size').notNull(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  content: bytea('content').notNull(),
  createdById: bigint('created_by_id', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  unique('document_assets_group_sha256_unique').on(t.groupId, t.sha256),
  check('document_assets_mime_check', sql`${t.mimeType} in ('image/png','image/jpeg','image/webp')`),
  check('document_assets_size_check', sql`${t.byteSize} > 0 and ${t.byteSize} <= 524288`),
  check('document_assets_sha256_check', sql`length(trim(${t.sha256})) = 64`),
]);

export const documentTemplateVersions = pgTable('document_template_versions', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  groupId: bigint('group_id', { mode: 'number' }).notNull().references(() => organizationGroups.id),
  kind: varchar('kind', { length: 10 }).$type<DocumentKind>().notNull(),
  version: bigint('version', { mode: 'number' }).notNull(),
  layoutKey: varchar('layout_key', { length: 100 }).notNull(),
  labels: jsonb('labels').$type<Record<string,string>>().notNull().default({}),
  signatories: jsonb('signatories').$type<DocumentProfileSnapshot['signatories']>().notNull().default([]),
  approvedReference: text('approved_reference').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique('document_template_id_group_kind_unique').on(t.id,t.groupId,t.kind),
  unique('document_template_version_unique').on(t.groupId,t.kind,t.version),
  check('document_template_kind_check', sql`${t.kind} in ('LEAVE','GA')`),
  check('document_template_approval_check', sql`length(trim(${t.approvedReference})) > 0`)]);

export const documentIdentityVersions = pgTable('document_identity_versions', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  groupId: bigint('group_id', { mode: 'number' }).notNull().references(() => organizationGroups.id),
  organizationId: bigint('organization_id', { mode: 'number' }).notNull(),
  version: bigint('version', { mode: 'number' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  logoAssetKey: text('logo_asset_key').notNull(),
  approvedReference: text('approved_reference').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique('document_identity_id_group_org_unique').on(t.id,t.groupId,t.organizationId),
  unique('document_identity_version_unique').on(t.organizationId,t.version),
  foreignKey({columns:[t.organizationId,t.groupId],foreignColumns:[organizations.id,organizations.groupId]}),
  check('document_identity_approval_check', sql`length(trim(${t.approvedReference})) > 0`),
  check('document_identity_name_check', sql`length(trim(${t.name})) > 0`),
  check('document_identity_logo_check', sql`length(trim(${t.logoAssetKey})) > 0`)]);

export const documentProfiles = pgTable('document_profiles', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  groupId: bigint('group_id', { mode: 'number' }).notNull().references(() => organizationGroups.id),
  organizationId: bigint('organization_id', { mode: 'number' }).notNull(),
  kind: varchar('kind', { length: 10 }).$type<DocumentKind>().notNull(),
  templateVersionId: bigint('template_version_id', { mode: 'number' }).notNull(),
  identityVersionId: bigint('identity_version_id', { mode: 'number' }).notNull(),
  isActive: boolean('is_active').notNull().default(false),
}, t => [unique('document_profile_owner_kind_unique').on(t.organizationId,t.kind),
  foreignKey({columns:[t.organizationId,t.groupId],foreignColumns:[organizations.id,organizations.groupId]}),
  foreignKey({columns:[t.templateVersionId,t.groupId,t.kind],foreignColumns:[documentTemplateVersions.id,documentTemplateVersions.groupId,documentTemplateVersions.kind]}),
  foreignKey({columns:[t.identityVersionId,t.groupId,t.organizationId],foreignColumns:[documentIdentityVersions.id,documentIdentityVersions.groupId,documentIdentityVersions.organizationId]})]);
