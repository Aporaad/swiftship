# توثيق قاعدة البيانات (Database Schema Documentation)

---

## أولاً: أسماء جميع الجداول في قاعدة البيانات (Database Tables List)

إجمالي عدد الجداول: **51 جدولاً**

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

## ثانياً: تفاصيل الجداول والحقول والعلاقات (Tables, Columns & Relations)

### `acc_main`
```text
acc_main {
  "acc_main_id": text
  "account_id": text
  "account_code": text
  "acc_name_ar": text
  "acc_name_en": text
  "balance": numeric
  "cur_no": integer -> currency.cur_id
  "is_active": boolean
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
}
```

### `acc_sub`
```text
acc_sub {
  "acc_sub_id": text
  "acc_main_id": text
  "account_code": text
  "acc_name_ar": text
  "acc_name_en": text
  "balance": numeric
  "cur_no": integer -> currency.cur_id
  "is_active": boolean
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "allows_direct_accounts": boolean
}
```

### `acc_sub_group`
```text
acc_sub_group {
  "acc_sub_group_id": text
  "acc_sub_id": text
  "account_code": text
  "acc_name_ar": text
  "acc_name_en": text
  "balance": numeric
  "cur_no": integer -> currency.cur_id
  "is_active": boolean
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "entity_type": text
  "allows_direct_accounts": boolean
}
```

### `account`
```text
account {
  "account_id": text
  "account_code": text
  "acc_name_ar": text
  "acc_name_en": text
  "balance": numeric
  "cur_no": integer -> currency.cur_id
  "is_active": boolean
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "account_type": text
}
```

### `account_id_migration_map`
```text
account_id_migration_map {
  "migration_map_id": text
  "old_account_id": text
  "old_account_code": text
  "new_account_id": text
  "migrated_at": timestamp with time zone
}
```

### `account_trans`
```text
account_trans {
  "account_trans_id": text
  "main_entry_id": text
  "line_no": integer
  "trans_type": text
  "account_id": text -> accounts.account_id
  "account_cur_no": integer -> currency.cur_id
  "amount": numeric
  "amount_original": numeric
  "currency_original_no": integer -> currency.cur_id
  "currency_price_id": integer -> cur_price.cur_price_id
  "currency_price_seq": integer -> cur_price.cur_price_id
  "entity_type": text
  "entity_id": text
  "payment_method": text
  "order_id": text -> orders.order_id
  "shipment_id": text -> shipments.shipment_id
  "custody_id": text
  "auto_rule_id": text
  "automation_key": text
  "description": text
  "note": text
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "created_by_uid": text -> users.user_id
  "updated_by_uid": text -> users.user_id
  "conversion_rate": numeric
  "amount_original_text": text
  "account_currency_price_id": integer
  "account_currency_price_seq": integer
  "amount_text": text
}
```

### `accounts`
```text
accounts {
  "account_id": text
  "account_code": text
  "currency": text
  "entity_id": text
  "type": text
  "acc_sub_id": text
  "group_id": text
  "entity_type": text
  "account_seq": integer
  "acc_name_ar": text
  "acc_name_en": text
  "limited_balance": numeric
  "cur_no": integer -> currency.cur_id
  "is_active": boolean
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "last_recalculated_at": timestamp with time zone
  "balance": numeric
  "account_number": text
  "account_prefix": text
  "entity_name": text
  "debit_total": numeric
  "credit_total": numeric
  "parent_code": text
  "notes": text
  "monthly_salary": numeric
}
```

### `activity_logs`
```text
activity_logs {
  "activity_log_id": text
  "data": jsonb {
    "details",
    "userName",
    "userRole"
  }
  "user_id": text -> users.user_id
  "action": text
  "category": text
  "target": text
  "type": text
  "created_at": timestamp with time zone
}
```

### `announcements`
```text
announcements {
  "announcement_id": text
  "data": jsonb {
    "content",
    "id",
    "priority",
    "target_audience",
    "targetAudience",
    "title"
  }
  "created_at": timestamp with time zone
  "title": text
  "is_active": boolean
  "priority": text
  "created_by": text -> users.user_id
}
```

