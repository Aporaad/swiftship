اريد ان تقوم بعمل اعاده هيكله لقاعده البيانات والجداول والحقول 
وتغيير نمط حقول جداول قاعدة البيانات بدلا من حقلين فقط 
ID text --المعرف
Data jsonb  --جميع الحقول داخله 
الى  استخراج الحقول الاساسيه والمهمه والتي فيها ربط مع جداول اخر من داخل حقل Data  الى حقول اساسيه 
وانشاء  PK و FK  وقيود وفهارس وسياسيات  وعلاقات بين الجداول  
وتغيير اكواد الحفظ والاستدعاء والتعامل مع قاعدة البيانات بالنظام والموقع لتواكب التغييرات
===========
"users"
"portal_users"
"user_settings"
"roles"
"sessions"
"settings"
"activity_logs"
"notifications"
"whatsapp_logs"

"accounts"
"couriers"
"customers"

"account_transactions"
"expenses"
"salary_history"
"assets"
"journal_entries"

"orders"
"shipping_companies"
"sources"

"report_settings"
"report_templates"

"browser_pages"
"portal_tickets"
"announcements"
"jobs_req"

=============
users :(id,role,username,email,disabled,linkedEntity,data{})
portal_users :(id,portal_role,username,email,disabled,approval_status,linkedAccId,data{})
sessions:(id,user_id,createdAt,lastSeen,forceLogout,data{})
settings:(id,,category,data{})
user_settings:(id,userid,data{})
customers : (id,account_id,is_active,data{})
couriers : (id,account_id,currency,is_active,type,data{})
accounts :(id,account_code,currency,entity_id,type,data{})
orders:(id,order_number,tracking_number,customer_id,order_status,createdAt,data{})
shipping_companies:(id,name,shipping_company_url,trackingID_prefix,account_id,data{})
sources:(id,name,type,source_url,account_id,data{})
account_transactions:(id,type,account_id,journalEntryNumber,module,currency,createdAt,amount,data{})
expenses:(id,expense_number,transactionsID,account_id,category,amount,currency,createdAt,data{}    )
salary_history:(id,transactionsID,account_id,user_id,amount,currency,month,createdAt,data{})
journal_entries:(id,transactionID,account_id,created_by_uid,data{})
assets:(id,account_id,status,currency,is_active,type,data{})

notifications:(id ,userId,category,isPublic,read ,type,createdAt,data{})
activity_logs:(id ,userId,action,category,target,type,createdAt,data{})

jobs_req :(id,email,phone,status,category,refCode,createdAt,data{})
announcements (id,title,isActive,priority,createdBy,createdAt,data{}) 
portal_tickets:(id,type,status,userUid,createdAt,data{})
=======================
users :(id,role,username,email,disabled,linkedType,linkedEntity,data{})

portal_users :(id,portal_role,username,email,disabled,approval_status,linkedAccId,data{})
ALTER TABLE portal_users
  ADD COLUMN email              TEXT UNIQUE,
  "type": "customer"
  "linkedAccId": "cust_2529abe19ebf",
  ADD COLUMN portal_role        TEXT NOT NULL DEFAULT 'customer',
  ADD COLUMN approval_status    TEXT NOT NULL DEFAULT 'pending_approval',
  ADD COLUMN linkedAccId TEXT REFERENCES /*customers(id) or courier(id) or employee(id)*/;

sessions:(id,user_id,createdAt,lastSeen,forceLogout,data{})
ALTER TABLE sessions
  ADD COLUMN user_id      TEXT REFERENCES users(id),
  ADD COLUMN force_logout BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN email        TEXT;

settings:(id,,category,data{})

user_settings:(id,userid,data{})

------
customers : (id,account_id,is_active,data{})
ALTER TABLE customers
  ADD COLUMN id  TEXT,
  ADD COLUMN account_id TEXT REFERENCES accounts(id),
  ADD COLUMN is_active  BOOLEAN NOT NULL DEFAULT true;

couriers : (id,account_id,currency,is_active,type,data{})
ALTER TABLE couriers
  ADD COLUMN id        TEXT,
  ADD COLUMN account_id TEXT REFERENCES accounts(id),
  ADD COLUMN is_active  BOOLEAN NOT NULL DEFAULT true;
  t

employees : (id,account_id,monthlySalary,currency,jobsType,data{},createdAt)
{
  "email": "admin@swiftship.system",
  "fullName": "ADMIN (Root)",
  'address'
  "createdAt": 1782046580035,
  "updatedAt": 1781692531648,
  "monthlySalary": 0,
  "commissionRate": 0
}

accounts :(id,account_code,currency,entity_id,type,data{})
ALTER TABLE accounts
  ADD COLUMN id        TEXT,
  ADD COLUMN account_code TEXT UNIQUE,
  ADD COLUMN account_type TEXT NOT NULL DEFAULT 'Asset',
  ADD COLUMN entity_id    TEXT,

  orders:(id,order_number,tracking_number,customer_id,order_status_id,order_status,createdAt,data{})
  ALTER TABLE orders
  ADD COLUMN id              TEXT,
  ADD COLUMN order_number    TEXT UNIQUE,
  ADD COLUMN tracking_number TEXT UNIQUE,
  ADD COLUMN customer_id     TEXT REFERENCES customers(id),
  ADD COLUMN order_status_id TEXT REFERENCES order_status(id),
  ADD COLUMN order_status    TEXT NOT NULL DEFAULT 'تم تسجيل الطلب',
  ADD COLUMN courier_id      TEXT REFERENCES couriers(id);

