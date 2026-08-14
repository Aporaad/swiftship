
|الجدول|العمود المستخرج|الجدول المرتبط|قيد FK|
|-|-|-|-|
|`customers`|`account\_id`|`accounts`|✅|
|`customers`|`financial\_account\_id`|`accounts`|✅|
|`couriers`|`account\_id`|`accounts`|✅|
|`couriers`|`financial\_account\_id`|`accounts`|✅|
|`users`|`account\_id`|`accounts`|✅|
|`users`|`financial\_account\_id`|`accounts`|✅|
|`expenses`|`linked\_account\_id`|`accounts`|✅|
|`expenses`|`financial\_account\_id`|`accounts`|✅|
|`expenses`|`created\_by\_uid`|`users`|✅|
|`account\_transactions`|`account\_id`|`accounts`|✅|
|`account\_transactions`|`created\_by\_uid`|`users`|✅|
|`sessions`|`user\_id`|`users`|✅|
|`notifications`|`user\_id`|`users`|✅|
|`notifications`|`creator\_id`|`users`|✅|


users :id, account_id,email,username,full_name_ar,full_name_en,role,phone,created_at,updated_at,last_login,is_active,password_hash

couriers: id,account_id,full_name_ar,full_name_en,phone,email,country_code,created_at,updated_at,avatar,is_active,account_status,default_package_type,default_shipping_company,bank_account,bank_name,bank_iban

customers: id,account_id,email,username,full_name_ar,full_name_en,phone,country_code,created_at,updated_at,is_active,account_status,default_package_type,default_shipping_company,bank_account,bank_name,bank_iban

orders:id, account_id,courier_id,shipping_company_id,source_id,order_code,order_number,order_link,status,notes,created_at,updated_at,deleted_at,deleted_by,tracking_number,payment_method,total_price,total_weight,total_cbm,total_length,total_width,total_height,order_type,is_paid,is_delivered,is_cancelled,is_returned,is_in_transit,is_in_customs,is_in_warehouse,is_in_courier,is_in_customer_hands,is_in_shipping_company,is_in_source,is_in_branch,is_in_distribution_center,is_in_store,is_in_shop,is_in_factory,is_in_company,is_in_organization,is_in_group,is_in_team,is_in_project,is_in_task,is_in_event,is_in_meeting,is_in_call,is_in_email,is_in_message,is_in_notification,is_in_log,is_in_system,is_in_web,is_in_app,is_in_mobile,is_in_tablet,is_in_computer,is_in_other,is_in_more,is_in_less,is_in_all,is_in_none,is_in_one,is_in_two,is_in_three,is_in_four,is_in_five,is_in_six,is_in_seven,is_in_eight,is_in_nine,is_in_ten,is_in_eleven,is_in_twelve