### `assets`
```text
assets {
  "asset_id": text
  "created_at": timestamp with time zone
  "asset_code": text
  "account_id": text -> accounts.account_id
  "status": text
  "currency": text
  "is_active": boolean
  "type": text
  "account_code": text
  "name_ar": text
  "name_en": text
}
```

### `auto_entries`
```text
auto_entries {
  "auto_entry_id": text
  "status_id": integer
  "name_ar": text
  "name_en": text
  "is_active": boolean
  "amount_source": text
  "data": jsonb {
    "amount_source",
    "amount_sources",
    "amount_strategy",
    "amountSource",
    "amountSources",
    "amountStrategy",
    "autoPost",
    "creditAccount",
    "cur_no",
    "curNo",
    "currencyId",
    "debitAccount",
    "descriptionTempAr",
    "descriptionTempEn",
    "id",
    "name_ar",
    "name_en",
    "nameAr",
    "nameEn",
    "skip_when_zero",
    "skipWhenZero",
    "statusNameAr"
  }
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "amount_sources": jsonb
  "amount_strategy": text
  "currency": text
  "skip_when_zero": boolean
  "cur_no": integer -> currency.cur_id
}
```

### `browser_pages`
```text
browser_pages {
  "browser_page_id": text
  "data": jsonb {
    "autoLogin",
    "category",
    "isPinned",
    "name",
    "password",
    "sortOrder",
    "tabColor",
    "url",
    "username",
    "viewMode"
  }
  "created_at": timestamp with time zone
}
```

### `couriers`
```text
couriers {
  "courier_id": text
  "account_id": text -> accounts.account_id
  "currency": text
  "is_active": boolean
  "full_name": text
  "name_ar": text
  "name_en": text
  "courier_type": text
  "courier_level": text
  "commission_rate": numeric
}
```

### `cur_price`
```text
cur_price {
  "cur_price_id": integer
  "cur_no": integer -> currency.cur_id
  "price": numeric
  "day_date": timestamp with time zone
  "seq": integer
  "updated_by": text
  "created_at": timestamp with time zone
}
```

### `currency`
```text
currency {
  "cur_id": integer
  "code": character varying
  "main_name_ar": text
  "sub_name_ar": text
  "main_name_en": text
  "sub_name_en": text
  "is_default": boolean
  "created_at": timestamp with time zone
  "is_active": boolean
  "symbol": character varying
  "flag": character varying
}
```

### `cust_details`
```text
cust_details {
  "cust_detail_id": text
  "user_uid": text
  "customer_id": text
  "join_by": text
  "referrer_id": text
  "onboarding_completed": boolean
  "created_at": bigint
  "updated_at": bigint
  "data": jsonb {
    "acquisitionSource",
    "address",
    "age",
    "bodyDetails",
    "city",
    "company_name",
    "country",
    "gender",
    "gps_location",
    "id_number",
    "joinBy",
    "location",
    "max_debt",
    "notes",
    "onboardingCompleted",
    "preferredCategories",
    "privacyPolicyAgreed",
    "privacyPolicyAgreedAt",
    "referrerId"
  }
}
```

### `custody_advances`
```text
custody_advances {
  "custody_advance_id": text
  "custody_number": text
  "recipient_type": text
  "recipient_id": text
  "recipient_name": text
  "recipient_account_id": text -> accounts.account_id
  "amount_original": numeric
  "currency_original_no": integer -> currency.cur_id
  "currency_price_id": integer -> cur_price.cur_price_id
  "currency_price_seq": integer -> cur_price.cur_price_id
  "amount_settled": numeric
  "amount_outstanding": numeric
  "status": text
  "issued_entry_id": text
  "settlement_entry_id": text
  "note": text
  "issued_at": timestamp with time zone
  "issued_by_uid": text -> users.user_id
  "settled_at": timestamp with time zone
  "settled_by_uid": text -> users.user_id
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "created_by_uid": text -> users.user_id
  "updated_by_uid": text -> users.user_id
}
```

