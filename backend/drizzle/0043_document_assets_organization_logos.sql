-- Add document_assets table for immutable organization logo storage
-- Reference: docs/superpowers/specs/2026-11-04-leave-form-organization-select-design.md

CREATE TABLE IF NOT EXISTS "document_assets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_assets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"group_id" bigint NOT NULL REFERENCES "organization_groups"("id"),
	"mime_type" varchar(50) NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"content" bytea NOT NULL,
	"created_by_id" bigint REFERENCES "users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_assets_group_sha256_unique" UNIQUE("group_id","sha256"),
	CONSTRAINT "document_assets_mime_check" CHECK ("document_assets"."mime_type" in ('image/png','image/jpeg','image/webp')),
	CONSTRAINT "document_assets_size_check" CHECK ("document_assets"."byte_size" > 0 and "document_assets"."byte_size" <= 524288),
	CONSTRAINT "document_assets_sha256_check" CHECK (length(trim("document_assets"."sha256")) = 64)
);
--> statement-breakpoint
DO $$
DECLARE runtime_role text := current_setting('gajianich.hr_audit_runtime_role', true);
BEGIN
  IF runtime_role IS NOT NULL AND runtime_role <> '' THEN
    EXECUTE format('GRANT SELECT, INSERT ON TABLE public.document_assets TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE public.organizations, public.document_identity_versions, public.document_profiles TO %I', runtime_role);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.organizations_id_seq, public.document_assets_id_seq, public.document_identity_versions_id_seq, public.document_profiles_id_seq TO %I', runtime_role);
  END IF;
END $$;

