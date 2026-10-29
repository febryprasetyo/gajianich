-- Seed the two canonical organization groups that all FK references depend on.
-- Idempotent: ON CONFLICT DO NOTHING means safe to run on an already-provisioned database.
INSERT INTO "organization_groups" ("code", "name") VALUES
  ('CMC', 'Cahaya Mas Cemerlang'),
  ('MGM', 'Multi Gas Medika')
ON CONFLICT ("code") DO NOTHING;

