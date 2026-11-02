-- Seed canonical CMC organization and approved official document profiles
-- Reference: docs/plan/2026-10-29-cmc-mgm-mapping-manifest.md & docs/plan/2026-10-29-cmc-mgm-rollout-runbook.md

INSERT INTO "organizations" ("group_id", "code", "name", "is_active")
SELECT id, 'CMC', 'PT Cahaya Mas Cemerlang', true
FROM "organization_groups"
WHERE "code" = 'CMC'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name";
--> statement-breakpoint
UPDATE "department_organization_mappings"
SET "organization_id" = (SELECT id FROM "organizations" WHERE "code" = 'CMC')
WHERE "group_id" = (SELECT id FROM "organization_groups" WHERE "code" = 'CMC')
  AND "organization_id" IS NULL;
--> statement-breakpoint
UPDATE "location_organization_mappings"
SET "organization_id" = (SELECT id FROM "organizations" WHERE "code" = 'CMC')
WHERE "group_id" = (SELECT id FROM "organization_groups" WHERE "code" = 'CMC')
  AND "organization_id" IS NULL;
--> statement-breakpoint
INSERT INTO "document_template_versions" (
  "group_id",
  "kind",
  "version",
  "layout_key",
  "labels",
  "signatories",
  "approved_reference",
  "is_active"
)
SELECT
  g.id,
  'LEAVE',
  1,
  'cmc-leave-f4-v1',
  '{"formNumber": "001", "revisionCode": "REV. 170208-1-W", "title": "PERMOHONAN CUTI KARYAWAN"}'::jsonb,
  '[{"key": "applicant", "label": "Pemohon", "name": null}, {"key": "direct_supervisor", "label": "Atasan Langsung", "name": null}, {"key": "hrd", "label": "HRD", "name": null}, {"key": "higher_supervisor", "label": "Atasan dari Atasan Langsung", "name": null}]'::jsonb,
  '2026-10-29-cmc-mgm-mapping-manifest',
  true
FROM "organization_groups" g
WHERE g."code" = 'CMC'
ON CONFLICT ("group_id", "kind", "version") DO UPDATE SET "is_active" = true;
--> statement-breakpoint
INSERT INTO "document_template_versions" (
  "group_id",
  "kind",
  "version",
  "layout_key",
  "labels",
  "signatories",
  "approved_reference",
  "is_active"
)
SELECT
  g.id,
  'GA',
  1,
  'cmc-ga-v1',
  '{"formNumber": "GA-001", "title": "FORM PERMINTAAN BARANG"}'::jsonb,
  '[{"key": "requester", "label": "Pemohon", "name": null}, {"key": "head_dept", "label": "Kepala Departemen", "name": null}, {"key": "ga_purchasing", "label": "GA / Purchasing", "name": null}]'::jsonb,
  '2026-10-29-cmc-mgm-mapping-manifest',
  true
FROM "organization_groups" g
WHERE g."code" = 'CMC'
ON CONFLICT ("group_id", "kind", "version") DO UPDATE SET "is_active" = true;
--> statement-breakpoint
INSERT INTO "document_identity_versions" (
  "group_id",
  "organization_id",
  "version",
  "name",
  "address",
  "logo_asset_key",
  "approved_reference",
  "is_active"
)
SELECT
  g.id,
  o.id,
  1,
  'PT Cahaya Mas Cemerlang',
  NULL,
  '/images/logo-cmc.png',
  '2026-10-29-cmc-mgm-mapping-manifest',
  true
FROM "organizations" o
JOIN "organization_groups" g ON g.id = o.group_id
WHERE o."code" = 'CMC'
ON CONFLICT ("organization_id", "version") DO UPDATE SET "is_active" = true;
--> statement-breakpoint
INSERT INTO "document_profiles" (
  "group_id",
  "organization_id",
  "kind",
  "template_version_id",
  "identity_version_id",
  "is_active"
)
SELECT
  g.id,
  o.id,
  'LEAVE',
  t.id,
  i.id,
  true
FROM "organizations" o
JOIN "organization_groups" g ON g.id = o.group_id
JOIN "document_template_versions" t ON t.group_id = g.id AND t.kind = 'LEAVE' AND t.version = 1
JOIN "document_identity_versions" i ON i.organization_id = o.id AND i.version = 1
WHERE o."code" = 'CMC'
ON CONFLICT ("organization_id", "kind") DO UPDATE SET
  "template_version_id" = EXCLUDED."template_version_id",
  "identity_version_id" = EXCLUDED."identity_version_id",
  "is_active" = true;
--> statement-breakpoint
INSERT INTO "document_profiles" (
  "group_id",
  "organization_id",
  "kind",
  "template_version_id",
  "identity_version_id",
  "is_active"
)
SELECT
  g.id,
  o.id,
  'GA',
  t.id,
  i.id,
  true
FROM "organizations" o
JOIN "organization_groups" g ON g.id = o.group_id
JOIN "document_template_versions" t ON t.group_id = g.id AND t.kind = 'GA' AND t.version = 1
JOIN "document_identity_versions" i ON i.organization_id = o.id AND i.version = 1
WHERE o."code" = 'CMC'
ON CONFLICT ("organization_id", "kind") DO UPDATE SET
  "template_version_id" = EXCLUDED."template_version_id",
  "identity_version_id" = EXCLUDED."identity_version_id",
  "is_active" = true;
--> statement-breakpoint
UPDATE "leave_requests" lr
SET "organization_id" = o.id,
    "document_profile_snapshot" = jsonb_build_object(
      'groupId', g.id,
      'organizationId', o.id,
      'kind', 'LEAVE',
      'templateVersionId', t.id,
      'identityVersionId', i.id,
      'layoutKey', t.layout_key,
      'identity', jsonb_build_object(
        'name', i.name,
        'address', i.address,
        'logoAssetKey', i.logo_asset_key
      ),
      'labels', t.labels,
      'signatories', t.signatories
    )
FROM "organizations" o
JOIN "organization_groups" g ON g.id = o.group_id
JOIN "document_profiles" p ON p.organization_id = o.id AND p.kind = 'LEAVE' AND p.is_active = true
JOIN "document_template_versions" t ON t.id = p.template_version_id
JOIN "document_identity_versions" i ON i.id = p.identity_version_id
WHERE lr.group_id = g.id
  AND o.code = 'CMC'
  AND lr.document_profile_snapshot IS NULL;
