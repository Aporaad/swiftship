# هيكلية قاعدة البيانات (Database Schema Document)

## قائمة الجداول المتاحة (51 جدولاً)

1. `accounts`
2. `audit_logs`
3. `auto_entries`
4. `auto_entries_data`
5. `banner`
6. `branches`
7. `city`
8. `company_detail`
9. `cost_center`
10. `country`
11. `courier`
12. `courier_area`
13. `cust_details`
14. `cust_order_status`
15. `debtor_limits`
16. `delivery_run_sheets`
17. `delivery_types`
18. `driver_wallets`
19. `drivers`
20. `email_logs`
21. `financial_periods`
22. `journal_entries`
23. `journal_entry_details`
24. `item_types`
25. `items_category`
26. `order_address`
27. `order_attachments`
28. `order_option`
29. `order_status`
30. `order_status_history`
31. `orders`
32. `package_types`
33. `payment_types`
34. `reasons`
35. `role_permissions`
36. `roles`
37. `sales_representatives`
38. `settlements`
39. `shipment_financials`
40. `shipment_financials_detail`
41. `status`
42. `store_settlements`
43. `stores`
44. `sub_city`
45. `system_settings`
46. `ticket_messages`
47. `tickets`
48. `user_addresses`
49. `user_roles`
50. `user_sessions`
51. `users`

---

## تفاصيل الجداول والحقول والعلاقات

