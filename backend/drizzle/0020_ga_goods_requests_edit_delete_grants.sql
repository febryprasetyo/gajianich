DO $$
DECLARE
  runtime_name text := nullif(current_setting('gajianich.hr_audit_runtime_role', true), '');
BEGIN
  IF runtime_name IS NOT NULL THEN
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ga_goods_requests, public.ga_goods_request_items, public.ga_goods_request_attachments TO %I', runtime_name);
  END IF;
END;
$$;
