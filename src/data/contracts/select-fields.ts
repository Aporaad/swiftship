/**
 * Explicit read projections used at the application boundary.
 * Keep database compatibility details here instead of spreading select('*')
 * through pages and feature services.
 */
export const SELECT_FIELDS = {
  currency: 'cur_id,code,main_name_ar,sub_name_ar,main_name_en,sub_name_en,symbol,flag,is_default,is_active,created_at',
  currencyRate: 'id,cur_no,price,day_date,seq,update_by,created_at',
  jobRequest: 'jobs_req_id,data,created_at,updated_at',
  portalUser: 'portal_user_id,user_uid,customer_id,linked_customer_id,disabled,approval_status,data,created_at,updated_at',
  user: 'user_id,id,email,username,full_name,role,is_root,disabled,created_at,updated_at',
} as const;

export type SelectFieldKey = keyof typeof SELECT_FIELDS;
