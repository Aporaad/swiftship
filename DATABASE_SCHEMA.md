# هيكلية قاعدة البيانات (Database Schema Document)

## قائمة الجداول المتاحة (51 جدولاً)

1. `acc_main`
2. `acc_sub`
3. `acc_sub_group`
4. `account`
5. `account_id_migration_map`
6. `account_trans`
7. `accounts`
8. `activity_logs`
9. `announcements`
10. `assets`
11. `auto_entries`
12. `browser_pages`
13. `couriers`
14. `cur_price`
15. `currency`
16. `cust_details`
17. `custody_advances`
18. `customers`
19. `default_accounts`
20. `employees`
21. `entry_module`
22. `entry_payment_details`
23. `entry_type`
24. `financial_legacy_migration_map`
25. `financial_migration_exceptions`
26. `items_category`
27. `jobs_req`
28. `main_entry`
29. `notifications`
30. `order_items`
31. `order_option`
32. `order_status`
33. `orders`
34. `orders_history`
35. `portal_tickets`
36. `portal_user_migration_map`
37. `portal_users`
38. `products`
39. `report_settings`
40. `report_templates`
41. `returned_products`
42. `roles`
43. `salary_history`
44. `sessions`
45. `settings`
46. `shipments`
47. `shipping_companies`
48. `sources`
49. `user_settings`
50. `users`
51. `whatsapp_logs`

---

## تفاصيل الجداول والحقول والعلاقات

### 1. `account`
```text
account {
  account_id: text
  account_code: text
  acc_name_ar: text
  acc_name_en: text
  balance: numeric
  cur_no: integer -> currency.cur_id
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  account_type: text
  created_by: text
  updated_by: text
}
```

