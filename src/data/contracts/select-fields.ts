/**
 * Explicit read projections used at the application boundary.
 * Keep database compatibility details here instead of spreading select('*')
 * through pages and feature services.
 */
export const SELECT_FIELDS = {
  currency: 'cur_id,code,main_name_ar,sub_name_ar,main_name_en,sub_name_en,symbol,flag,is_default,is_active,created_at',
  currencyRate: 'id,cur_no,price,day_date,seq,update_by,created_at',
  // طلبات التوظيف تُقرأ من أعمدة jobs_req المسطّحة بعد إسقاط العمود jsonb.
  // Job applications read the flat jobs_req columns; the legacy jsonb payload column is gone.
  jobRequest: 'jobs_req_id,full_name,phone,email,address,city,experience_years,id_number,job_position,qualification,notes,status,category,ref_code,created_at,updated_at',
  // حسابات البوابة: portal_users لا يملك user_uid ولا customer_id؛ المرجع الحقيقي هو linked_customer_id.
  // Portal users have no user_uid/customer_id columns; the real reference is linked_customer_id.
  portalUser: 'portal_user_id,portal_role,username,email,full_name,linked_customer_id,disabled,is_disabled,approval_status,type,phone,address,notes,onboarding_completed,created_at,updated_at',
  user: 'user_id,id,email,username,full_name,role,is_root,disabled,created_at,updated_at',
} as const;

export type SelectFieldKey = keyof typeof SELECT_FIELDS;