sources:(id,name,type,source_url,account_id,data{})
ALTER TABLE sources
  ADD COLUMN name       TEXT,
  ADD COLUMN account_id TEXT REFERENCES accounts(id),
  ADD COLUMN is_active  BOOLEAN NOT NULL DEFAULT true;

shipping_companies:(id,name,shipping_company_url,trackingID_prefix,account_id,data{})
ALTER TABLE shipping_companies
  ADD COLUMN name                  TEXT,
  ADD COLUMN shipping_company_url  TEXT,
  ADD COLUMN trackingID_prefix     TEXT,
  ADD COLUMN account_id            TEXT REFERENCES accounts(id);

account_transactions:(id,type,account_id,journalEntryNumber,module,currency,createdAt,amount,data{})
ALTER TABLE account_transactions
ADD COLUMN id        TEXT,
  ADD COLUMN account_id       TEXT REFERENCES accounts(id),
  ADD COLUMN journal_entry_id TEXT REFERENCES journal_entries(id),
  ADD COLUMN type             TEXT NOT NULL DEFAULT 'Debit',
  ADD COLUMN amount           NUMERIC NOT NULL DEFAULT 0;

expenses:(id,expense_number,transactionsID,account_id,category,amount,currency,createdAt,data{}    )
ALTER TABLE expenses
  ADD COLUMN expense_number    TEXT UNIQUE,
  ADD COLUMN linked_account_id TEXT REFERENCES accounts(id),
  ADD COLUMN created_by_uid    TEXT REFERENCES users(id);

salary_history:(id,transactionsID,account_id,user_id,amount,currency,month,createdAt,data{})
ALTER TABLE salary_history
  ADD COLUMN user_id        TEXT REFERENCES users(id),
  ADD COLUMN salary_month   TEXT,
  ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'paid';


journal_entries:(id,transactionID,account_id,created_by_uid,data{})
ALTER TABLE journal_entries
  ADD COLUMN voucher_number  TEXT UNIQUE,
  ADD COLUMN status          TEXT NOT NULL DEFAULT 'posted',
  ADD COLUMN created_by_uid  TEXT REFERENCES users(id);

  assets:(id,account_id,status,currency,is_active,type,data{})
ALTER TABLE assets
  ADD COLUMN asset_number    TEXT UNIQUE,
  ADD COLUMN linked_account_id TEXT REFERENCES accounts(id),
  ADD COLUMN created_by_uid    TEXT REFERENCES users(id);

notifications:(id ,userId,category,isPublic,read ,type,createdAt,data{})
ALTER TABLE notifications
  ADD COLUMN user_id    TEXT,
  ADD COLUMN creator_id TEXT REFERENCES users(id),
  ADD COLUMN is_read    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_public  BOOLEAN NOT NULL DEFAULT false;
activity_logs:(id ,userId,action,category,target,type,createdAt,data{})
ALTER TABLE activity_logs
  ADD COLUMN action     TEXT,
  ADD COLUMN user_uid   TEXT REFERENCES users(id),
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();


jobs_req :(id,email,phone,status,category,refCode,createdAt,data{})
ALTER TABLE jobs_req
  ADD COLUMN status          TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN refCode         TEXT UNIQUE,
  ADD COLUMN created_at      TIMESTAMPTZ NOT NULL DEFAULT now();

announcements (id,title,isActive,priority,createdBy,createdAt,data{}) 
ALTER TABLE announcements
  ADD COLUMN title         TEXT,
  ADD COLUMN content       TEXT,
  ADD COLUMN isActive      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN priority      TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN createdBy     TEXT REFERENCES users(id),
  ADD COLUMN created_at    TIMESTAMPTZ NOT NULL DEFAULT now();

portal_tickets:(id,type,status,userUid,createdAt,data{})
ALTER TABLE portal_tickets
  ADD COLUMN type          TEXT,
  ADD COLUMN status          TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN user_uid        TEXT REFERENCES users(id),
  ADD COLUMN created_at      TIMESTAMPTZ NOT NULL DEFAULT now();
  
================
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

=================================
full_name_ar,full_name_en,role,phone,created_at,updated_at,last_login,is_active,password_hash

couriers: id,account_id,full_name_ar,full_name_en,phone,email,country_code,created_at,updated_at,avatar,is_active,account_status,default_package_type,default_shipping_company,bank_account,bank_name,bank_iban

customers: id,account_id,email,username,full_name_ar,full_name_en,phone,country_code,created_at,updated_at,is_active,account_status,default_package_type,default_shipping_company,bank_account,bank_name,bank_iban

orders:id, account_id,courier_id,shipping_company_id,source_id,order_code,order_number,order_link,status,notes,created_at,updated_at,deleted_at,deleted_by,tracking_number,payment_method,total_price,total_weight,total_cbm,total_length,total_width,total_height,order_type,is_paid,is_delivered,is_cancelled,is_returned,is_in_transit,is_in_customs,is_in_warehouse,is_in_courier,is_in_customer_hands,is_in_shipping_company,is_in_source,is_in_branch,is_in_distribution_center,is_in_store,is_in_shop,is_in_factory,is_in_company,is_in_organization,is_in_group,is_in_team,is_in_project,is_in_task,is_in_event,is_in_meeting,is_in_call,is_in_email,is_in_message,is_in_notification,is_in_log,is_in_system,is_in_web,is_in_app,is_in_mobile,is_in_tablet,is_in_computer,is_in_other,is_in_more,is_in_less,is_in_all,is_in_none,is_in_one,is_in_two,is_in_three,is_in_four,is_in_five,is_in_six,is_in_seven,is_in_eight,is_in_nine,is_in_ten,is_in_eleven,is_in_twelve