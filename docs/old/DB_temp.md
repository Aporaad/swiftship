
### 30. `order_items`
```text
powershell {
  openssl genpkey -algorithm Ed25519 -out .secrets\jwt-private.pem
  openssl pkey -in .secrets\jwt-private.pem -pubout -out .secrets\jwt-public.pem
  $privateKey = (Get-Content .secrets\jwt-private.pem -Raw).Trim() -replace "`r?`n", "\n"
  $publicKey  = (Get-Content .secrets\jwt-public.pem -Raw).Trim() -replace "`r?`n", "\n"
  "JWT_PRIVATE_KEY_PEM=$privateKey" | Add-Content .env
  "JWT_PUBLIC_KEY_PEM=$publicKey" | Add-Content .env
  Remove-Variable privateKey, publicKey
  $securePassword = Read-Host "Dummy password" -AsSecureString

  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try {
      $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
      $env:DUMMY_PASSWORD = $plainPassword

      node --input-type=module -e "import { hash, argon2id } from 'argon2'; console.log(await hash(process.env.DUMMY_PASSWORD, { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1, hashLength: 32 }))"
  }
  finally {
      if ($ptr -ne [IntPtr]::Zero) {
          [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
      }
      Remove-Item Env:DUMMY_PASSWORD -ErrorAction SilentlyContinue
      Remove-Variable plainPassword, securePassword -ErrorAction SilentlyContinue
  }

Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/v1/health/live" -Method GET -TimeoutSec 5

  Invoke-WebRequest -Uri "http://127.0.0.1:3001/api/v1/health/ready" -UseBasicParsing | Select-Object -ExpandProperty Content


  $body = '{"identifier":"admin","password":"swiftship@system_pw_2026"}'; $response = Invoke-WebRequest -Uri "http://127.0.0.1:3001/api/v1/auth/login" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing; $response.Content
}
```
### 30. `order_items`
```text
order_items {
  order_item_id: text                            -- PK
  order_id: text -> orders.order_id             -- FK للطلب
  product_id: text -> products.product_id       -- FK للمنتج
  shipment_id: text -> shipments.shipment_id    -- FK للشحنة (مضاف migration 20261002023000)
  product_price: numeric
  product_url: text
  tracking_number: text
  produc_source_id: text
  produc_source_url: text
  product_color: text                            -- (كان product_cooler — أعيدت التسمية في migration)
  nota: text
  product_name: text                             -- (مضاف migration 20261002023000)
  sku: text                                      -- (مضاف migration 20261002023000)
  internal_note: text                            -- (مضاف migration 20261002023000)
  customer_note: text                            -- (مضاف migration 20261002023000)
  quantity: integer
  total_price: numeric
  total__weight: numeric
  unit__weight: numeric                          -- (مضاف migration 20261002023000)
  total_cbm: numeric
  unit_cbm: numeric                              -- (مضاف migration 20261002023000)
  total_packaging_price: numeric                 -- (مضاف migration 20261002023000)
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
  external_order_number 

  customer_id: text -> customers.customer_id
  courier_id: text -> couriers.courier_id
  delivery_courier_id: text -> couriers.courier_id
  shipping_courier_id: text -> couriers.courier_id
  employee_id: text -> employees.employee_id
  order_party_id: text
  order_party_type: text
  is_staff_order: boolean
  order_party_account_id: text -> accounts.account_id

  order_source_id: text -> sources.source_id
  order_source_type: text
  order_status_id: text -> order_status.order_status_id

  currency:integer -> currency.cur_id
  order_currency: integer -> currency.cur_id
  order_currency_price: integer -> cur_price.cur_price_id


  created_at: timestamp with time zone
  created_by: text
  updated_at: timestamp with time zone
  updated_by: text
  created_by_name: text

  tracking_number: text
  order_source_type: text
}
```
التخلص من اسماء العملات  في الحقول مثل totalCostSAR و totalCostYER و shippingCostSAR
### 33. `orders`
```text
order_bill {
  order_bill_id: text
  order_id: text ->orders.order_id

subtotal
discount_total
shipping_total
tax_total
insurance_total
packaging_total
grand_total
-------
-- مندوب الشحن
    viaShippingAgent
    shippingCourierFeeRate    
    profitSaudiSAR

-- مندوب التوصيل 
    homeDeliveryEnabled
    deliveryCourierFee
    deliveryCourierFeeCurrency
    deliveryCourierFeeOrderCurrency

--  عموله البنك 
    bankCommissionEnabled
    bankCommissionRate
    bankCommissionType  

-- الكوبون
    couponEnabled
    companyProfitRate
    couponRate
    couponValue
 
    cbmShippingRateValue

--الشحن
    addShippingEnabled
    shippingCostSAR
    totalCBM
    totalWeight  
-- الدفع 
    payLater
    paymentStatus
    amountPaid
    amountRemaining

-- التغليف 
    packagingFee
    packagingFeeEnabled
    packagingFeeRate  

-----    التكاليف 
    profitCompanySAR
    profitPerKgRate
    sheinRedPrice
    deductSourcingCostFromCourier
    totalCostSAR
    totalCostYER

-- المنتجات     
    productsSum
    product_insurance_fee 

-- المصدر 
    sourcing_cost
    sourcingCostAmount
   
--
   deliveryStatus
    directApprove
    firedTriggers    
    internalNotes
    locationYemen
  -- del 
  shippingCompany
  cartShareCode
  paidCurrency
  paymentMethod
  ---
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