### `customers`
```text
customers {
  "customer_id": text
  "account_id": text -> accounts.account_id
  "is_active": boolean
  "join_by": text
  "referrer_id": text
  "full_name": text
  "name_ar": text
  "name_en": text
  "customer_level": text
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "created_by": text
  "updated_by": text
}
```

### `default_accounts`
```text
default_accounts {
  "default_account_id": text
  "default_key": text
  "account_id": text -> accounts.account_id
  "acc_name_ar": text
  "acc_name_en": text
  "cur_no": integer -> currency.cur_id
  "is_active": boolean
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
}
```

### `employees`
```text
employees {
  "employee_id": text
  "account_id": text -> accounts.account_id
  "monthly_salary": numeric
  "currency": text
  "created_at": timestamp with time zone
  "created_by": text
  "full_name": text
  "name_ar": text
  "name_en": text
  "job_type": text
  "commission_rate": numeric
  "updated_at": timestamp with time zone
  "updated_by": text
}
```

### `entry_module`
```text
entry_module {
  "entry_module_id": text
  "code": text
  "name_ar": text
  "name_en": text
  "note": text
  "is_active": boolean
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "created_by_uid": text -> users.user_id
  "updated_by_uid": text -> users.user_id
}
```

### `entry_payment_details`
```text
entry_payment_details {
  "entry_payment_detail_id": text
  "main_entry_id": text
  "allocation_no": integer
  "payment_method": text
  "account_id": text -> accounts.account_id
  "amount_original": numeric
  "currency_original_no": integer -> currency.cur_id
  "bank_reference": text
  "due_at": timestamp with time zone
  "note": text
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "created_by_uid": text -> users.user_id
  "updated_by_uid": text -> users.user_id
}
```

### `entry_type`
```text
entry_type {
  "entry_type_id": text
  "code": text
  "module_id": text
  "name_ar": text
  "name_en": text
  "note": text
  "is_active": boolean
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "created_by_uid": text -> users.user_id
  "updated_by_uid": text -> users.user_id
}
```

### `financial_legacy_migration_map`
```text
financial_legacy_migration_map {
  "legacy_table": text
  "legacy_id": text
  "target_table": text
  "target_id": text
  "migration_status": text
  "migrated_at": timestamp with time zone
  "verified_at": timestamp with time zone
  "verified_by_uid": text -> users.user_id
}
```

### `financial_migration_exceptions`
```text
financial_migration_exceptions {
  "migration_exception_id": text
  "legacy_table": text
  "legacy_id": text
  "exception_code": text
  "severity": text
  "description": text
  "resolution_status": text
  "resolved_by_uid": text -> users.user_id
  "resolved_at": timestamp with time zone
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
}
```

### `items_category`
```text
items_category {
  "items_category_id": text
  "code": text
  "name_ar": text
  "name_en": text
  "description": text
  "hs_code_hint": text
  "customs_per_carton": numeric
  "tax_per_carton": numeric
  "other_fees_per_carton": numeric
  "customs_rate": numeric
  "tax_rate": numeric
  "fee_currency": text
  "requires_review": boolean
  "is_active": boolean
  "details": jsonb {
    "group",
    "hazardReview",
    "highValueReview"
  }
  "created_at": bigint
  "updated_at": bigint
}
```

### `jobs_req`
```text
jobs_req {
  "jobs_req_id": text
  "data": jsonb {
    "address",
    "city",
    "email",
    "experienceYears",
    "fullName",
    "idNumber",
    "jobPosition",
    "notes",
    "phone",
    "qualification",
    "refCode",
    "status"
  }
  "email": text
  "phone": text
  "status": text
  "category": text
  "ref_code": text
  "created_at": timestamp with time zone
}
```

