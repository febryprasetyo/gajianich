ALTER TABLE "hardware_audit_logs" ADD COLUMN "group_id" bigint;--> statement-breakpoint
ALTER TABLE "hardware_audit_logs" ADD CONSTRAINT "hardware_audit_logs_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE FUNCTION protect_historical_group_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.group_id IS NOT NULL AND NEW.group_id IS DISTINCT FROM OLD.group_id THEN
  RAISE EXCEPTION 'Historical group ownership is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER hardware_audit_group_immutable BEFORE UPDATE ON hardware_audit_logs FOR EACH ROW EXECUTE FUNCTION protect_historical_group_owner();
--> statement-breakpoint
CREATE TRIGGER attendance_record_group_immutable BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION protect_historical_group_owner();
--> statement-breakpoint
CREATE TRIGGER attendance_batch_group_immutable BEFORE UPDATE ON attendance_batches FOR EACH ROW EXECUTE FUNCTION protect_historical_group_owner();
--> statement-breakpoint
CREATE TRIGGER asset_assignment_group_immutable BEFORE UPDATE ON asset_assignment_history FOR EACH ROW EXECUTE FUNCTION protect_historical_group_owner();
--> statement-breakpoint
CREATE TRIGGER asset_maintenance_group_immutable BEFORE UPDATE ON asset_maintenances FOR EACH ROW EXECUTE FUNCTION protect_historical_group_owner();
--> statement-breakpoint
DO $$
DECLARE runtime_role text:=current_setting('gajianich.hr_audit_runtime_role',true);
BEGIN
 IF runtime_role IS NOT NULL AND runtime_role<>'' THEN
  EXECUTE format('GRANT SELECT ON organization_groups,organizations,department_organization_mappings,location_organization_mappings,document_profiles,document_template_versions,document_identity_versions TO %I',runtime_role);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON user_organization_group_access TO %I',runtime_role);
 END IF;
END $$;
