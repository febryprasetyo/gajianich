-- Seed canonical document template versions for MGM and all active organization groups
-- Ensures F4 leave document and GA goods request forms are immediately available for logo upload and document generation

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
ON CONFLICT ("group_id", "kind", "version") DO UPDATE SET "is_active" = true;