### `main_entry`
```text
main_entry {
  "main_entry_id": text
  "entry_number": text
  "module_id": text
  "entry_type_id": text
  "entry_category": text
  "posting_status": text
  "description": text
  "notes": text
  "attachments": ARRAY
  "payment_method": text
  "order_id": text -> orders.order_id
  "shipment_id": text -> shipments.shipment_id
  "custody_id": text
  "automation_key": text
  "auto_rule_id": text
  "is_automatic": boolean
  "reverses_entry_id": text
  "effective_at": timestamp with time zone
  "posted_at": timestamp with time zone
  "voided_at": timestamp with time zone
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "created_by_uid": text -> users.user_id
  "updated_by_uid": text -> users.user_id
  "posted_by_uid": text -> users.user_id
  "voided_by_uid": text -> users.user_id
}
```

### `notifications`
```text
notifications {
  "notification_id": text
  "data": jsonb {
    "associatedUserIds",
    "category",
    "creatorId",
    "creatorName",
    "isPublic",
    "message",
    "read",
    "title",
    "type"
  }
  "user_id": text
  "category": text
  "is_public": boolean
  "read": boolean
  "type": text
  "created_at": timestamp with time zone
}
```

### `order_items`
```text
order_items {
  "order_item_id": text
  "order_id": text -> orders.order_id
  "product_id": text -> products.product_id
  "product_price": numeric
  "product_url": text
  "tracking_number": text
  "product_source_id": text
  "product_source_url": text
  "product_cooler": text
  "nota": text
  "quantity": numeric
  "total_price": numeric
  "total_weight": numeric
  "total_cbm": numeric
  "packaging_option_id": text
  "packaging_option_price": numeric
  "is_insured": boolean
  "insurance_fee": numeric
  "items_status": text
  "created_at": timestamp with time zone
  "created_by": text
  "updated_at": timestamp with time zone
  "updated_by": text
}
```

### `order_option`
```text
order_option {
  "order_option_id": text
  "code": text
  "name_ar": text
  "name_en": text
  "price": numeric
  "data": jsonb {
    "code",
    "details",
    "duration",
    "id",
    "name_ar",
    "name_en",
    "nameAr",
    "nameEn",
    "price",
    "type"
  }
}
```

### `order_status`
```text
order_status {
  "order_status_id": text
  "name_ar": text
  "name_en": text
  "is_first": boolean
  "is_last": boolean
  "sort_order": integer
  "color": text
  "code": text
  "data": jsonb {
    "code",
    "color",
    "description",
    "id",
    "isFirst",
    "isLast",
    "nameAr",
    "nameEn",
    "sortOrder"
  }
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
}
```

### `orders`
```text
orders {
  "order_id": text
  "data": jsonb {
    "addShippingEnabled",
    "amountPaid",
    "amountRemaining",
    "bankAccountId",
    "bankAmount",
    "bankCommissionEnabled",
    "bankCommissionRate",
    "bankCommissionType",
    "bankReference",
    "cartShareCode",
    "cashAccountId",
    "cashAmount",
    "cbmShippingRateValue",
    "companyProfitRate",
    "couponEnabled",
    "couponRate",
    "couponValue",
    "courierId",
    "currency",
    "customerAccountId",
    "customerId",
    "deductSourcingCostFromCourier",
    "deliveryCourierFee",
    "deliveryCourierFeeCurrency",
    "deliveryCourierFeeOrderCurrency",
    "deliveryStatus",
    "directApprove",
    "employeeId",
    "exchangeRate",
    "exchangeRateUSD",
    "exchangeRateYER",
    "externalOrderNumber",
    "firedTriggers",
    "homeDeliveryEnabled",
    "isStaffOrder",
    "locationYemen",
    "orderCurrency",
    "orderPartyAccountId",
    "orderPartyId",
    "orderPartyType",
    "orderStatus",
    "packagingFee",
    "packagingFeeEnabled",
    "packagingFeeRate",
    "paidCurrency",
    "payLater",
    "paymentMethod",
    "paymentStatus",
    "product_insurance_fee",
    "productInsuranceFee",
    "productsSum",
    "profitCompanySAR",
    "profitPerKgRate",
    "profitSaudiSAR",
    "sheinRedPrice",
    "shippingCompany",
    "shippingCostSAR",
    "shippingCourierFeeRate",
    "sourcing_cost",
    "sourcingCostAmount",
    "totalCBM",
    "totalCostSAR",
    "totalCostYER",
    "totalWeight",
    "viaShippingAgent"
  }
  "order_number": text
  "tracking_number": text
  "customer_id": text -> customers.customer_id
  "order_status1": text
  "created_at": timestamp with time zone
  "order_status_id": text
  "order_source_id": text
  "order_source_type": text
  "delivery_courier_id": text -> couriers.courier_id
  "shipping_courier_id": text -> couriers.courier_id
  "order_party_id": text
  "order_party_type": text
  "is_staff_order": boolean
  "employee_id": text -> employees.employee_id
  "courier_id": text -> couriers.courier_id
  "order_party_account_id": text -> accounts.account_id
  "created_by_name": text
  "updated_at": timestamp with time zone
  "updated_by": text
}
```