### 2. `acc_main`
```text
acc_main {
  acc_main_id: text
  account_id: text
  account_code: text
  acc_name_ar: text
  acc_name_en: text
  balance: numeric
  cur_no: integer -> currency.cur_id
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 3. `acc_sub`
```text
acc_sub {
  acc_sub_id: text
  acc_main_id: text
  account_code: text
  acc_name_ar: text
  acc_name_en: text
  balance: numeric
  cur_no: integer -> currency.cur_id
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  allows_direct_accounts: boolean
  created_by: text
  updated_by: text
}
```

### 4. `acc_sub_group`
```text
acc_sub_group {
  acc_sub_group_id: text
  acc_sub_id: text
  account_code: text
  acc_name_ar: text
  acc_name_en: text
  balance: numeric
  cur_no: integer -> currency.cur_id
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  entity_type: text
  allows_direct_accounts: boolean
  created_by: text
  updated_by: text
}
```


### 5. `accounts`
```text
accounts {
  account_id: text
  account_code: text
  currency: text
  entity_id: text
  type: text
  acc_sub_id: text
  group_id: text
  entity_type: text
  account_seq: integer
  acc_name_ar: text
  acc_name_en: text
  limited_balance: numeric
  cur_no: integer -> currency.cur_id
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  last_recalculated_at: timestamp with time zone
  balance: numeric
  account_number: text
  account_prefix: text
  entity_name: text
  debit_total: numeric
  credit_total: numeric
  parent_code: text
  notes: text
  monthly_salary: numeric
  created_by: text
  updated_by: text
}
```

### 10. `assets`
```text
assets {
  asset_id: text
  created_at: timestamp with time zone
  asset_code: text
  account_id: text -> accounts.account_id
  status: text
  currency: text
  is_active: boolean
  type: text
  account_code: text
  name_ar: text
  name_en: text
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 19. `default_accounts`
```text
default_accounts {
  default_account_id: text
  default_key: text
  account_id: text -> accounts.account_id
  acc_name_ar: text
  acc_name_en: text
  cur_no: integer -> currency.cur_id
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 6. `account_trans`
```text
account_trans {
  account_trans_id: text
  main_entry_id: text
  line_no: integer
  trans_type: text
  account_id: text -> accounts.account_id
  account_cur_no: integer -> currency.cur_id
  amount: numeric
  amount_original: numeric
  currency_original_no: integer -> currency.cur_id
  currency_price_id: integer -> cur_price.cur_price_id
  currency_price_seq: integer -> cur_price.seq
  entity_type: text
  entity_id: text
  payment_method: text
  order_id: text -> orders.order_id
  shipment_id: text -> shipments.shipment_id
  custody_id: text
  auto_rule_id: text
  automation_key: text
  description: text
  note: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by_uid: text -> users.user_id
  updated_by_uid: text -> users.user_id
  conversion_rate: numeric
  amount_original_text: text
  account_currency_price_id: integer
  account_currency_price_seq: integer
  amount_text: text
  created_by: text
  updated_by: text
}
```


### 11. `auto_entries`
```text
auto_entries {
  auto_entry_id: text
  status_id: integer
  name_ar: text
  name_en: text
  is_active: boolean
  amount_source: text
  auto_post boolean
  credit_account text
  debit_account text
  description_temp_ar text
  description_temp_en text
  status_name_ar text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  amount_sources: jsonb
  amount_strategy: text
  currency: text
  skip_when_zero: boolean
  cur_no: integer -> currency.cur_id
  created_by: text
  updated_by: text
}
```


### 14. `cur_price`
```text
cur_price {
  cur_price_id: integer
  cur_no: integer -> currency.cur_id
  price: numeric
  day_date: timestamp with time zone
  seq: integer
  updated_by: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
}
```

### 15. `currency`
```text
currency {
  cur_id: integer
  code: character varying
  main_name_ar: text
  sub_name_ar: text
  main_name_en: text
  sub_name_en: text
  is_default: boolean
  created_at: timestamp with time zone
  is_active: boolean
  symbol: character varying
  flag: character varying
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```


### 21. `entry_module`
```text
entry_module {
  entry_module_id: text
  code: text
  name_ar: text
  name_en: text
  note: text
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by_uid: text -> users.user_id
  updated_by_uid: text -> users.user_id
  created_by: text
  updated_by: text
}
```

### 22. `entry_payment_details`
```text
entry_payment_details {
  entry_payment_detail_id: text
  main_entry_id: text
  allocation_no: integer
  payment_method: text
  account_id: text -> accounts.account_id
  amount_original: numeric
  currency_original_no: integer -> currency.cur_id
  bank_reference: text
  due_at: timestamp with time zone
  note: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text -> users.user_id
  updated_by: text -> users.user_id
}
```

### 23. `entry_type`
```text
entry_type {
  entry_type_id: text
  code: text
  module_id: text
  name_ar: text
  name_en: text
  note: text
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text -> users.user_id
  updated_by: text -> users.user_id
}
```


### 28. `main_entry`
```text
main_entry {
  main_entry_id: text
  entry_number: text
  module_id: text
  entry_type_id: text
  entry_category: text
  posting_status: text
  description: text
  note: text
  payment_method: text
  auto_rule_id: text
  automation_key: text
  order_id: text -> orders.order_id
  shipment_id: text -> shipments.shipment_id
  custody_id: text  
  effective_at: timestamp with time zone
  posted_at: timestamp with time zone
  posted_by_uid: text -> users.user_id
  voided_at: timestamp with time zone
  voided_by_uid: text -> users.user_id
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text -> users.user_id
  updated_by: text -> users.user_id
}
```

### 17. `custody_advances`
```text
custody_advances {
  custody_advance_id: text
  custody_number: text
  recipient_type: text
  recipient_id: text
  recipient_name: text
  recipient_account_id: text -> accounts.account_id
  amount_original: numeric
  currency_original_no: integer -> currency.cur_id
  currency_price_id: integer -> cur_price.cur_price_id
  currency_price_seq: integer -> cur_price.seq
  amount_settled: numeric
  amount_outstanding: numeric
  status: text
  issued_entry_id: text
  settlement_entry_id: text
  note: text
  issued_at: timestamp with time zone
  issued_by_uid: text -> users.user_id
  settled_at: timestamp with time zone
  settled_by_uid: text -> users.user_id
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by_uid: text -> users.user_id
  updated_by_uid: text -> users.user_id
  created_by: text
  updated_by: text
}
```

### 18. `customers`
```text
customers {
  customer_id: text
  account_id: text -> accounts.account_id
  is_active: boolean
  join_by: text
  referrer_id: text
  full_name: text
  name_ar: text
  name_en: text
  customer_level: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 16. `cust_details`
```text
cust_details {
  cust_detail_id: text
  user_uid: text
  customer_id: text
  join_by: text
  referrer_id: text
  onboarding_completed: boolean
  age: int
  body_details: text
  city: text
  company_name: text
  country: text
  gender: text
  gps_location: text
  id_number: text
  max_debt: numeric
  notes: text
  privacy_policy_agreed: boolean
  privacy_policy_agreed_at: timestamp with time zone  
  acquisition_source text;
  preferred_categories jsonb;
  body_details jsonb;
  location jsonb;
  address text;
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```


### 13. `couriers`
```text
couriers {
  courier_id: text
  account_id: text -> accounts.account_id
  currency: text
  is_active: boolean
  full_name: text
  name_ar: text
  name_en: text
  courier_type: text
  courier_level: text
  commission_rate: numeric
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 20. `employees`
```text
employees {
  employee_id: text
  account_id: text -> accounts.account_id
  monthly_salary: numeric
  currency: text
  created_at: timestamp with time zone
  created_by: text
  full_name: text
  name_ar: text
  name_en: text
  job_type: text
  commission_rate: numeric
  updated_at: timestamp with time zone
  updated_by: text
}
```

### 8. `activity_logs`
```text
activity_logs {
  activity_log_id: text
  data: jsonb {
    details
  }
  user_id: text -> users.user_id
  action: text
  category: text
  target: text
  type: text
  details: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 29. `notifications`
```text
notifications {
  notification_id: text
  associated_user_ids: jsonb;
  category: text;
  creator_id: text;
  creator_name: text;
  is_public: boolean;
  message: text;
  is_read: boolean;
  title: text;
  type: text; 
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 30. `order_items`
```text
order_items {
  order_item_id: text                            -- PK
  order_id: text -> orders.order_id             -- FK للطلب
  product_id: text -> products.product_id       -- FK للمنتج
  shipment_id: text -> shipments.shipment_id    -- FK للشحنة 
  product_price: numeric
  product_url: text
  tracking_number: text
  produc_source_id: text
  produc_source_url: text
  product_color: text                            
  nota: text
  product_name: text                             
  sku: text                                      
  internal_note: text                            
  customer_note: text                            
  quantity: integer
  total_price: numeric
  total__weight: numeric
  unit__weight: numeric                          
  total_cbm: numeric
  unit_cbm: numeric                              
  total_packaging_price: numeric                 
  packaging_option_id: text
  packaging_option_price: numeric
  is_insured: boolean
  insurance_fee: numeric
  items_status: text
  created_at: timestamp with time zone
  created_by: text
  updated_at: timestamp with time zone
  updated_by: text
}
```

### 31. `order_option`
```text
order_option {
  option_id: text
  code: text
  name_ar: text
  name_en: text
  price: numeric
  type: text
  is_active: boolean  
  details: text
  duration: integer    
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 32. `order_status`
```text
order_status {
  order_status_id: text
  code: text
  name_ar: text
  name_en: text
  color: text
  description: text
  is_first: boolean
  is_last: boolean
  sort_order: integer
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 33. `orders`
```text
orders {
  order_id: text
  order_number: text
  tracking_number: text
  customer_id: text -> customers.customer_id
  courier_id: text -> couriers.courier_id
  delivery_courier_id: text -> couriers.courier_id
  shipping_courier_id: text -> couriers.courier_id
  employee_id: text -> employees.employee_id
  order_party_id: text
  order_party_type: text
  is_staff_order: boolean
  order_party_account_id: text -> accounts.account_id
  order_source_id: text
  order_source_type: text
  order_status_id: text
  order_status1: text
  external_order_number: text
  currency:integer -> currency.cur_id
  order_currency: integer -> currency.cur_id
  order_currency_price: integer -> cur_price.cur_price_id

  data: jsonb {
    addShippingEnabled
    bankCommissionEnabled
    bankCommissionRate
    bankCommissionType
    
    cbmShippingRateValue
    companyProfitRate
    couponEnabled
    couponRate
    couponValue

    shippingCompany
    cartShareCode

    paidCurrency

    deductSourcingCostFromCourier
    deliveryCourierFee
    deliveryCourierFeeCurrency
    deliveryCourierFeeOrderCurrency
    deliveryStatus
    directApprove

    firedTriggers
    homeDeliveryEnabled
    internalNotes
    locationYemen
    payLater
    paymentMethod
    paymentStatus

    amountPaid
    amountRemaining
    packagingFee
    packagingFeeEnabled
    packagingFeeRate    
    totalCostSAR
    totalCostYER
    profitCompanySAR
    profitPerKgRate
    profitSaudiSAR
    sheinRedPrice

    shippingCostSAR
    shippingCourierFeeRate
    viaShippingAgent

    sourcing_cost
    sourcingCostAmount

    product_insurance_fee
    productInsuranceFee
    productsSum
    totalCBM
    totalWeight   
  }
  created_at: timestamp with time zone
  created_by: text
  updated_at: timestamp with time zone
  updated_by: text
  created_by_name: text
}
```


### 34. `products`
```text
products {
  product_id: text
  product_name_ar: text
  product_name_en: text
  product_url: text
  product_price_currency: integer -> currency.cur_id
  unit_price: numeric
  item_category_id: text
  cbm: numeric
  width: numeric
  height: numeric
  length: numeric
  weight: numeric
  created_at: timestamp with time zone
  created_by: text
  updated_at: timestamp with time zone
  updated_by: text
}
```

### 35. `returned_products`
```text
returned_products {
  return_id: text
  order_id: text
  order_item_id: text
  product_id: text -> products.product_id
  customer_id: text
  customer_name: text
  product_name: text
  product_url: text
  quantity: integer
  return_reason: text
  return_type: text
  return_status: text
  return_condition: text
  refund_amount: numeric
  refund_currency: text
  is_insured: boolean
  insurance_refund: numeric
  notes: text
  returned_at: timestamp with time zone
  processed_by: text
  processed_at: timestamp with time zone
  created_at: timestamp with time zone
  created_by: text
  updated_at: timestamp with time zone
  updated_by: text
}
```

### 36. `items_category`
```text
items_category {
  category_id: text
  category_name_ar: text
  category_name_en: text
  details: jsonb {
    group
    hazardReview
    highValueReview
  }
  is_allowed: boolean
  carton_customs_fee: numeric
  carton_tax_fee: numeric
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 38. `orders_history`
```text
orders_history {
  orders_history_id: text
  order_id: text -> orders.order_id
  order_number: text
  shipment_id: text -> shipments.shipment_id
  main_entry_id: text
  account_transaction_count: text
  activity_log_id: text
  event_type: text
  event_category: text
  operation: text
  entity_type: text
  actor_id: text
  actor_name: text
  actor_role: text
  source: text
  summary: text
  before_data: jsonb {
    action
    carton_count
    category
    category_fee_currency
    category_fees_total
    content_category_id
    content_category_name
    courier_id
    created_at
    created_by
    created_by_name
    customer_id
    customs_fee
    data
    delivery_courier_id
    employee_id
    id
    is_staff_order
    order_id
    order_number
    order_party_account_id
    order_party_id
    order_party_type
    order_source_id
    order_source_type
    order_status_id
    order_status1
    other_category_fee
    shipment_id
    shipment_status
    shipping_category_id
    shipping_company_id
    shipping_cost
    shipping_courier_id
    target
    tax_fee
    tracking_number
    type
    updated_at
    updated_by
    user_id
    weight
  }
  after_data: jsonb {
    action
    amountOriginal
    carton_count
    category
    category_fee_currency
    category_fees_total
    content_category_id
    content_category_name
    courier_id
    created_at
    created_by
    created_by_name
    createdAt
    currencyOriginalNo
    customer_id
    customs_fee
    data
    delivery_courier_id
    description
    effectiveAt
    employee_id
    entryCategory
    entryNumber
    id
    is_staff_order
    order_id
    order_number
    order_party_account_id
    order_party_id
    order_party_type
    order_source_id
    order_source_type
    order_status_id
    order_status1
    other_category_fee
    paymentMethod
    postingStatus
    shipment_id
    shipment_status
    shipping_category_id
    shipping_company_id
    shipping_cost
    shipping_courier_id
    target
    tax_fee
    tracking_number
    type
    updated_at
    updated_by
    user_id
    weight
  }
  metadata: jsonb {
    accountTransCount
    activityAction
    activityDetails
    activityTarget
    changedFields
    changes
    deletedOrderId
    mainEntryId
    orderId
    orderReference
    shipmentId
    trigger
  }
  occurred_at: timestamp with time zone
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```


### 39. `shipments`
```text
shipments {
  shipment_id: text                              -- PK
  order_id: text -> orders.order_id              -- FK للطلب
  tracking_number: text
  shipping_company_id: text
  courier_id: text
  shipment_status: text
  shipping_cost: numeric
  weight: numeric
  shipping_category_id: text
  shipping_category_name: text
  content_category_id: text
  carton_count: integer
  customs_fee: numeric
  tax_fee: numeric
  category_fees_total: numeric
  category_fee_currency: text
  other_category_fee: numeric
  shipping_type: text                            -- نوع الشحن (جوي/بحري/بري)
  shipping_source: text                          -- مصدر الشحن
  shipping_destination: text                     -- وجهة الشحن
  shipping_date: timestamp with time zone        -- تاريخ الشحن
  shipping_duration: numeric                     -- مدة الشحن بالأيام
  expected_arrival: timestamp with time zone     -- تاريخ الوصول المتوقع
  delivery_date: timestamp with time zone        -- تاريخ التسليم الفعلي
  packaging_fees: numeric                        -- رسوم التغليف
  shipping_category_price: numeric               -- سعر فئة الشحن
  -- ===========================================================================
  created_at: timestamp with time zone
  created_by: text
  updated_at: timestamp with time zone
  updated_by: text
  created_by_name: text
}
```

### 41. `shipping_companies`
```text
shipping_companies {
  shipping_company_id: text
  account_id: text -> accounts.account_id
  name_ar: text
  name_en: text
  name: text
  address: text
  shipping_company_url: text
  tracking_id_prefix: text
  is_active: boolean
  code: text
  country_id: text
  phone: text
  email: text
  api_url: text
  tracking_url_template: text
  api_enabled: boolean
  api_credentials_reference: text
  supports_tracking: boolean
  supports_webhook: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 42. `sources`
```text
sources {
  source_id: text
  account_id: text -> accounts.account_id
  name_ar: text
  name_en: text  
  name: text
  source_url: text
  type: text  
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 43. `portal_tickets`
```text
portal_tickets {
  portal_ticket_id: text
  user_uid: text -> portal_users.portal_user_id
  message: text
  replies: jsonb
  status: text
  subject: text
  type: text  
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 44. `portal_users`
```text
portal_users {
  portal_user_id: text                           -- PK
  type: text                                     -- (مضاف migration 20261002023000)
  phone: text                                    -- (مضاف migration 20261002023000)
  notes: text                                    -- (مضاف migration 20261002023000)
  profile_image_url: text                        -- (مضاف migration 20261002023000)
  commercial_register_url: text                  -- (مضاف migration 20261002023000)
  identity_doc_url: text                         -- (مضاف migration 20261002023000)
  portal_role: text
  username: text
  email: text
  disabled: boolean
  approval_status: text
  join_by: text
  referrer_id: text
  full_name: text
  name_ar: text
  name_en: text
  is_disabled: boolean
  onboarding_completed: boolean                  -- (مضاف migration 20261002023000)
  password: text                                 -- (مضاف migration 20261002023000) ⚠️ يجب ترحيله لـ password_hash
  linked_customer_id: text -> customers.customer_id
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 45. `report_settings`
```text
report_settings {
  report_setting_id: text
  default_currency: text
  exchange_rates: jsonb
  alternative_currency: text
  report_title: text
  show_logo: boolean
  show_header: boolean
  show_footer: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 46. `report_templates`
```text
report_templates {
  report_template_id: text
  active_report boolean
  filters jsonb
  name_ar text
  name_en text
  search_term text
  selected_company_id text
  selected_courier_id text
  selected_customer_id text
  selected_expense_category text
  selected_user_id text
  sort_by text
  sort_order text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```


### 47. `roles`
```text
roles {
  role_id: text
  title: text
  code: text
  description: text
  is_default: boolean
  permissions: jsonb
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 48. `salary_history`
```text
salary_history {
  salary_history_id: text
  user_id: text -> users.user_id
  account_id: text -> accounts.account_id
  cur_no: integer -> currency.cur_id
  transactions_id: text -> transactions.transaction_id
  amount: numeric
  month: text
  employee_id: text
  notes: text
  paid_at: timestamp with time zone
  status: text
  voucher_code: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 49. `sessions`
```text
sessions {
  session_id: text
  user_id: text -> users.user_id
  device_info: text
  last_seen: timestamp with time zone
  force_logout: boolean
  device_info: text
  role: text
  full_name: text
  email: text
  ip_address: text
  user_agent: text
  login_at: timestamp with time zone
  expires_at: timestamp with time zone
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 50. `settings`
```text
settings {
  setting_id: text
  category: text
  data: jsonb {
    apiKey
    autoBackupEnabled
    autoUpdateExchangeRates
    backupCollections
    backupCount
    backupEncrypted
    backupRetentionDays
    backupSchedule
    cbmShippingRateApiUrl
    companyAddress
    companyEmail
    companyName
    companyPhone
    companyWebsite
    config
    currency
    currencySymbol
    customCurrencies
    data
    defaultAppDuration
    defaultBankCommissionRate
    defaultCbmShippingRate
    defaultCompanyProfitRate
    defaultCourierCommissionRate
    defaultDeliveryFee
    defaultDestinationCountry
    defaultFactoryDuration
    defaultOrderCurrency
    defaultPackagingFee
    defaultProductInsuranceFee
    defaultProductInsuranceType
    defaultProfitPerKg
    defaultSheinDuration
    defaultShippingDuration
    defaultYemenDeliveryDuration
    enabled
    exchangeRatesApiUrl
    exchangeRateSAR
    exchangeRateUSD
    fontFamily
    fontSize
    footerTextAr
    footerTextEn
    gridColumns
    headerTitleAr
    headerTitleEn
    invoiceLogo
    invoiceNotes
    language
    lastAutoBackupAt
    lastBackup
    lastCbmRateUpdate
    lastCbmRateUpdatedBy
    lastExchangeRateUpdate
    lastExchangeRateUpdatedBy
    lastExchangeRateUpdateTime
    logoUrl
    margins
    orderPrefix
    orders_cost
    orderStartNumber
    packaging
    paperSize
    primaryColor
    protectSensitiveOrderDelete
    provider
    setting_id
    showBarcode
    showDateTime
    showLogo
    showSignatures
    showTaxId
    signature1Ar
    signature1En
    signature2Ar
    signature2En
    signature3Ar
    signature3En
    subtitleAr
    subtitleEn
    systemLogo
    systemName
    tableStyle
    taxId
    taxNumber
    templates
    theme
    triggers
    user_setting_id
    userid
    userSessionTimeout
    visibleMetrics
  }
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```


### 51. `user_settings`
```text
user_settings {
  user_setting_id: text
  user_id: text -> users.user_id    
  dashboard_grid_columns: numeric
  font_size: text
  language: text
  theme: text
  visible_metrics: jsonb
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 50. `users`
```text
users {
  user_id: text
  username: text
  role: text -> roles.role_id
  email: text
  disabled: boolean
  linked_type: text
  linked_entity: text
  full_name: text
  password: text
  system_pin: text
  is_root: boolean
  phone: text
  address: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  last_seen: timestamp with time zone
  last_seen_at: text
  created_by: text
  updated_by: text
}
```

### 51. `whatsapp_logs`
```text
whatsapp_logs {
  whatsapp_log_id: text
  error_msg: text
  event_type: text
  external_response: jsonb
  message: text
  message_type: text    
  phone: text
  status: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```

### 26. `jobs_req`
```text
jobs_req {
  job_req_id: text
  address: text
  city: text   
  email: text 
  experience_years: integer 
  full_name: text
  id_number: text
  job_position: text   
  notes: text  
  phone: text  
  qualification: text   
  ref_code: text 
  status: text 
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text -> users.user_id
  updated_by: text -> users.user_id
}
```

### 9. `announcements`
```text
announcements {
  announcement_id: text
  data: jsonb {
    content
    target_audience    
  }
  created_at: timestamp with time zone
  title: text
  is_active: boolean
  priority: text
  created_by: text -> users.user_id
  updated_at: timestamp with time zone
  updated_by: text
}
```

### 12. `browser_pages`
```text
browser_pages {
  browser_page_id: text
  auto_login: boolean
  username: text    
  password: text    
  category: text
  is_pinned: boolean
  name_ar: text
  name_en: text
  sort_order: integer
  tab_color: text
  url: text
  view_mode: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: text
  updated_by: text
}
```