### 1. `accounts`
```text
accounts {
  id: uuid
  account_code: text
  name_ar: text
  name_en: text
  account_type: text
  parent_id: uuid -> accounts.id
  is_active: boolean
  currency: text
  balance: numeric
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 2. `audit_logs`
```text
audit_logs {
  id: uuid
  user_id: uuid -> users.id
  action: text
  entity: text
  entity_id: text
  old_data: jsonb
  new_data: jsonb
  ip_address: text
  created_at: timestamp with time zone
}
```

### 3. `auto_entries`
```text
auto_entries {
  id: bigint
  name_ar: text
  name_en: text
  data: jsonb {
    id: number
    name_ar: string
    currencyId: number
    amount_source: string
    descriptionTempAr: string
    isActive: boolean
    autoPost: boolean
  }
  status_id: bigint -> status.id
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 4. `auto_entries_data`
```text
auto_entries_data {
  id: bigint
  auto_entry_id: bigint -> auto_entries.id
  account_id: uuid -> accounts.id
  entry_type: text
  percentage: numeric
  fixed_amount: numeric
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 5. `banner`
```text
banner {
  id: bigint
  title: text
  image_url: text
  link_url: text
  is_active: boolean
  display_order: integer
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 6. `branches`
```text
branches {
  id: bigint
  name_ar: text
  name_en: text
  code: text
  city_id: bigint -> city.id
  address: text
  phone: text
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 7. `city`
```text
city {
  id: bigint
  country_id: bigint -> country.id
  name_ar: text
  name_en: text
  code: text
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 8. `company_detail`
```text
company_detail {
  id: bigint
  company_name_ar: text
  company_name_en: text
  tax_number: text
  commercial_register: text
  phone: text
  email: text
  address: text
  logo_url: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 9. `cost_center`
```text
cost_center {
  id: uuid
  code: text
  name_ar: text
  name_en: text
  parent_id: uuid -> cost_center.id
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 10. `country`
```text
country {
  id: bigint
  name_ar: text
  name_en: text
  code: text
  phone_code: text
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 11. `courier`
```text
courier {
  id: bigint
  name_ar: text
  name_en: text
  code: text
  phone: text
  email: text
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 12. `courier_area`
```text
courier_area {
  id: bigint
  courier_id: bigint -> courier.id
  city_id: bigint -> city.id
  sub_city_id: bigint -> sub_city.id
  delivery_fee: numeric
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 13. `cust_details`
```text
cust_details {
  cust_detail_id: text
  user_uid: text
  customer_id: text
  join_by: text
  referrer_id: text
  onboarding_completed: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  data: jsonb
  created_by: text
  updated_by: text
}
```

### 14. `cust_order_status`
```text
cust_order_status {
  id: bigint
  order_id: bigint -> orders.id
  status_id: bigint -> status.id
  notes: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 15. `debtor_limits`
```text
debtor_limits {
  id: uuid
  customer_id: uuid -> users.id
  credit_limit: numeric
  current_balance: numeric
  is_exceeded: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 16. `delivery_run_sheets`
```text
delivery_run_sheets {
  id: bigint
  sheet_number: text
  driver_id: uuid -> drivers.id
  status_id: bigint -> status.id
  total_orders: integer
  delivered_orders: integer
  failed_orders: integer
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 17. `delivery_types`
```text
delivery_types {
  id: bigint
  name_ar: text
  name_en: text
  code: text
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 18. `driver_wallets`
```text
driver_wallets {
  id: uuid
  driver_id: uuid -> drivers.id
  balance: numeric
  total_collected: numeric
  total_settled: numeric
  last_settlement_at: timestamp with time zone
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 19. `drivers`
```text
drivers {
  id: uuid
  user_id: uuid -> users.id
  vehicle_type: text
  vehicle_plate: text
  license_number: text
  is_available: boolean
  current_lat: numeric
  current_lng: numeric
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 20. `email_logs`
```text
email_logs {
  id: uuid
  recipient_email: text
  subject: text
  body: text
  status: text
  error_message: text
  sent_at: timestamp with time zone
  created_at: timestamp with time zone
}
```

### 21. `financial_periods`
```text
financial_periods {
  id: uuid
  period_name: text
  start_date: date
  end_date: date
  is_closed: boolean
  closed_at: timestamp with time zone
  closed_by: uuid -> users.id
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 22. `journal_entries`
```text
journal_entries {
  id: uuid
  entry_number: text
  entry_date: date
  financial_period_id: uuid -> financial_periods.id
  description: text
  is_posted: boolean
  posted_at: timestamp with time zone
  posted_by: uuid -> users.id
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 23. `journal_entry_details`
```text
journal_entry_details {
  id: uuid
  journal_entry_id: uuid -> journal_entries.id
  account_id: uuid -> accounts.id
  cost_center_id: uuid -> cost_center.id
  debit: numeric
  credit: numeric
  description: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 24. `item_types`
```text
item_types {
  id: bigint
  name_ar: text
  name_en: text
  code: text
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 25. `items_category`
```text
items_category {
  id: bigint
  name_ar: text
  name_en: text
  code: text
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 26. `order_address`
```text
order_address {
  id: bigint
  order_id: bigint -> orders.id
  address_type: text
  city_id: bigint -> city.id
  sub_city_id: bigint -> sub_city.id
  street_address: text
  building_number: text
  postal_code: text
  lat: numeric
  lng: numeric
  contact_name: text
  contact_phone: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 27. `order_attachments`
```text
order_attachments {
  id: bigint
  order_id: bigint -> orders.id
  file_name: text
  file_url: text
  file_type: text
  file_size: integer
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 28. `order_option`
```text
order_option {
  id: bigint
  name_ar: text
  name_en: text
  code: text
  fee: numeric
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 29. `order_status`
```text
order_status {
  id: bigint
  name_ar: text
  name_en: text
  code: text
  color: text
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 30. `order_status_history`
```text
order_status_history {
  id: bigint
  order_id: bigint -> orders.id
  status_id: bigint -> order_status.id
  changed_by: uuid -> users.id
  notes: text
  created_at: timestamp with time zone
}
```

### 31. `orders`
```text
orders {
  id: bigint
  tracking_number: text
  customer_id: uuid -> users.id
  store_id: bigint -> stores.id
  branch_id: bigint -> branches.id
  driver_id: uuid -> drivers.id
  delivery_type_id: bigint -> delivery_types.id
  package_type_id: bigint -> package_types.id
  payment_type_id: bigint -> payment_types.id
  status_id: bigint -> order_status.id
  cod_amount: numeric
  delivery_fee: numeric
  total_amount: numeric
  weight: numeric
  pieces_count: integer
  notes: text
  delivery_run_sheet_id: bigint -> delivery_run_sheets.id
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 32. `package_types`
```text
package_types {
  id: bigint
  name_ar: text
  name_en: text
  code: text
  max_weight: numeric
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 33. `payment_types`
```text
payment_types {
  id: bigint
  name_ar: text
  name_en: text
  code: text
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 34. `reasons`
```text
reasons {
  id: bigint
  name_ar: text
  name_en: text
  reason_type: text
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 35. `role_permissions`
```text
role_permissions {
  id: bigint
  role_id: uuid -> roles.id
  permission_code: text
  created_at: timestamp with time zone
}
```

### 36. `roles`
```text
roles {
  id: uuid
  title: text
  code: text
  description: text
  is_default: boolean
  permissions: jsonb {
    modules: array
    actions: array
  }
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 37. `sales_representatives`
```text
sales_representatives {
  id: uuid
  user_id: uuid -> users.id
  commission_rate: numeric
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 38. `settlements`
```text
settlements {
  id: uuid
  settlement_number: text
  entity_type: text
  entity_id: uuid
  total_amount: numeric
  settlement_date: date
  status: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 39. `shipment_financials`
```text
shipment_financials {
  id: bigint
  order_id: bigint -> orders.id
  cod_amount: numeric
  shipping_fee: numeric
  net_amount: numeric
  is_settled: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 40. `shipment_financials_detail`
```text
shipment_financials_detail {
  id: bigint
  shipment_financial_id: bigint -> shipment_financials.id
  fee_type: text
  amount: numeric
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 41. `status`
```text
status {
  id: bigint
  name_ar: text
  name_en: text
  code: text
  category: text
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 42. `store_settlements`
```text
store_settlements {
  id: uuid
  settlement_id: uuid -> settlements.id
  store_id: bigint -> stores.id
  total_orders: integer
  total_cod: numeric
  total_fees: numeric
  net_payable: numeric
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 43. `stores`
```text
stores {
  id: bigint
  customer_id: uuid -> users.id
  name_ar: text
  name_en: text
  phone: text
  address: text
  city_id: bigint -> city.id
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 44. `sub_city`
```text
sub_city {
  id: bigint
  city_id: bigint -> city.id
  name_ar: text
  name_en: text
  code: text
  is_active: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 45. `system_settings`
```text
system_settings {
  id: bigint
  setting_key: text
  setting_value: text
  description: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 46. `ticket_messages`
```text
ticket_messages {
  id: bigint
  ticket_id: bigint -> tickets.id
  sender_id: uuid -> users.id
  message: text
  attachment_url: text
  created_at: timestamp with time zone
}
```

### 47. `tickets`
```text
tickets {
  id: bigint
  ticket_number: text
  user_id: uuid -> users.id
  order_id: bigint -> orders.id
  subject: text
  status: text
  priority: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 48. `user_addresses`
```text
user_addresses {
  id: bigint
  user_id: uuid -> users.id
  title: text
  city_id: bigint -> city.id
  sub_city_id: bigint -> sub_city.id
  street_address: text
  building_number: text
  postal_code: text
  is_default: boolean
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```

### 49. `user_roles`
```text
user_roles {
  id: bigint
  user_id: uuid -> users.id
  role_id: uuid -> roles.id
  created_at: timestamp with time zone
}
```

### 50. `user_sessions`
```text
user_sessions {
  id: uuid
  user_id: uuid -> users.id
  token: text
  ip_address: text
  user_agent: text
  expires_at: timestamp with time zone
  created_at: timestamp with time zone
}
```

### 51. `users`
```text
users {
  id: uuid
  email: text
  full_name: text
  phone: text
  user_type: text
  is_active: boolean
  avatar_url: text
  created_at: timestamp with time zone
  updated_at: timestamp with time zone
  created_by: uuid -> users.id
  updated_by: uuid -> users.id
}
```