### `orders_history`
```text
orders_history {
  "orders_history_id": text
  "order_id": text -> orders.order_id
  "shipment_id": text -> shipments.shipment_id
  "event_type": text
  "action": text
  "entity_type": text
  "actor_id": text
  "actor_name": text
  "actor_role": text
  "summary": text
  "before_data": jsonb {
    "action",
    "category",
    "courier_id",
    "created_at",
    "created_by_name",
    "customer_id",
    "data",
    "delivery_courier_id",
    "employee_id",
    "id",
    "is_staff_order",
    "order_number",
    "order_party_account_id",
    "order_party_id",
    "order_party_type",
    "order_source_id",
    "order_source_type",
    "order_status_id",
    "order_status1",
    "shipping_courier_id",
    "target",
    "tracking_number",
    "type",
    "updated_at",
    "updated_by",
    "user_id"
  }
  "after_data": jsonb {
    "action",
    "amountOriginal",
    "carton_count",
    "category",
    "category_fee_currency",
    "category_fees_total",
    "content_category_id",
    "content_category_name",
    "courier_id",
    "created_at",
    "created_by_name",
    "createdAt",
    "currencyOriginalNo",
    "customer_id",
    "customs_fee",
    "data",
    "delivery_courier_id",
    "description",
    "effectiveAt",
    "employee_id",
    "entryCategory",
    "entryNumber",
    "id",
    "is_staff_order",
    "order_id",
    "order_number",
    "order_party_account_id",
    "order_party_id",
    "order_party_type",
    "order_source_id",
    "order_source_type",
    "order_status_id",
    "order_status1",
    "other_category_fee",
    "paymentMethod",
    "postingStatus",
    "shipment_id",
    "shipment_status",
    "shipping_category_id",
    "shipping_company_id",
    "shipping_cost",
    "shipping_courier_id",
    "target",
    "tax_fee",
    "tracking_number",
    "type",
    "updated_at",
    "updated_by",
    "user_id",
    "weight"
  }
  "metadata": jsonb {
    "accountTransCount",
    "activityAction",
    "activityDetails",
    "activityTarget",
    "changedFields",
    "changes",
    "deletedOrderId",
    "mainEntryId",
    "orderId",
    "orderReference",
    "shipmentId",
    "trigger"
  }
  "created_at": timestamp with time zone
}
```

### `portal_tickets`
```text
portal_tickets {
  "portal_ticket_id": text
  "data": jsonb {
    "message",
    "replies",
    "status",
    "subject",
    "type",
    "userName",
    "userRole",
    "userUid"
  }
  "created_at": timestamp with time zone
  "type": text
  "status": text
  "user_uid": text -> portal_users.portal_user_id
}
```

### `portal_user_migration_map`
```text
portal_user_migration_map {
  "portal_user_migration_map_id": text
  "portal_user_id": text -> portal_users.portal_user_id
  "old_uid": text
  "migrated_at": timestamp with time zone
}
```

