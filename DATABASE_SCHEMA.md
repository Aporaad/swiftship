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
24. `expenses`
25. `financial_legacy_migration_map`
26. `financial_migration_exceptions`
27. `items_category`
28. `jobs_req`
29. `main_entry`
30. `notifications`
31. `order_items`
32. `order_option`
33. `order_status`
34. `orders`
35. `orders_history`
36. `portal_tickets`
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
  "id": text
  "account_id": text -> account.id
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
  "id": text
  "acc_main_id": text -> acc_main.id
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
  "id": text
  "acc_sub_id": text -> acc_sub.id
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
  "id": text
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
  "id": text
  "old_account_id": text
  "old_account_code": text
  "new_account_id": text
  "migrated_at": timestamp with time zone
}
```

### `account_trans`
```text
account_trans {
  "id": text
  "entry_id": text -> main_entry.id
  "line_no": integer
  "trans_type": text
  "account_id": text -> accounts.id
  "account_cur_no": integer -> currency.cur_id
  "amount": numeric
  "amount_original": numeric
  "currency_original_no": integer -> currency.cur_id
  "currency_price_id": integer -> cur_price.id
  "currency_price_seq": integer -> cur_price.id
  "entity_type": text
  "entity_id": text
  "payment_method": text
  "order_id": text -> orders.id
  "shipment_id": text -> shipments.id
  "custody_id": text -> custody_advances.id
  "auto_rule_id": text
  "automation_key": text
  "description": text
  "note": text
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "created_by_uid": text -> users.id
  "updated_by_uid": text -> users.id
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
  "id": text
  "account_code": text
  "currency": text
  "entity_id": text
  "type": text
  "acc_sub_id": text -> acc_sub.id
  "group_id": text -> acc_sub_group.id
  "entity_type": text
  "account_seq": integer
  "acc_name_ar": text
  "acc_name_en": text
  "limited_balance": numeric
  "cur_no": integer -> currency.cur_id
  "is_active": boolean
  "createdAt": timestamp with time zone
  "updatedAt": timestamp with time zone
  "lastRecalculatedAt": timestamp with time zone
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
  "id": text
  "data": jsonb {
    "action"
    "target"
    "userId"
    "details" {
      "customerName"
      "totalCostYER"
      "cascadeDeletion" {
        "orders"
        "expenses"
        "orderIds"
        "products"
        "shipments"
        "mainEntries"
        "accountTrans"
        "whatsappLogs"
        "notifications"
        "ordersHistory"
        "activityLogsDeleted"
      }
      "id"
    }
    "userName"
    "userRole"
    "timestamp"
  }
  "userId": text -> users.id
  "action": text
  "category": text
  "target": text
  "type": text
  "createdAt": timestamp with time zone
}
```

### `announcements`
```text
announcements {
  "id": text
  "data": jsonb {
    "id"
    "title"
    "content"
    "isActive"
    "priority"
    "createdAt"
    "is_active"
    "created_at"
    "targetAudience"
    "target_audience"
  }
  "created_at": timestamp with time zone
  "title": text
  "isActive": boolean
  "priority": text
  "createdBy": text -> users.id
  "createdAt": timestamp with time zone
}
```

### `assets`
```text
assets {
  "id": text
  "data": jsonb {
    "cost"
    "type"
    "notes"
    "nameAr"
    "nameEn"
    "status"
    "category"
    "currency"
    "assetCode"
    "createdAt"
    "purchaseDate"
    "maintenanceLogs"
    "assignedCourierId"
    "financialAccountId"
    "assignedCourierName"
    "financialAccountCode"
  }
  "created_at": timestamp with time zone
  "assetCode": text
  "account_id": text -> accounts.id
  "status": text
  "currency": text
  "is_active": boolean
  "type": text
  "account_code": text
}
```

### `auto_entries`
```text
auto_entries {
  "id": text
  "status_id": integer
  "name_ar": text
  "name_en": text
  "is_active": boolean
  "amount_source": text
  "data": jsonb {
    "id"
    "nameAr"
    "nameEn"
    "isActive"
    "statusId"
    "updatedAt"
    "amountSource"
    "debitAccount" {
      "id"
      "code"
      "name"
      "type"
    }
    "statusNameAr"
    "creditAccount" {
      "id"
      "code"
      "name"
      "type"
    }
    "descriptionTempAr"
    "descriptionTempEn"
    "createdAt"
    "skipWhenZero"
    "amountSources"
    "amountStrategy"
  }
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "amount_sources": jsonb []
  "amount_strategy": text
  "currency": text
  "skip_when_zero": boolean
  "cur_no": integer -> currency.cur_id
}
```

### `browser_pages`
```text
browser_pages {
  "id": text
  "data": jsonb {}
  "created_at": timestamp with time zone
}
```

### `couriers`
```text
couriers {
  "id": text
  "data": jsonb {
    "type"
    "email"
    "level"
    "notes"
    "phone"
    "levels"
    "address"
    "currency"
    "disabled"
    "fullName"
    "isActive"
    "accountId"
    "createdAt"
    "is_active"
    "updatedAt"
    "account_id"
    "courierType"
    "gpsLocation"
    "commissionRate"
    "courierCustomId"
    "financialBalance"
    "financialCurrency"
    "financialAccountId"
    "financialAccountCode"
    "city"
    "country"
    "systemUserId"
  }
  "account_id": text -> accounts.id
  "currency": text
  "is_active": boolean
  "type": text
  "levels": text
}
```

### `cur_price`
```text
cur_price {
  "id": integer
  "cur_no": integer -> currency.cur_id
  "price": numeric
  "day_date": timestamp with time zone
  "seq": integer
  "updateBy": text
  "createdAt": timestamp with time zone
}
```

### `currency`
```text
currency {
  "cur_id": integer
  "code": character varying
  "main_nameAR": text
  "sup_nameAR": text
  "main_nameEn": text
  "sup_nameEn": text
  "isDefault": boolean
  "createdAt": timestamp with time zone
  "isActive": boolean
  "symbol": character varying
  "flag": character varying
}
```

### `cust_details`
```text
cust_details {
  "id": text
  "user_uid": text
  "customer_id": text
  "join_by": text
  "referrer_id": text
  "onboarding_completed": boolean
  "created_at": bigint
  "updated_at": bigint
  "data": jsonb {
    "age"
    "gender"
    "joinBy"
    "location" {
      "lat"
      "lng"
      "city"
      "street"
      "country"
      "governorate"
      "addressDetails"
    }
    "createdAt"
    "updatedAt"
    "referrerId"
    "bodyDetails" {
      "coatSize"
      "shoeSize"
      "pantsSize"
      "shortsSize"
      "preferredColors"
      "heightCm"
      "weightKg"
    }
    "acquisitionSource" {
      "notes"
      "joinBy"
      "referrerId"
    }
    "onboardingCompleted"
    "preferredCategories"
    "privacyPolicyAgreed"
    "privacyPolicyAgreedAt"
    "city"
    "notes"
    "address"
    "country"
    "max_debt"
    "id_number"
    "company_name"
    "gps_location"
  }
}
```

### `custody_advances`
```text
custody_advances {
  "id": text
  "custody_number": text
  "recipient_type": text
  "recipient_id": text
  "recipient_name": text
  "recipient_account_id": text -> accounts.id
  "amount_original": numeric
  "currency_original_no": integer -> currency.cur_id
  "currency_price_id": integer -> cur_price.id
  "currency_price_seq": integer -> cur_price.id
  "amount_settled": numeric
  "amount_outstanding": numeric
  "status": text
  "issued_entry_id": text -> main_entry.id
  "settlement_entry_id": text -> main_entry.id
  "note": text
  "issued_at": timestamp with time zone
  "issued_by_uid": text -> users.id
  "settled_at": timestamp with time zone
  "settled_by_uid": text -> users.id
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "created_by_uid": text -> users.id
  "updated_by_uid": text -> users.id
}
```

### `customers`
```text
customers {
  "id": text
  "data": jsonb {
    "email"
    "level"
    "notes"
    "phone"
    "levels"
    "address"
    "join_by"
    "disabled"
    "fullName"
    "isActive"
    "accountId"
    "createdAt"
    "is_active"
    "updatedAt"
    "account_id"
    "referrer_id"
    "gps_location"
    "financialBalance"
    "financialCurrency"
    "financialAccountId"
    "financialAccountCode"
    "joinBy"
    "username"
    "portalUid"
    "referrerId"
    "gpsLocation"
  }
  "account_id": text -> accounts.id
  "is_active": boolean
  "levels": text
  "join_by": text
  "referrer_id": text
}
```

### `default_accounts`
```text
default_accounts {
  "id": text
  "default_key": text
  "account_id": text -> accounts.id
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
  "id": text
  "account_id": text -> accounts.id
  "monthlySalary": numeric
  "currency": text
  "jobsType": text
  "data": jsonb {
    "role"
    "email"
    "userId"
    "currency"
    "disabled"
    "fullName"
    "jobsType"
    "accountId"
    "createdAt"
    "createdBy"
    "updatedAt"
    "account_id"
    "monthlySalary"
    "financialBalance"
    "financialAccountId"
    "financialAccountCode"
    "notes"
    "phone"
    "address"
    "commissionRate"
  }
  "createdAt": timestamp with time zone
  "createdBy": text
}
```

### `entry_module`
```text
entry_module {
  "id": text
  "code": text
  "name_ar": text
  "name_en": text
  "note": text
  "is_active": boolean
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "created_by_uid": text -> users.id
  "updated_by_uid": text -> users.id
}
```

### `entry_payment_details`
```text
entry_payment_details {
  "id": text
  "entry_id": text -> main_entry.id
  "allocation_no": integer
  "payment_method": text
  "account_id": text -> accounts.id
  "amount_original": numeric
  "currency_original_no": integer -> currency.cur_id
  "bank_reference": text
  "due_at": timestamp with time zone
  "note": text
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "created_by_uid": text -> users.id
  "updated_by_uid": text -> users.id
}
```

### `entry_type`
```text
entry_type {
  "id": text
  "code": text
  "module_id": text -> entry_module.id
  "name_ar": text
  "name_en": text
  "note": text
  "is_active": boolean
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "created_by_uid": text -> users.id
  "updated_by_uid": text -> users.id
}
```

### `expenses`
```text
expenses {
  "id": text
  "data": jsonb {
    "type"
    "notes"
    "amount"
    "status"
    "category"
    "currency"
    "createdAt"
    "recipientId"
    "salaryMonth"
    "createdByUid"
    "createdByName"
    "expenseNumber"
    "recipientName"
    "createdByEmail"
    "financialAccountId"
    "financialAccountCode"
    "amountInDefaultCurrency"
  }
  "expense_number": text
  "transactionsID": text
  "account_id": text -> accounts.id
  "category": text
  "amount": numeric
  "currency": text
  "createdAt": timestamp with time zone
  "cur_no": integer -> currency.cur_id
}
```

### `items_category`
```text
items_category {
  "id": text
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
    "group"
    "hazardReview"
  }
  "createdAt": bigint
  "updatedAt": bigint
}
```

### `jobs_req`
```text
jobs_req {
  "id": text
  "data": jsonb {
    "city"
    "email"
    "notes"
    "phone"
    "status"
    "address"
    "refCode"
    "fullName"
    "idNumber"
    "createdAt"
    "updatedAt"
    "jobPosition"
    "qualification"
    "experienceYears"
  }
  "email": text
  "phone": text
  "status": text
  "category": text
  "refCode": text
  "createdAt": timestamp with time zone
}
```

### `main_entry`
```text
main_entry {
  "id": text
  "entry_number": text
  "module_id": text -> entry_module.id
  "entry_type_id": text -> entry_type.id
  "entry_category": text
  "posting_status": text
  "description": text
  "notes": text
  "attachments": ARRAY
  "payment_method": text
  "order_id": text -> orders.id
  "shipment_id": text -> shipments.id
  "custody_id": text -> custody_advances.id
  "automation_key": text
  "auto_rule_id": text
  "is_automatic": boolean
  "reverses_entry_id": text -> main_entry.id
  "effective_at": timestamp with time zone
  "posted_at": timestamp with time zone
  "voided_at": timestamp with time zone
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
  "created_by_uid": text -> users.id
  "updated_by_uid": text -> users.id
  "posted_by_uid": text -> users.id
  "voided_by_uid": text -> users.id
}
```

### `notifications`
```text
notifications {
  "id": text
  "data": jsonb {
    "read"
    "type"
    "title"
    "userId"
    "message"
    "orderId"
    "category"
    "isPublic"
    "createdAt"
    "creatorId"
    "creatorName"
    "associatedUserIds"
  }
  "userId": text
  "category": text
  "isPublic": boolean
  "read": boolean
  "type": text
  "createdAt": timestamp with time zone
}
```

### `order_items`
```text
order_items {
  "items_id": text
  "order_id": text -> orders.id
  "product_id": text -> products.product_id
  "product_price": numeric
  "product_url": text
  "tracking_number": text
  "produc_source_id": text -> sources.id
  "produc_source_url": text
  "product_cooler": text
  "nota": text
  "quantity": numeric
  "total_price": numeric
  "total__weight": numeric
  "total_cbm": numeric
  "packaging_option_id": text -> order_option.id
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
  "id": text
  "type": text
  "name_ar": text
  "name_en": text
  "price": numeric
  "duration": integer
  "details": text
  "code": text
  "is_active": boolean
  "data": jsonb {
    "id"
    "code"
    "type"
    "price"
    "nameAr"
    "nameEn"
    "details"
    "name_ar"
    "name_en"
    "duration"
    "isActive"
    "is_active"
  }
  "createdAt": bigint
  "updatedAt": bigint
}
```

### `order_status`
```text
order_status {
  "id": text
  "name_ar": text
  "name_en": text
  "is_first": boolean
  "is_last": boolean
  "sort_order": integer
  "color": text
  "code": text
  "data": jsonb {
    "id"
    "code"
    "color"
    "isLast"
    "nameAr"
    "nameEn"
    "isFirst"
    "sortOrder"
    "description"
    "updatedAt"
  }
  "created_at": timestamp with time zone
  "updated_at": timestamp with time zone
}
```

### `orders`
```text
orders {
  "id": text
  "data": jsonb {
    "currency"
    "payLater"
    "totalCBM"
    "courierId"
    "amountPaid"
    "bankAmount"
    "cashAmount"
    "couponRate"
    "customerId"
    "employeeId"
    "couponValue"
    "productsSum"
    "totalWeight"
    "exchangeRate"
    "isStaffOrder"
    "orderPartyId"
    "packagingFee"
    "paidCurrency"
    "totalCostSAR"
    "totalCostYER"
    "bankAccountId"
    "bankReference"
    "cartShareCode"
    "cashAccountId"
    "couponEnabled"
    "directApprove"
    "firedTriggers"
    "locationYemen"
    "orderCurrency"
    "paymentMethod"
    "paymentStatus"
    "sheinRedPrice"
    "sourcing_cost"
    "deliveryStatus"
    "orderPartyType"
    "profitSaudiSAR"
    "amountRemaining"
    "exchangeRateUSD"
    "exchangeRateYER"
    "profitPerKgRate"
    "shippingCompany"
    "shippingCostSAR"
    "packagingFeeRate"
    "profitCompanySAR"
    "viaShippingAgent"
    "companyProfitRate"
    "customerAccountId"
    "addShippingEnabled"
    "bankCommissionRate"
    "bankCommissionType"
    "deliveryCourierFee"
    "sourcingCostAmount"
    "externalOrderNumber"
    "homeDeliveryEnabled"
    "orderPartyAccountId"
    "packagingFeeEnabled"
    "productInsuranceFee"
    "cbmShippingRateValue"
    "bankCommissionEnabled"
    "product_insurance_fee"
    "shippingCourierFeeRate"
    "deliveryCourierFeeCurrency"
    "deductSourcingCostFromCourier"
    "deliveryCourierFeeOrderCurrency"
    "updatedAt"
  }
  "order_number": text
  "tracking_number": text
  "customer_id": text -> customers.id
  "order_status1": text
  "createdAt": timestamp with time zone
  "order_status_id": text -> order_status.id
  "order_source_id": text -> sources.id
  "order_source_type": text
  "delivery_courier_id": text -> couriers.id
  "shipping_courier_id": text -> couriers.id
  "order_party_id": text
  "order_party_type": text
  "is_staff_order": boolean
  "employee_id": text -> employees.id
  "courier_id": text -> couriers.id
  "order_party_account_id": text -> accounts.id
  "created_by_name": text
  "updated_at": timestamp with time zone
  "updated_by": text
}
```

### `orders_history`
```text
orders_history {
  "id": text
  "order_id": text -> orders.id
  "order_number": text
  "shipment_id": text -> shipments.id
  "journal_entry_id": text
  "account_transaction_id": text
  "activity_log_id": text
  "event_type": text
  "event_category": text
  "operation": text
  "entity_type": text
  "actor_id": text
  "actor_name": text
  "actor_role": text
  "source": text
  "summary": text
  "before_data": jsonb {}
  "after_data": jsonb {}
  "metadata": jsonb {
    "changes" {
      "id" {
        "after"
        "before"
      }
      "createdAt" {
        "after"
        "before"
      }
      "courier_id" {
        "after"
        "before"
      }
      "updated_at" {
        "after"
        "before"
      }
      "updated_by" {
        "after"
        "before"
      }
      "customer_id" {
        "after"
        "before"
      }
      "employee_id" {
        "after"
        "before"
      }
      "order_number" {
        "after"
        "before"
      }
      "data.currency" {
        "after"
        "before"
      }
      "data.payLater" {
        "after"
        "before"
      }
      "data.totalCBM" {
        "after"
        "before"
      }
      "order_status1" {
        "after"
        "before"
      }
      "data.courierId" {
        "after"
        "before"
      }
      "is_staff_order" {
        "after"
        "before"
      }
      "order_party_id" {
        "after"
        "before"
      }
      "created_by_name" {
        "after"
        "before"
      }
      "data.amountPaid" {
        "after"
        "before"
      }
      "data.bankAmount" {
        "after"
        "before"
      }
      "data.cashAmount" {
        "after"
        "before"
      }
      "data.couponRate" {
        "after"
        "before"
      }
      "data.customerId" {
        "after"
        "before"
      }
      "data.employeeId" {
        "after"
        "before"
      }
      "order_source_id" {
        "after"
        "before"
      }
      "order_status_id" {
        "after"
        "before"
      }
      "tracking_number" {
        "after"
        "before"
      }
      "data.couponValue" {
        "after"
        "before"
      }
      "data.productsSum" {
        "after"
        "before"
      }
      "data.totalWeight" {
        "after"
        "before"
      }
      "order_party_type" {
        "after"
        "before"
      }
      "data.exchangeRate" {
        "after"
        "before"
      }
      "data.isStaffOrder" {
        "after"
        "before"
      }
      "data.orderPartyId" {
        "after"
        "before"
      }
      "data.packagingFee" {
        "after"
        "before"
      }
      "data.paidCurrency" {
        "after"
        "before"
      }
      "data.totalCostSAR" {
        "after"
        "before"
      }
      "data.totalCostYER" {
        "after"
        "before"
      }
      "order_source_type" {
        "after"
        "before"
      }
      "data.bankAccountId" {
        "after"
        "before"
      }
      "data.bankReference" {
        "after"
        "before"
      }
      "data.cartShareCode" {
        "after"
        "before"
      }
      "data.cashAccountId" {
        "after"
        "before"
      }
      "data.couponEnabled" {
        "after"
        "before"
      }
      "data.directApprove" {
        "after"
        "before"
      }
      "data.firedTriggers" {
        "after"
        "before"
      }
      "data.locationYemen" {
        "after"
        "before"
      }
      "data.orderCurrency" {
        "after"
        "before"
      }
      "data.paymentMethod" {
        "after"
        "before"
      }
      "data.paymentStatus" {
        "after"
        "before"
      }
      "data.sheinRedPrice" {
        "after"
        "before"
      }
      "data.sourcing_cost" {
        "after"
        "before"
      }
      "data.deliveryStatus" {
        "after"
        "before"
      }
      "data.orderPartyType" {
        "after"
        "before"
      }
      "data.profitSaudiSAR" {
        "after"
        "before"
      }
      "delivery_courier_id" {
        "after"
        "before"
      }
      "shipping_courier_id" {
        "after"
        "before"
      }
      "data.amountRemaining" {
        "after"
        "before"
      }
      "data.exchangeRateUSD" {
        "after"
        "before"
      }
      "data.exchangeRateYER" {
        "after"
        "before"
      }
      "data.profitPerKgRate" {
        "after"
        "before"
      }
      "data.shippingCompany" {
        "after"
        "before"
      }
      "data.shippingCostSAR" {
        "after"
        "before"
      }
      "data.packagingFeeRate" {
        "after"
        "before"
      }
      "data.profitCompanySAR" {
        "after"
        "before"
      }
      "data.viaShippingAgent" {
        "after"
        "before"
      }
      "data.companyProfitRate" {
        "after"
        "before"
      }
      "data.customerAccountId" {
        "after"
        "before"
      }
      "order_party_account_id" {
        "after"
        "before"
      }
      "data.addShippingEnabled" {
        "after"
        "before"
      }
      "data.bankCommissionRate" {
        "after"
        "before"
      }
      "data.bankCommissionType" {
        "after"
        "before"
      }
      "data.deliveryCourierFee" {
        "after"
        "before"
      }
      "data.sourcingCostAmount" {
        "after"
        "before"
      }
      "data.externalOrderNumber" {
        "after"
        "before"
      }
      "data.homeDeliveryEnabled" {
        "after"
        "before"
      }
      "data.orderPartyAccountId" {
        "after"
        "before"
      }
      "data.packagingFeeEnabled" {
        "after"
        "before"
      }
      "data.productInsuranceFee" {
        "after"
        "before"
      }
      "data.cbmShippingRateValue" {
        "after"
        "before"
      }
      "data.bankCommissionEnabled" {
        "after"
        "before"
      }
      "data.product_insurance_fee" {
        "after"
        "before"
      }
      "data.shippingCourierFeeRate" {
        "after"
        "before"
      }
      "data.deliveryCourierFeeCurrency" {
        "after"
        "before"
      }
      "data.deductSourcingCostFromCourier" {
        "after"
        "before"
      }
      "data.deliveryCourierFeeOrderCurrency" {
        "after"
        "before"
      }
      "weight" {
        "after"
        "before"
      }
      "tax_fee" {
        "after"
        "before"
      }
      "order_id" {
        "after"
        "before"
      }
      "customs_fee" {
        "after"
        "before"
      }
      "carton_count" {
        "after"
        "before"
      }
      "shipping_cost" {
        "after"
        "before"
      }
      "shipment_status" {
        "after"
        "before"
      }
      "other_category_fee" {
        "after"
        "before"
      }
      "category_fees_total" {
        "after"
        "before"
      }
      "content_category_id" {
        "after"
        "before"
      }
      "shipping_company_id" {
        "after"
        "before"
      }
      "shipping_category_id" {
        "after"
        "before"
      }
      "category_fee_currency" {
        "after"
        "before"
      }
      "content_category_name" {
        "after"
        "before"
      }
    }
    "trigger"
    "changedFields"
    "deletedOrderId"
    "orderReference"
  }
  "occurred_at": timestamp with time zone
  "created_at": timestamp with time zone
  "main_entry_id": text -> main_entry.id
  "account_trans_count": integer
}
```

### `portal_tickets`
```text
portal_tickets {
  "id": text
  "data": jsonb {
    "type"
    "status"
    "message"
    "replies" [
      "id"
      "sender"
      "message"
      "createdAt"
    ]
    "subject"
    "userUid"
    "userName"
    "userRole"
    "createdAt"
    "updatedAt"
  }
  "created_at": timestamp with time zone
  "type": text
  "status": text
  "userUid": text -> portal_users.id
  "createdAt": timestamp with time zone
}
```

### `portal_users`
```text
portal_users {
  "id": text
  "data": jsonb {
    "uid"
    "type"
    "email"
    "notes"
    "phone"
    "joinBy"
    "address"
    "fullName"
    "username"
    "createdAt"
    "updatedAt"
    "portalRole"
    "referrerId"
    "gpsLocation"
    "linkedAccId"
    "approvalStatus"
    "identityDocUrl"
    "profileImageUrl"
    "financialBalance"
    "linkedCustomerId"
    "financialCurrency"
    "financialAccountId"
    "onboardingCompleted"
    "financialAccountCode"
    "commercialRegisterUrl"
  }
  "created_at": timestamp with time zone
  "portal_role": text
  "username": text
  "email": text
  "disabled": boolean
  "approval_status": text
  "linkedAccId": text
  "join_by": text
  "referrer_id": text
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
  "item_category_id": text -> items_category.id
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
  "id": text
  "default_currency": text
  "alternative_currency": text
  "exchange_rates": jsonb {}
  "updated_at": timestamp with time zone
}
```

### `report_templates`
```text
report_templates {
  "id": text
  "data": jsonb {}
  "created_by": uuid
}
```

### `returned_products`
```text
returned_products {
  "return_id": text
  "order_id": text
  "order_item_id": text -> order_items.items_id
  "product_id": text -> products.product_id
  "customer_id": text
  "customer_name": text
  "product_name": text
  "product_url": text
  "quantity": integer
  "return_reason": text
  "return_type": text
  "return_status": text
  "return_condition": text
  "refund_amount": numeric
  "refund_currency": text
  "is_insured": boolean
  "insurance_refund": numeric
  "notes": text
  "returned_at": timestamp with time zone
  "processed_by": text
  "processed_at": timestamp with time zone
  "created_at": timestamp with time zone
  "created_by": text
  "updated_at": timestamp with time zone
  "updated_by": text
}
```

### `roles`
```text
roles {
  "id": text
  "data": jsonb {
    "title"
    "updatedAt"
    "permissions"
    "createdAt"
    "isDefault"
  }
}
```

### `salary_history`
```text
salary_history {
  "id": text
  "data": jsonb {
    "notes"
    "amount"
    "paidAt"
    "status"
    "currency"
    "accountId"
    "createdAt"
    "employeeId"
    "accountCode"
    "salaryMonth"
    "voucherCode"
    "createdByUid"
    "employeeName"
    "createdByName"
  }
  "transactionsID": text
  "account_id": text -> accounts.id
  "user_id": text -> users.id
  "amount": numeric
  "currency": text
  "month": text
  "createdAt": timestamp with time zone
  "cur_no": integer -> currency.cur_id
}
```

### `sessions`
```text
sessions {
  "id": text
  "data": jsonb {
    "id"
    "role"
    "email"
    "userId"
    "fullName"
    "lastSeen"
    "createdAt"
    "deviceInfo"
    "lastSeenAt"
    "forceLogout"
  }
  "user_id": text -> users.id
  "createdAt": timestamp with time zone
  "lastSeen": timestamp with time zone
  "forceLogout": boolean
}
```

### `settings`
```text
settings {
  "id": text
  "data": jsonb {
    "logoUrl"
    "margins"
    "fontSize"
    "showLogo"
    "paperSize"
    "showTaxId"
    "taxNumber"
    "fontFamily"
    "subtitleAr"
    "subtitleEn"
    "tableStyle"
    "showBarcode"
    "footerTextAr"
    "footerTextEn"
    "primaryColor"
    "showDateTime"
    "signature1Ar"
    "signature1En"
    "signature2Ar"
    "signature2En"
    "signature3Ar"
    "signature3En"
    "headerTitleAr"
    "headerTitleEn"
    "showSignatures"
    "gridColumns"
    "visibleMetrics"
    "config" {
      "token"
      "sender"
      "customUrl"
      "accountSid"
      "customBody"
      "instanceId"
      "customMethod"
      "customHeaders"
    }
    "enabled"
    "provider"
    "triggers" {
      "onOrderCreated"
      "onPaymentReceived"
      "onOrderStatusChanged"
    }
    "templates" {
      "onOrderCreated"
      "onPaymentReceived"
      "onOrderStatusChanged"
    }
  }
  "category": text
}
```

### `shipments`
```text
shipments {
  "id": text
  "order_id": text -> orders.id
  "tracking_number": text
  "shipping_company_id": text
  "courier_id": text
  "shipment_status": text
  "shipping_cost": numeric
  "weight": numeric
  "data": jsonb {}
  "createdAt": timestamp with time zone
  "shipping_category_id": text
  "content_category_id": text -> items_category.id
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
  "id": text
  "data": jsonb {
    "name"
    "notes"
    "phone"
    "address"
    "accountId"
    "createdAt"
    "updatedAt"
    "account_id"
    "tracking_url"
    "contact_person"
    "financialBalance"
    "trackingIDPrefix"
    "trackingID_prefix"
    "financialAccountId"
    "shippingCompanyUrl"
    "financialAccountCode"
    "shipping_company_url"
  }
  "name": text
  "shipping_company_url": text
  "trackingID_prefix": text
  "account_id": text -> accounts.id
}
```

### `sources`
```text
sources {
  "id": text
  "data": jsonb {
    "name"
    "type"
    "notes"
    "location"
    "accountId"
    "createdAt"
    "sourceUrl"
    "updatedAt"
    "account_id"
    "source_url"
    "source_name"
    "contact_info"
    "supplierType"
    "financialBalance"
    "financialAccountId"
    "financialAccountCode"
  }
  "name": text
  "type": text
  "source_url": text
  "account_id": text -> accounts.id
}
```

### `user_settings`
```text
user_settings {
  "id": text
  "userid": text -> users.id
  "data": jsonb {
    "theme"
    "userId"
    "userid"
    "fontSize"
    "language"
    "created_at"
    "visibleMetrics"
    "dashboardGridColumns"
  }
  "created_at": timestamp with time zone
}
```

### `users`
```text
users {
  "id": text
  "role": text -> roles.id
  "username": text
  "email": text
  "disabled": boolean
  "linkedType": text
  "linkedEntity": text
  "fullName": text
  "password": text
  "systemPin": text
  "isRoot": boolean
  "phone": text
  "address": text
  "createdAt": bigint
  "updatedAt": bigint
  "lastSeen": bigint
  "lastSeenAt": text
}
```

### `whatsapp_logs`
```text
whatsapp_logs {
  "id": text
  "data": jsonb {
    "phone"
    "status"
    "message"
    "orderId"
    "errorMsg"
    "createdAt"
    "eventType"
    "externalResponse"
  }
}
```
