-- =============================================================================
-- Migration 202609160002: تطهير حقل data (JSONB) من المفاتيح المكررة التي تطابق أعمدة الجداول المباشرة
-- Phase 2.1.5: Sanitize JSONB data field to remove duplicated direct table columns
-- =============================================================================

BEGIN;

DO $$
DECLARE
  r RECORD;
  col_name text;
BEGIN
  -- قائمة المفاتيح التي ينبغي عدم تكرارها داخل كائن data لأنها أعمدة رسمية بالجداول
  FOR r IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND column_name = 'data' AND data_type = 'jsonb'
  LOOP
    -- إزالة المفاتيح التالية إن وجِدت داخل data:
    -- created_at, createdAt, updated_at, updatedAt, is_active, isActive, created_by, createdBy, user_id, userId, customer_id, customerId, order_id, orderId, account_id, accountId, status_id, statusId
    EXECUTE format('
      UPDATE public.%I 
      SET data = data 
        - ''created_at'' - ''createdAt'' 
        - ''updated_at'' - ''updatedAt'' 
        - ''is_active'' - ''isActive'' 
        - ''created_by'' - ''createdBy'' 
        - ''user_id'' - ''userId'' 
        - ''customer_id'' - ''customerId'' 
        - ''order_id'' - ''orderId'' 
        - ''account_id'' - ''accountId'' 
        - ''status_id'' - ''statusId'' 
      WHERE data IS NOT NULL AND jsonb_typeof(data) = ''object'';
    ', r.table_name);
  END LOOP;
END $$;

COMMIT;