### `portal_users`
```text
portal_users {
  "portal_user_id": text
  "data": jsonb {
    "address",
    "approvalStatus",
    "commercialRegisterUrl",
    "email",
    "financialCurrency",
    "fullName",
    "gpsLocation",
    "identityDocUrl",
    "joinBy",
    "notes",
    "onboardingCompleted",
    "password",
    "phone",
    "portalRole",
    "profileImageUrl",
    "referrerId",
    "type",
    "uid",
    "username"
  }
  "created_at": timestamp with time zone
  "portal_role": text
  "username": text
  "email": text
  "disabled": boolean
  "approval_status": text
  "join_by": text
  "referrer_id": text
  "full_name": text
  "name_ar": text
  "name_en": text
  "account_id": text -> accounts.account_id
  "linked_customer_id": text -> customers.customer_id
  "is_disabled": boolean
}
```

### `products`
```text
products {
  "product_id": text
  "product_name_ar": text
  "product_name_en": text
  "product_url": text
  "product_price_currency": integer -> currency.cur_id
  "unit_price": numeric
  "item_category_id": text -> items_category.items_category_id
  "is_allowed": boolean
  "cbm": numeric
  "width": numeric
  "height": numeric
  "length": numeric
  "weight": numeric
  "created_at": timestamp with time zone
  "created_by": text
  "updated_at": timestamp with time zone
  "updated_by": text
}
```

### `report_settings`
```text
report_settings {
  "report_setting_id": text
  "default_currency": text
  "alternative_currency": text
  "exchange_rates": jsonb
  "updated_at": timestamp with time zone
}
```

### `report_templates`
```text
report_templates {
  "report_template_id": text
  "data": jsonb {
    "activeReport",
    "filters",
    "name",
    "searchTerm",
    "selectedCompanyId",
    "selectedCourierId",
    "selectedCustomerId",
    "selectedExpenseCategory",
    "selectedOrderId",
    "selectedUserId",
    "sortBy",
    "sortOrder"
  }
  "created_by": uuid
}
```

### `returned_products`
```text
returned_products {
  "returned_product_id": text
  "return_number": text
  "order_id": text -> orders.order_id
  "product_id": text -> products.product_id
  "order_item_id": text -> order_items.order_item_id
  "customer_id": text -> customers.customer_id
  "customer_name": text
  "quantity": numeric
  "refund_amount": numeric
  "return_reason": text
  "notes": text
  "status": text
  "created_at": timestamp with time zone
  "created_by": text
  "updated_at": timestamp with time zone
  "updated_by": text
}
```

### `roles`
```text
roles {
  "role_id": text
  "data": jsonb {
    "isDefault",
    "permissions",
    "title"
  }
}
```

### `salary_history`
```text
salary_history {
  "salary_history_id": text
  "data": jsonb {
    "accountCode",
    "amount",
    "createdByName",
    "createdByUid",
    "currency",
    "employeeId",
    "employeeName",
    "notes",
    "paidAt",
    "salaryMonth",
    "status",
    "voucherCode"
  }
  "transactions_id": text
  "account_id": text -> accounts.account_id
  "user_id": text -> users.user_id
  "amount": numeric
  "currency": text
  "month": text
  "created_at": timestamp with time zone
  "cur_no": integer -> currency.cur_id
}
```

### `sessions`
```text
sessions {
  "session_id": text
  "user_id": text -> users.user_id
  "created_at": timestamp with time zone
  "last_seen": timestamp with time zone
  "force_logout": boolean
  "device_info": text
  "role": text
  "full_name": text
  "email": text
}
```

