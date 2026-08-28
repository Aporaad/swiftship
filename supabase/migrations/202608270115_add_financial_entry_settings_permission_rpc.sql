-- حماية عمليات إدارة فئات وأنواع القيود في مسار التطبيق.
-- لا تغيّر RLS ولا تضيف عمود data للجداول المالية الجديدة.
BEGIN;

CREATE OR REPLACE FUNCTION public.require_financial_entry_settings_permission(p_permission text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_id text := auth.uid()::text;
  v_role text;
  v_disabled boolean;
  v_permissions jsonb;
BEGIN
  IF v_actor_id IS NULL OR btrim(v_actor_id) = '' THEN
    RAISE EXCEPTION 'تتطلب عملية إعدادات القيود جلسة مستخدم موثقة.';
  END IF;
  SELECT u.role, COALESCE(u.disabled, false)
  INTO v_role, v_disabled
  FROM public.users u
  WHERE u.id = v_actor_id;
  IF NOT FOUND OR v_disabled THEN
    RAISE EXCEPTION 'حساب المستخدم غير صالح أو معطل.';
  END IF;
  IF v_role = 'Admin' THEN RETURN v_actor_id; END IF;
  SELECT r.data->'permissions' INTO v_permissions
  FROM public.roles r
  WHERE r.id = v_role;
  IF COALESCE(v_permissions, '[]'::jsonb) ? '*' OR COALESCE(v_permissions, '[]'::jsonb) ? p_permission THEN
    RETURN v_actor_id;
  END IF;
  RAISE EXCEPTION 'لا تملك صلاحية % لإدارة إعدادات القيود.', p_permission;
END;
$$;

CREATE OR REPLACE FUNCTION public.manage_financial_entry_setting(
  p_action text,
  p_kind text,
  p_id text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth
AS $$
DECLARE
  v_permission text;
  v_actor_id text;
  v_code text := upper(btrim(COALESCE(p_payload->>'code', '')));
  v_name_ar text := btrim(COALESCE(p_payload->>'nameAr', ''));
  v_name_en text := btrim(COALESCE(p_payload->>'nameEn', ''));
  v_note text := COALESCE(p_payload->>'note', '');
  v_module_id text := NULLIF(btrim(COALESCE(p_payload->>'moduleId', '')), '');
  v_is_active boolean := COALESCE((p_payload->>'isActive')::boolean, true);
  v_result jsonb;
BEGIN
  IF p_action NOT IN ('create', 'update', 'delete') OR p_kind NOT IN ('module', 'type') OR p_id IS NULL OR btrim(p_id) = '' THEN
    RAISE EXCEPTION 'طلب إدارة إعدادات القيود غير صالح.';
  END IF;
  v_permission := CASE p_action
    WHEN 'create' THEN 'create_entry_settings'
    WHEN 'update' THEN 'edit_entry_settings'
    ELSE 'delete_entry_settings'
  END;
  v_actor_id := public.require_financial_entry_settings_permission(v_permission);

  IF p_action <> 'delete' THEN
    IF v_code !~ '^[A-Z][A-Z0-9_]{1,63}$' THEN
      RAISE EXCEPTION 'رمز الفئة أو النوع يجب أن يبدأ بحرف إنجليزي ويحتوي أحرفًا كبيرة أو أرقامًا أو شرطات سفلية فقط.';
    END IF;
    IF v_name_ar = '' THEN RAISE EXCEPTION 'الاسم العربي مطلوب.'; END IF;
    IF v_name_en = '' THEN v_name_en := v_name_ar; END IF;
    IF p_kind = 'type' AND (v_module_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.entry_module WHERE id = v_module_id)) THEN
      RAISE EXCEPTION 'فئة القيد المرتبطة بالنوع غير موجودة.';
    END IF;
  END IF;

  IF p_kind = 'module' AND p_action = 'create' THEN
    INSERT INTO public.entry_module (id, code, name_ar, name_en, note, is_active, created_by_uid, updated_by_uid)
    VALUES (p_id, v_code, v_name_ar, v_name_en, v_note, v_is_active, v_actor_id, v_actor_id)
    RETURNING jsonb_build_object('id', id, 'code', code, 'nameAr', name_ar, 'nameEn', name_en, 'isActive', is_active) INTO v_result;
  ELSIF p_kind = 'module' AND p_action = 'update' THEN
    UPDATE public.entry_module
    SET code = v_code, name_ar = v_name_ar, name_en = v_name_en, note = v_note, is_active = v_is_active, updated_at = now(), updated_by_uid = v_actor_id
    WHERE id = p_id
    RETURNING jsonb_build_object('id', id, 'code', code, 'nameAr', name_ar, 'nameEn', name_en, 'isActive', is_active) INTO v_result;
  ELSIF p_kind = 'module' AND p_action = 'delete' THEN
    DELETE FROM public.entry_module WHERE id = p_id RETURNING jsonb_build_object('id', id, 'deleted', true) INTO v_result;
  ELSIF p_kind = 'type' AND p_action = 'create' THEN
    INSERT INTO public.entry_type (id, code, module_id, name_ar, name_en, note, is_active, created_by_uid, updated_by_uid)
    VALUES (p_id, v_code, v_module_id, v_name_ar, v_name_en, v_note, v_is_active, v_actor_id, v_actor_id)
    RETURNING jsonb_build_object('id', id, 'code', code, 'moduleId', module_id, 'nameAr', name_ar, 'nameEn', name_en, 'isActive', is_active) INTO v_result;
  ELSIF p_kind = 'type' AND p_action = 'update' THEN
    UPDATE public.entry_type
    SET code = v_code, module_id = v_module_id, name_ar = v_name_ar, name_en = v_name_en, note = v_note, is_active = v_is_active, updated_at = now(), updated_by_uid = v_actor_id
    WHERE id = p_id
    RETURNING jsonb_build_object('id', id, 'code', code, 'moduleId', module_id, 'nameAr', name_ar, 'nameEn', name_en, 'isActive', is_active) INTO v_result;
  ELSE
    DELETE FROM public.entry_type WHERE id = p_id RETURNING jsonb_build_object('id', id, 'deleted', true) INTO v_result;
  END IF;
  IF v_result IS NULL THEN RAISE EXCEPTION 'سجل إعداد القيد غير موجود أو تعذر تنفيذ العملية.'; END IF;
  RETURN v_result;
END;
$$;

COMMIT;
