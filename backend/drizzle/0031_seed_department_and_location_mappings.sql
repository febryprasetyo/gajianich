-- Seed canonical department and location mappings for CMC and MGM.
-- Approved in docs/plan/2026-10-29-cmc-mgm-mapping-manifest.md
-- MULTI GAS MEDIKA and MEDICARE SOLUSI INDONESIA belong to MGM.
-- All other active corporate departments belong to CMC.
INSERT INTO "department_organization_mappings" ("department_id", "group_id", "approval_reference")
SELECT 
  d.id,
  CASE 
    WHEN UPPER(TRIM(d.name)) IN ('MULTI GAS MEDIKA', 'MEDICARE SOLUSI INDONESIA') THEN 
      (SELECT id FROM "organization_groups" WHERE code = 'MGM' LIMIT 1)
    ELSE 
      (SELECT id FROM "organization_groups" WHERE code = 'CMC' LIMIT 1)
  END AS group_id,
  '2026-10-29-cmc-mgm-mapping-manifest' AS approval_reference
FROM "departments" d
ON CONFLICT ("department_id") DO NOTHING;
--> statement-breakpoint
-- Locations: Multi Gas Medika belongs to MGM, others belong to CMC.
INSERT INTO "location_organization_mappings" ("location_id", "group_id", "approval_reference")
SELECT 
  l.id,
  CASE 
    WHEN UPPER(TRIM(l.name)) ILIKE '%MULTI GAS MEDIKA%' OR UPPER(TRIM(l.code)) = 'MGM' THEN 
      (SELECT id FROM "organization_groups" WHERE code = 'MGM' LIMIT 1)
    ELSE 
      (SELECT id FROM "organization_groups" WHERE code = 'CMC' LIMIT 1)
  END AS group_id,
  '2026-10-29-cmc-mgm-mapping-manifest' AS approval_reference
FROM "locations" l
ON CONFLICT ("location_id") DO NOTHING;
