-- =============================================================================
-- Migration 202609160001: إعادة تسمية جميع حقول camelCase إلى snake_case وتنظيف التكرار
-- Phase 2.1 & 2.3: Rename camelCase columns to snake_case & Remove duplicate/legacy columns
-- Naming Convention Refactoring — Step 1 (Safe Column Renames & Deduplication)
-- 
-- القاعدة المطبقة | Applied Rule:
--   قاعدة البيانات: snake_case (created_at, updated_at, is_active, created_by, ...)
--   النظام/الكود: camelCase (createdAt, updatedAt, isActive, ...)
-- =============================================================================

BEGIN;

DO $$
BEGIN

  -- 1. accounts
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'created_at') THEN
      UPDATE public.accounts SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.accounts DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.accounts RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'updatedAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'updated_at') THEN
      UPDATE public.accounts SET updated_at = "updatedAt" WHERE updated_at IS NULL AND "updatedAt" IS NOT NULL;
      ALTER TABLE public.accounts DROP COLUMN "updatedAt";
    ELSE
      ALTER TABLE public.accounts RENAME COLUMN "updatedAt" TO updated_at;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'lastRecalculatedAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'last_recalculated_at') THEN
      UPDATE public.accounts SET last_recalculated_at = "lastRecalculatedAt" WHERE last_recalculated_at IS NULL AND "lastRecalculatedAt" IS NOT NULL;
      ALTER TABLE public.accounts DROP COLUMN "lastRecalculatedAt";
    ELSE
      ALTER TABLE public.accounts RENAME COLUMN "lastRecalculatedAt" TO last_recalculated_at;
    END IF;
  END IF;

  -- 2. announcements
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'created_at') THEN
      UPDATE public.announcements SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.announcements DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.announcements RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'isActive') THEN
    ALTER TABLE public.announcements RENAME COLUMN "isActive" TO is_active;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'createdBy') THEN
    ALTER TABLE public.announcements RENAME COLUMN "createdBy" TO created_by;
  END IF;

  -- 3. orders
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'created_at') THEN
      UPDATE public.orders SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.orders DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.orders RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;

  -- 4. activity_logs
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'created_at') THEN
      UPDATE public.activity_logs SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.activity_logs DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.activity_logs RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'userId') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'user_id') THEN
      UPDATE public.activity_logs SET user_id = "userId" WHERE user_id IS NULL AND "userId" IS NOT NULL;
      ALTER TABLE public.activity_logs DROP COLUMN "userId";
    ELSE
      ALTER TABLE public.activity_logs RENAME COLUMN "userId" TO user_id;
    END IF;
  END IF;

  -- 5. assets
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'assetCode') THEN
    ALTER TABLE public.assets RENAME COLUMN "assetCode" TO asset_code;
  END IF;

  -- 6. cur_price
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cur_price' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cur_price' AND column_name = 'created_at') THEN
      UPDATE public.cur_price SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.cur_price DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.cur_price RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cur_price' AND column_name = 'updateBy') THEN
    ALTER TABLE public.cur_price RENAME COLUMN "updateBy" TO updated_by;
  END IF;

  -- 7. currency
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'currency' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'currency' AND column_name = 'created_at') THEN
      UPDATE public.currency SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.currency DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.currency RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'currency' AND column_name = 'isActive') THEN
    ALTER TABLE public.currency RENAME COLUMN "isActive" TO is_active;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'currency' AND column_name = 'isDefault') THEN
    ALTER TABLE public.currency RENAME COLUMN "isDefault" TO is_default;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'currency' AND column_name = 'main_nameAR') THEN
    ALTER TABLE public.currency RENAME COLUMN "main_nameAR" TO main_name_ar;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'currency' AND column_name = 'main_nameEn') THEN
    ALTER TABLE public.currency RENAME COLUMN "main_nameEn" TO main_name_en;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'currency' AND column_name = 'sup_nameAR') THEN
    ALTER TABLE public.currency RENAME COLUMN "sup_nameAR" TO sub_name_ar;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'currency' AND column_name = 'sup_nameEn') THEN
    ALTER TABLE public.currency RENAME COLUMN "sup_nameEn" TO sub_name_en;
  END IF;

  -- 8. employees
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'created_at') THEN
      UPDATE public.employees SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.employees DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.employees RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'createdBy') THEN
    ALTER TABLE public.employees RENAME COLUMN "createdBy" TO created_by;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'jobsType') THEN
    ALTER TABLE public.employees RENAME COLUMN "jobsType" TO jobs_type;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'monthlySalary') THEN
    ALTER TABLE public.employees RENAME COLUMN "monthlySalary" TO monthly_salary;
  END IF;

  -- 9. expenses
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'created_at') THEN
      UPDATE public.expenses SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.expenses DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.expenses RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'transactionsID') THEN
    ALTER TABLE public.expenses RENAME COLUMN "transactionsID" TO transactions_id;
  END IF;

  -- 10. items_category
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'items_category' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'items_category' AND column_name = 'created_at') THEN
      UPDATE public.items_category SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.items_category DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.items_category RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'items_category' AND column_name = 'updatedAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'items_category' AND column_name = 'updated_at') THEN
      UPDATE public.items_category SET updated_at = "updatedAt" WHERE updated_at IS NULL AND "updatedAt" IS NOT NULL;
      ALTER TABLE public.items_category DROP COLUMN "updatedAt";
    ELSE
      ALTER TABLE public.items_category RENAME COLUMN "updatedAt" TO updated_at;
    END IF;
  END IF;

  -- 11. jobs_req
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs_req' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs_req' AND column_name = 'created_at') THEN
      UPDATE public.jobs_req SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.jobs_req DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.jobs_req RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs_req' AND column_name = 'refCode') THEN
    ALTER TABLE public.jobs_req RENAME COLUMN "refCode" TO ref_code;
  END IF;

  -- 12. notifications
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'created_at') THEN
      UPDATE public.notifications SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.notifications DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.notifications RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'isPublic') THEN
    ALTER TABLE public.notifications RENAME COLUMN "isPublic" TO is_public;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'userId') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'user_id') THEN
      UPDATE public.notifications SET user_id = "userId" WHERE user_id IS NULL AND "userId" IS NOT NULL;
      ALTER TABLE public.notifications DROP COLUMN "userId";
    ELSE
      ALTER TABLE public.notifications RENAME COLUMN "userId" TO user_id;
    END IF;
  END IF;

  -- 13. order_option
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_option' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_option' AND column_name = 'created_at') THEN
      UPDATE public.order_option SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.order_option DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.order_option RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_option' AND column_name = 'updatedAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_option' AND column_name = 'updated_at') THEN
      UPDATE public.order_option SET updated_at = "updatedAt" WHERE updated_at IS NULL AND "updatedAt" IS NOT NULL;
      ALTER TABLE public.order_option DROP COLUMN "updatedAt";
    ELSE
      ALTER TABLE public.order_option RENAME COLUMN "updatedAt" TO updated_at;
    END IF;
  END IF;

  -- 14. portal_tickets
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'portal_tickets' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'portal_tickets' AND column_name = 'created_at') THEN
      UPDATE public.portal_tickets SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.portal_tickets DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.portal_tickets RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'portal_tickets' AND column_name = 'userUid') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'portal_tickets' AND column_name = 'user_uid') THEN
      UPDATE public.portal_tickets SET user_uid = "userUid" WHERE user_uid IS NULL AND "userUid" IS NOT NULL;
      ALTER TABLE public.portal_tickets DROP COLUMN "userUid";
    ELSE
      ALTER TABLE public.portal_tickets RENAME COLUMN "userUid" TO user_uid;
    END IF;
  END IF;

  -- 15. portal_users
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'portal_users' AND column_name = 'linkedAccId') THEN
    ALTER TABLE public.portal_users RENAME COLUMN "linkedAccId" TO linked_acc_id;
  END IF;

  -- 16. salary_history
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'salary_history' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'salary_history' AND column_name = 'created_at') THEN
      UPDATE public.salary_history SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.salary_history DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.salary_history RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'salary_history' AND column_name = 'transactionsID') THEN
    ALTER TABLE public.salary_history RENAME COLUMN "transactionsID" TO transactions_id;
  END IF;

  -- 17. sessions
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'created_at') THEN
      UPDATE public.sessions SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.sessions DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.sessions RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'forceLogout') THEN
    ALTER TABLE public.sessions RENAME COLUMN "forceLogout" TO force_logout;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'lastSeen') THEN
    ALTER TABLE public.sessions RENAME COLUMN "lastSeen" TO last_seen;
  END IF;

  -- 18. shipments
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipments' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipments' AND column_name = 'created_at') THEN
      UPDATE public.shipments SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.shipments DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.shipments RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;

  -- 19. shipping_companies
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipping_companies' AND column_name = 'trackingID_prefix') THEN
    ALTER TABLE public.shipping_companies RENAME COLUMN "trackingID_prefix" TO tracking_id_prefix;
  END IF;

  -- 20. users
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'createdAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'created_at') THEN
      UPDATE public.users SET created_at = "createdAt" WHERE created_at IS NULL AND "createdAt" IS NOT NULL;
      ALTER TABLE public.users DROP COLUMN "createdAt";
    ELSE
      ALTER TABLE public.users RENAME COLUMN "createdAt" TO created_at;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'updatedAt') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'updated_at') THEN
      UPDATE public.users SET updated_at = "updatedAt" WHERE updated_at IS NULL AND "updatedAt" IS NOT NULL;
      ALTER TABLE public.users DROP COLUMN "updatedAt";
    ELSE
      ALTER TABLE public.users RENAME COLUMN "updatedAt" TO updated_at;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'fullName') THEN
    ALTER TABLE public.users RENAME COLUMN "fullName" TO full_name;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'isRoot') THEN
    ALTER TABLE public.users RENAME COLUMN "isRoot" TO is_root;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'lastSeen') THEN
    ALTER TABLE public.users RENAME COLUMN "lastSeen" TO last_seen;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'lastSeenAt') THEN
    ALTER TABLE public.users RENAME COLUMN "lastSeenAt" TO last_seen_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'linkedEntity') THEN
    ALTER TABLE public.users RENAME COLUMN "linkedEntity" TO linked_entity;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'linkedType') THEN
    ALTER TABLE public.users RENAME COLUMN "linkedType" TO linked_type;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'systemPin') THEN
    ALTER TABLE public.users RENAME COLUMN "systemPin" TO system_pin;
  END IF;

END $$;

COMMIT;
