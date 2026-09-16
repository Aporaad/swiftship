-- Migration: Fix view column aliases to strict snake_case
-- Date: 2026-09-16

DROP VIEW IF EXISTS expenes_view;
DROP VIEW IF EXISTS portal_users_view;

CREATE VIEW expenes_view AS
SELECT 
    id,
    ((data ->> 'amount'::text))::numeric AS amount,
    ((data ->> 'amountInDefaultCurrency'::text))::numeric AS amount_in_default_currency,
    (data ->> 'category'::text) AS category,
    ((data ->> 'createdAt'::text))::numeric AS created_at,
    (data ->> 'createdByEmail'::text) AS created_by_email,
    (data ->> 'createdByName'::text) AS created_by_name,
    (data ->> 'createdByUid'::text) AS created_by_uid,
    (data ->> 'currency'::text) AS currency,
    (data ->> 'expenseNumber'::text) AS expense_number,
    (data ->> 'financialAccountCode'::text) AS financial_account_code,
    (data ->> 'financialAccountId'::text) AS financial_account_id,
    (data ->> 'linkedAccountCode'::text) AS linked_account_code,
    (data ->> 'linkedAccountId'::text) AS linked_account_id,
    (data ->> 'notes'::text) AS notes,
    (data ->> 'recipientEntityId'::text) AS recipient_entity_id,
    (data ->> 'recipientEntityType'::text) AS recipient_entity_type,
    (data ->> 'recipientId'::text) AS recipient_id,
    (data ->> 'recipientName'::text) AS recipient_name,
    (data ->> 'remarks'::text) AS remarks,
    ((data ->> 'remittedAmount'::text))::numeric AS remitted_amount,
    ((data ->> 'remittedAmountInDefaultCurrency'::text))::numeric AS remitted_amount_in_default_currency,
    (data ->> 'salaryMonth'::text) AS salary_month,
    ((data ->> 'settledAt'::text))::numeric AS settled_at,
    (data ->> 'settledByEmail'::text) AS settled_by_email,
    (data ->> 'settledByName'::text) AS settled_by_name,
    (data ->> 'status'::text) AS status,
    (data ->> 'type'::text) AS type,
    ((data ->> 'updatedAt'::text))::numeric AS updated_at
FROM expenses;

CREATE OR REPLACE VIEW portal_users_view AS
SELECT 
    id,
    (data ->> 'address'::text) AS address,
    (data ->> 'approvalStatus'::text) AS approval_status,
    (data ->> 'commercialRegisterUrl'::text) AS commercial_register_url,
    ((data ->> 'createdAt'::text))::numeric AS created_at,
    (data ->> 'email'::text) AS email,
    (data ->> 'fullName'::text) AS full_name,
    (data ->> 'gpsLocation'::text) AS gps_location,
    (data ->> 'identityDocUrl'::text) AS identity_doc_url,
    (data ->> 'linkedAccId'::text) AS linked_acc_id,
    (data ->> 'linkedCustomerId'::text) AS linked_customer_id,
    (data ->> 'notes'::text) AS notes,
    (data ->> 'phone'::text) AS phone,
    (data ->> 'portalRole'::text) AS portal_role,
    (data ->> 'profileImageUrl'::text) AS profile_image_url,
    (data ->> 'uid'::text) AS uid,
    ((data ->> 'updatedAt'::text))::numeric AS updated_at,
    (data ->> 'username'::text) AS username
FROM portal_users;