### `settings`
```text
settings {
  "setting_id": text
  "data": jsonb {
    "apiKey",
    "autoBackupEnabled",
    "autoUpdateExchangeRates",
    "backupCollections",
    "backupCount",
    "backupEncrypted",
    "backupRetentionDays",
    "backupSchedule",
    "cbmShippingRateApiUrl",
    "companyAddress",
    "companyEmail",
    "companyName",
    "companyPhone",
    "companyWebsite",
    "config",
    "currency",
    "currencySymbol",
    "customCurrencies",
    "data",
    "defaultAppDuration",
    "defaultBankCommissionRate",
    "defaultCbmShippingRate",
    "defaultCompanyProfitRate",
    "defaultCourierCommissionRate",
    "defaultDeliveryFee",
    "defaultDestinationCountry",
    "defaultFactoryDuration",
    "defaultOrderCurrency",
    "defaultPackagingFee",
    "defaultProductInsuranceFee",
    "defaultProductInsuranceType",
    "defaultProfitPerKg",
    "defaultSheinDuration",
    "defaultShippingDuration",
    "defaultYemenDeliveryDuration",
    "enabled",
    "exchangeRatesApiUrl",
    "exchangeRateSAR",
    "exchangeRateUSD",
    "exchangeRateYER",
    "fontFamily",
    "fontSize",
    "footerTextAr",
    "footerTextEn",
    "gridColumns",
    "headerTitleAr",
    "headerTitleEn",
    "invoiceLogo",
    "invoiceNotes",
    "language",
    "lastAutoBackupAt",
    "lastBackup",
    "lastCbmRateUpdate",
    "lastCbmRateUpdatedBy",
    "lastExchangeRateUpdate",
    "lastExchangeRateUpdatedBy",
    "lastExchangeRateUpdateTime",
    "logoUrl",
    "margins",
    "orderPrefix",
    "orders_cost",
    "orderStartNumber",
    "packaging",
    "paperSize",
    "primaryColor",
    "protectSensitiveOrderDelete",
    "provider",
    "setting_id",
    "showBarcode",
    "showDateTime",
    "showLogo",
    "showSignatures",
    "showTaxId",
    "signature1Ar",
    "signature1En",
    "signature2Ar",
    "signature2En",
    "signature3Ar",
    "signature3En",
    "subtitleAr",
    "subtitleEn",
    "systemLogo",
    "systemName",
    "tableStyle",
    "taxId",
    "taxNumber",
    "templates",
    "theme",
    "triggers",
    "user_setting_id",
    "userid",
    "userSessionTimeout",
    "visibleMetrics"
  }
  "category": text
}
```

### `shipments`
```text
shipments {
  "shipment_id": text
  "order_id": text -> orders.order_id
  "tracking_number": text
  "shipping_company_id": text
  "courier_id": text
  "shipment_status": text
  "shipping_cost": numeric
  "weight": numeric
  "data": jsonb
  "created_at": timestamp with time zone
  "shipping_category_id": text
  "content_category_id": text
  "content_category_name": text
  "carton_count": numeric
  "customs_fee": numeric
  "tax_fee": numeric
  "other_category_fee": numeric
  "category_fees_total": numeric
  "category_fee_currency": text
}
```

### `shipping_companies`
```text
shipping_companies {
  "shipping_company_id": text
  "name": text
  "shipping_company_url": text
  "tracking_id_prefix": text
  "account_id": text -> accounts.account_id
  "name_ar": text
  "name_en": text
}
```

### `sources`
```text
sources {
  "source_id": text
  "name": text
  "type": text
  "source_url": text
  "account_id": text -> accounts.account_id
  "name_ar": text
  "name_en": text
}
```

### `user_settings`
```text
user_settings {
  "user_setting_id": text
  "data": jsonb {
    "dashboardGridColumns",
    "fontSize",
    "language",
    "theme",
    "userid",
    "visibleMetrics"
  }
  "created_at": timestamp with time zone
  "user_id": text
}
```

### `users`
```text
users {
  "user_id": text
  "role": text -> roles.role_id
  "username": text
  "email": text
  "disabled": boolean
  "linked_type": text
  "linked_entity": text
  "full_name": text
  "password": text
  "system_pin": text
  "is_root": boolean
  "phone": text
  "address": text
  "created_at": bigint
  "updated_at": bigint
  "last_seen": bigint
  "last_seen_at": text
}
```

### `whatsapp_logs`
```text
whatsapp_logs {
  "whatsapp_log_id": text
  "data": jsonb {
    "errorMsg",
    "eventType",
    "externalResponse",
    "message",
    "phone",
    "status"
  }
}
```
