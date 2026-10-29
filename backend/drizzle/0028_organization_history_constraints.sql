ALTER TABLE "asset_maintenances" ADD COLUMN "group_id" bigint;--> statement-breakpoint
ALTER TABLE "attendance_batches" ADD CONSTRAINT "attendanceBatches_organization_group_fk" FOREIGN KEY ("organization_id","group_id") REFERENCES "public"."organizations"("id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendanceRecords_organization_group_fk" FOREIGN KEY ("organization_id","group_id") REFERENCES "public"."organizations"("id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leaveRequests_organization_group_fk" FOREIGN KEY ("organization_id","group_id") REFERENCES "public"."organizations"("id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_maintenances" ADD CONSTRAINT "asset_maintenances_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE FUNCTION protect_document_version_payload() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'is_active') IS DISTINCT FROM (to_jsonb(OLD)-'is_active') THEN
  RAISE EXCEPTION 'Document versions are immutable; publish a new version' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER document_template_version_immutable BEFORE UPDATE OR DELETE ON document_template_versions FOR EACH ROW EXECUTE FUNCTION protect_document_version_payload();
--> statement-breakpoint
CREATE TRIGGER document_identity_version_immutable BEFORE UPDATE OR DELETE ON document_identity_versions FOR EACH ROW EXECUTE FUNCTION protect_document_version_payload();
--> statement-breakpoint
CREATE FUNCTION protect_submitted_document_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.document_profile_snapshot IS NOT NULL AND NEW.document_profile_snapshot IS DISTINCT FROM OLD.document_profile_snapshot THEN
  RAISE EXCEPTION 'Submitted document snapshots are immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER ga_document_snapshot_immutable BEFORE UPDATE ON ga_goods_requests FOR EACH ROW EXECUTE FUNCTION protect_submitted_document_snapshot();
--> statement-breakpoint
CREATE TRIGGER leave_document_snapshot_immutable BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION protect_submitted_document_snapshot();
