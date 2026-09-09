# 🛒 تحليل وخطة تنفيذ ميزة "سلة القروب" (Group Basket)

> **النظام:** SwiftShip | **التاريخ:** 2026-09-07 | **النموذج:** Claude Sonnet 4.6

---

## 📌 ملخص الفكرة

ميزة تتيح لعميل رئيسي إنشاء **سلة مشتركة (قروب)**، يقوم عملاء آخرون بالانضمام إليها عبر **كود فريد**، بحيث يتم **توزيع تكاليف الشحن والمناديب** على الجميع، بينما يدفع كل عميل فرعي تكاليف منتجاته فقط، ويتحمل العميل الرئيسي وحده رسوم الشحن والمناديب والربح المشترك.

---

## 🔍 الجزء الأول: دراسة شاملة لقاعدة البيانات

---

### 1.1 الجداول الجديدة المطلوبة

#### جدول `group_baskets` — السلة الرئيسية

```sql
CREATE TABLE public.group_baskets (
  id              text PRIMARY KEY,          -- معرف السلة الفريد
  basket_code     text NOT NULL UNIQUE,      -- الكود المشترك للانضمام (مثل: GRP-X7K2M)
  host_order_id   text NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,  -- الطلب الرئيسي
  host_customer_id text NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT, -- العميل المضيف
  
  -- حالة السلة
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','locked','closed','cancelled')),
  -- open: السلة مفتوحة لقبول الانضمام
  -- locked: تم إقفال السلة وبدء المعالجة
  -- closed: تمت الفوترة المشتركة
  -- cancelled: تم إلغاؤها
  
  max_members     integer NOT NULL DEFAULT 10, -- الحد الأقصى للأعضاء
  expires_at      timestamptz,                 -- تاريخ انتهاء صلاحية الكود
  notes           text NOT NULL DEFAULT '',    -- ملاحظات
  
  -- التكاليف المشتركة المحسوبة
  shared_shipping_total numeric(18,4) NOT NULL DEFAULT 0, -- إجمالي تكلفة الشحن المشترك (SAR)
  shared_courier_total  numeric(18,4) NOT NULL DEFAULT 0, -- إجمالي تكلفة المناديب المشترك
  shared_profit_total   numeric(18,4) NOT NULL DEFAULT 0, -- إجمالي الربح المشترك
  shared_currency       text NOT NULL DEFAULT 'SAR',
  
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by_uid  text REFERENCES public.users(id) ON DELETE SET NULL,
  
  CONSTRAINT basket_code_format CHECK (basket_code ~ '^GRP-[A-Z0-9]{5,10}$')
);

-- فهارس لتحسين الأداء
CREATE UNIQUE INDEX idx_group_baskets_code ON public.group_baskets (basket_code);
CREATE INDEX idx_group_baskets_host_order ON public.group_baskets (host_order_id);
CREATE INDEX idx_group_baskets_status ON public.group_baskets (status, expires_at);
```

---

#### جدول `group_basket_members` — أعضاء السلة (الطلبات الفرعية)

```sql
CREATE TABLE public.group_basket_members (
  id              text PRIMARY KEY,
  basket_id       text NOT NULL REFERENCES public.group_baskets(id) ON DELETE CASCADE,
  member_order_id text NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  member_customer_id text NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  
  -- حالة طلب الانضمام
  join_status text NOT NULL DEFAULT 'pending'
    CHECK (join_status IN ('pending','approved','rejected')),
  -- pending: في انتظار موافقة العميل الرئيسي
  -- approved: تمت الموافقة والإضافة للسلة
  -- rejected: تم الرفض
  
  -- تكلفة المنتجات للعضو الفرعي فقط
  member_products_total numeric(18,4) NOT NULL DEFAULT 0, -- إجمالي تكلفة منتجاته
  member_insurance_fee  numeric(18,4) NOT NULL DEFAULT 0, -- تأمين منتجاته
  member_packaging_fee  numeric(18,4) NOT NULL DEFAULT 0, -- تغليف منتجاته
  member_bank_commission numeric(18,4) NOT NULL DEFAULT 0, -- عمولة البنك على منتجاته
  member_subtotal       numeric(18,4) NOT NULL DEFAULT 0, -- إجمالي ما يدفعه العضو (منتجات + توابعها)
  member_currency       text NOT NULL DEFAULT 'SAR',
  
  -- حصته من التكاليف المشتركة (محسوبة بالنسبة المئوية من إجمالي السلة)
  shared_cost_share_pct numeric(5,2) NOT NULL DEFAULT 0,  -- نسبته % من إجمالي السلة
  -- ملاحظة: التكاليف المشتركة يدفعها العميل الرئيسي فقط، هذا الحقل للتوثيق فقط
  
  join_requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at       timestamptz,
  approved_by_uid   text REFERENCES public.users(id) ON DELETE SET NULL,
  rejected_at       timestamptz,
  rejected_by_uid   text REFERENCES public.users(id) ON DELETE SET NULL,
  rejection_reason  text NOT NULL DEFAULT '',
  
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- ضمان عدم تكرار نفس الطلب في نفس السلة
  CONSTRAINT basket_member_order_unique UNIQUE (basket_id, member_order_id)
);

-- فهارس
CREATE INDEX idx_basket_members_basket ON public.group_basket_members (basket_id, join_status);
CREATE INDEX idx_basket_members_order ON public.group_basket_members (member_order_id);
CREATE INDEX idx_basket_members_customer ON public.group_basket_members (member_customer_id, join_status);
```

---

#### حقول جديدة في جدول `orders` الحالي

```sql
-- إضافة حقول سلة القروب لجدول الطلبات الموجود
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_group_basket_host    boolean NOT NULL DEFAULT false,
  -- هل هذا الطلب هو الطلب الرئيسي (المضيف) لسلة قروب؟
  
  ADD COLUMN IF NOT EXISTS is_group_basket_member  boolean NOT NULL DEFAULT false,
  -- هل هذا الطلب عضو فرعي في سلة قروب؟
  
  ADD COLUMN IF NOT EXISTS group_basket_id         text REFERENCES public.group_baskets(id) ON DELETE SET NULL,
  -- معرف السلة المرتبطة (للطلب الرئيسي والفرعي)
  
  ADD COLUMN IF NOT EXISTS group_basket_member_id  text REFERENCES public.group_basket_members(id) ON DELETE SET NULL;
  -- معرف سجل العضوية الفرعية (للطلبات الفرعية فقط)
```

---

### 1.2 القيود والأحداث (Constraints & Triggers)

```sql
-- قيد: الطلب لا يمكن أن يكون مضيفاً وعضواً في نفس الوقت
ALTER TABLE public.orders
  ADD CONSTRAINT chk_order_basket_role
  CHECK (NOT (is_group_basket_host = true AND is_group_basket_member = true));

-- قيد: السلة لا تقبل أعضاء جدد إذا كانت مقفلة أو مغلقة
CREATE OR REPLACE FUNCTION public.validate_basket_member_join()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  basket_rec public.group_baskets%ROWTYPE;
  member_count integer;
BEGIN
  -- التحقق من حالة السلة
  SELECT * INTO basket_rec FROM public.group_baskets WHERE id = NEW.basket_id;
  IF basket_rec.status NOT IN ('open') THEN
    RAISE EXCEPTION 'لا يمكن الانضمام إلى سلة مقفلة أو مغلقة.';
  END IF;
  -- التحقق من انتهاء صلاحية الكود
  IF basket_rec.expires_at IS NOT NULL AND basket_rec.expires_at < now() THEN
    RAISE EXCEPTION 'انتهت صلاحية كود سلة القروب.';
  END IF;
  -- التحقق من الحد الأقصى للأعضاء
  SELECT COUNT(*) INTO member_count 
  FROM public.group_basket_members 
  WHERE basket_id = NEW.basket_id AND join_status = 'approved';
  IF member_count >= basket_rec.max_members THEN
    RAISE EXCEPTION 'وصلت السلة للحد الأقصى من الأعضاء.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_basket_member_join
BEFORE INSERT ON public.group_basket_members
FOR EACH ROW EXECUTE FUNCTION public.validate_basket_member_join();

-- تحديث updated_at تلقائياً
CREATE TRIGGER trg_group_baskets_updated_at
BEFORE UPDATE ON public.group_baskets
FOR EACH ROW EXECUTE FUNCTION public.financial_entry_set_updated_at();

CREATE TRIGGER trg_basket_members_updated_at
BEFORE UPDATE ON public.group_basket_members
FOR EACH ROW EXECUTE FUNCTION public.financial_entry_set_updated_at();
```

---

### 1.3 الدوال المساعدة (RPC Functions)

```sql
-- دالة: إنشاء سلة قروب جديدة وإرجاع الكود الفريد
CREATE OR REPLACE FUNCTION public.create_group_basket(
  p_host_order_id text,
  p_host_customer_id text,
  p_max_members integer DEFAULT 10,
  p_expires_hours integer DEFAULT 48,
  p_created_by text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_basket_id text;
  v_basket_code text;
  v_result jsonb;
BEGIN
  -- توليد كود فريد
  LOOP
    v_basket_code := 'GRP-' || UPPER(SUBSTRING(MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text) FROM 1 FOR 7));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.group_baskets WHERE basket_code = v_basket_code);
  END LOOP;
  
  v_basket_id := 'basket_' || REPLACE(gen_random_uuid()::text, '-', '');
  
  -- إنشاء السلة
  INSERT INTO public.group_baskets (
    id, basket_code, host_order_id, host_customer_id,
    max_members, expires_at, created_by_uid
  ) VALUES (
    v_basket_id, v_basket_code, p_host_order_id, p_host_customer_id,
    p_max_members,
    CASE WHEN p_expires_hours > 0 THEN now() + (p_expires_hours || ' hours')::interval ELSE NULL END,
    p_created_by
  );
  
  -- تحديث الطلب الرئيسي
  UPDATE public.orders
  SET is_group_basket_host = true, group_basket_id = v_basket_id
  WHERE id = p_host_order_id;
  
  RETURN jsonb_build_object('basket_id', v_basket_id, 'basket_code', v_basket_code);
END;
$$;

-- دالة: إرسال طلب انضمام لسلة قروب
CREATE OR REPLACE FUNCTION public.join_group_basket(
  p_basket_code text,
  p_member_order_id text,
  p_member_customer_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_basket_rec public.group_baskets%ROWTYPE;
  v_member_id text;
BEGIN
  SELECT * INTO v_basket_rec FROM public.group_baskets WHERE basket_code = p_basket_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'كود السلة غير صحيح.');
  END IF;
  
  -- التحقق من عدم وجود انضمام سابق
  IF EXISTS (SELECT 1 FROM public.group_basket_members 
             WHERE basket_id = v_basket_rec.id AND member_order_id = p_member_order_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'تم إرسال طلب الانضمام مسبقاً.');
  END IF;
  
  v_member_id := 'bmember_' || REPLACE(gen_random_uuid()::text, '-', '');
  
  INSERT INTO public.group_basket_members (
    id, basket_id, member_order_id, member_customer_id
  ) VALUES (v_member_id, v_basket_rec.id, p_member_order_id, p_member_customer_id);
  
  -- تحديث الطلب الفرعي
  UPDATE public.orders
  SET is_group_basket_member = true,
      group_basket_id = v_basket_rec.id,
      group_basket_member_id = v_member_id
  WHERE id = p_member_order_id;
  
  RETURN jsonb_build_object('success', true, 'basket_id', v_basket_rec.id, 'member_id', v_member_id);
END;
$$;

-- دالة: الموافقة أو رفض طلب انضمام (من العميل الرئيسي أو الموظف)
CREATE OR REPLACE FUNCTION public.process_basket_join_request(
  p_member_id text,
  p_action text,            -- 'approve' أو 'reject'
  p_processed_by text,
  p_rejection_reason text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_action = 'approve' THEN
    UPDATE public.group_basket_members
    SET join_status = 'approved', approved_at = now(), approved_by_uid = p_processed_by
    WHERE id = p_member_id AND join_status = 'pending';
  ELSIF p_action = 'reject' THEN
    UPDATE public.group_basket_members
    SET join_status = 'rejected', rejected_at = now(), 
        rejected_by_uid = p_processed_by, rejection_reason = p_rejection_reason
    WHERE id = p_member_id AND join_status = 'pending';
    -- إلغاء ارتباط الطلب الفرعي بالسلة عند الرفض
    UPDATE public.orders SET
      is_group_basket_member = false, group_basket_id = NULL, group_basket_member_id = NULL
    WHERE group_basket_member_id = p_member_id;
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
```

---

### 1.4 سياسات الأمان (RLS Policies)

```sql
-- تفعيل RLS
ALTER TABLE public.group_baskets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_basket_members ENABLE ROW LEVEL SECURITY;

-- السماح للموظفين بقراءة وإدارة كل السلال
CREATE POLICY "staff_full_access_baskets" ON public.group_baskets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "staff_full_access_basket_members" ON public.group_basket_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- العملاء عبر البوابة: يرون فقط سلالهم
-- (يُضاف في ملف سياسات portal_users المنفصل)
```

---

## 🖥️ الجزء الثاني: تحليل النظام الداخلي للموظفين

---

### 2.1 التغييرات على واجهة إنشاء الطلب (CreateOrderModal)

**الموقع:** الخطوة 3 "الشحن والمناديب" — يُضاف قسم "سلة القروب" في أعلى أو أسفل الخطوة

```
📦 قسم سلة القروب
┌─────────────────────────────────────────────────┐
│  ⚠️ هل تريد إضافة هذا الطلب لسلة مشتركة؟       │
│                                                  │
│  [زر: 🛒 إنشاء سلة قروب جديدة]                 │
│                  أو                              │
│  [زر: 🔗 الانضمام لسلة قروب موجودة]             │
└─────────────────────────────────────────────────┘
```

**عند الضغط على "إنشاء سلة قروب":**
```
┌──────────────────────────────────────────────────────┐
│  🟢 تم إنشاء سلة قروب جديدة بنجاح!                 │
│  ┌──────────────────────────────────────────────┐    │
│  │  كود السلة:  GRP-X7K2M    [📋 نسخ]          │    │
│  │  تنتهي في:   48 ساعة                         │    │
│  └──────────────────────────────────────────────┘    │
│  📤 أرسل هذا الكود للعملاء الراغبين بالانضمام      │
└──────────────────────────────────────────────────────┘
```

**عند الضغط على "الانضمام لسلة قروب":**
```
┌──────────────────────────────────────────────────────┐
│  أدخل كود السلة المشتركة:                            │
│  [      GRP-XXXXX      ]  [🔗 إرسال طلب الانضمام]  │
│                                                      │
│  ✅ تم إرسال طلب الانضمام! في انتظار الموافقة       │
└──────────────────────────────────────────────────────┘
```

---

### 2.2 تبويبة العميل الرئيسي في نافذة تفاصيل الطلب (OrderDetailsModal)

**التبويبات الجديدة في OrderDetailsModal عندما يكون الطلب مضيفاً لسلة:**

```
┌──────────────────────────────────────────────────────┐
│  [ 📋 تفاصيل الطلب ] [ 🛒 سلة القروب 🔴 3 ]         │
│                                                      │
│  كود السلة: GRP-X7K2M  |  الحالة: مفتوحة           │
│  ┌────────────────────────────────────────────────┐  │
│  │  📨 طلبات الانضمام المعلقة (2)               │  │
│  │  ┌──────────────────────────────────────────┐ │  │
│  │  │ 👤 أحمد علي  |  منتجات: 3  |  320 SAR   │ │  │
│  │  │ [✅ موافقة] [❌ رفض]                     │ │  │
│  │  └──────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────┐ │  │
│  │  │ 👤 سعد محمد  |  منتجات: 5  |  580 SAR   │ │  │
│  │  │ [✅ موافقة] [❌ رفض]                     │ │  │
│  │  └──────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │  ✅ الطلبات المضافة للسلة (1)                │  │
│  │  ┌──────────────────────────────────────────┐ │  │
│  │  │ 👤 محمد أحمد | منتجات: 2 | 210 SAR      │ │  │
│  │  │ رقم الطلب: SW-10045  [🔗 فتح الطلب]     │ │  │
│  │  └──────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

### 2.3 منطق الحساب المالي (Business Logic)

**تصنيف التكاليف:**

| نوع التكلفة | من يدفع؟ |
|---|---|
| 💰 ثمن المنتجات | كل عميل يدفع منتجاته |
| 🛡️ تأمين المنتج (insurance_fee) | كل عميل يدفع تأمين منتجاته |
| 📦 تغليف مخصص (packaging_fee) | كل عميل يدفع تغليف منتجاته |
| 🏦 عمولة البنك (bank_commission) | كل عميل يدفع عمولة بنكه |
| 🚚 رسوم الشحن (shipping_cost) | العميل الرئيسي فقط |
| 🛵 عمولة المندوب | العميل الرئيسي فقط |
| 💹 ربح الشركة (profit) | العميل الرئيسي فقط |
| 📦 رسوم تغليف شركة الشحن | العميل الرئيسي فقط |

**معادلات الحساب:**

```typescript
// العميل الفرعي يدفع:
member_subtotal = 
  (member_products_total)         // ثمن المنتجات
  + (member_insurance_fee)         // تأمين منتجاته
  + (member_packaging_fee)         // تغليف منتجاته
  + (member_bank_commission)       // عمولة بنكه

// العميل الرئيسي يدفع:
host_total = 
  (host_own_products_total)        // منتجاته الخاصة
  + (host_insurance_fee)
  + (host_packaging_fee)
  + (shared_shipping_total)        // الشحن الكلي
  + (shared_courier_total)         // المناديب الكلي
  + (shared_profit_total)          // الربح المشترك
  + (shared_packaging_company_fee) // تغليف شركة الشحن
  - (host_coupon_discount)         // خصمه الخاص إن وجد

// الفاتورة الموحدة:
unified_invoice_total = host_total + SUM(all_members_subtotals)
```

---

### 2.4 الخدمات والدوال المطلوبة (TypeScript Services)

#### ملف: `src/services/groupBasketService.ts` (جديد)

```typescript
// ==== خدمة سلة القروب ====
// Group Basket Service

export interface GroupBasket {
  id: string;
  basket_code: string;
  host_order_id: string;
  host_customer_id: string;
  status: 'open' | 'locked' | 'closed' | 'cancelled';
  max_members: number;
  expires_at: string | null;
  shared_shipping_total: number;
  shared_courier_total: number;
  shared_profit_total: number;
  shared_currency: string;
  created_at: string;
}

export interface BasketMember {
  id: string;
  basket_id: string;
  member_order_id: string;
  member_customer_id: string;
  join_status: 'pending' | 'approved' | 'rejected';
  member_subtotal: number;
  member_products_total: number;
  member_insurance_fee: number;
  member_packaging_fee: number;
  member_bank_commission: number;
  member_currency: string;
  join_requested_at: string;
  approved_at: string | null;
}

// دالة: إنشاء سلة قروب جديدة
export async function create_group_basket(
  host_order_id: string,
  host_customer_id: string,
  options?: { max_members?: number; expires_hours?: number }
): Promise<{ basket_id: string; basket_code: string }>;

// دالة: الانضمام لسلة قروب
export async function join_group_basket(
  basket_code: string,
  member_order_id: string,
  member_customer_id: string
): Promise<{ success: boolean; error?: string }>;

// دالة: الموافقة على طلب انضمام
export async function approve_basket_member(member_id: string): Promise<void>;

// دالة: رفض طلب انضمام
export async function reject_basket_member(member_id: string, reason?: string): Promise<void>;

// دالة: جلب تفاصيل سلة بكودها
export async function get_basket_by_code(basket_code: string): Promise<GroupBasket | null>;

// دالة: جلب أعضاء السلة مع تفاصيلهم وطلباتهم
export async function get_basket_members(basket_id: string): Promise<BasketMember[]>;

// دالة: قفل السلة (إيقاف قبول أعضاء جدد)
export async function lock_group_basket(basket_id: string): Promise<void>;

// دالة: توليد الفاتورة الموحدة
export async function generate_unified_basket_invoice(basket_id: string): Promise<UnifiedInvoice>;

// دالة: حساب نسبة كل عضو من التكاليف المشتركة
export function calculate_member_cost_shares(
  members: BasketMember[],
  shared_total: number
): Record<string, number>;
```

---

### 2.5 مكون التبويبة في واجهة الطلب: `GroupBasketTab.tsx` (جديد)

**العناصر المطلوبة:**

```typescript
interface GroupBasketTabProps {
  order_id: string;
  is_host: boolean;       // هل الطلب مضيف؟
  is_member: boolean;     // هل الطلب عضو؟
  basket_id: string | null;
  isAr: boolean;
}

// المكون يعرض:
// 1. كود السلة مع زر النسخ
// 2. حالة السلة (مفتوحة/مقفلة/مغلقة)
// 3. قائمة طلبات الانضمام المعلقة (pending)
//    - لكل طلب: اسم العميل، رقم الطلب، عدد المنتجات، المبلغ
//    - زر الموافقة وزر الرفض
// 4. قائمة الطلبات المضافة (approved)
//    - لكل طلب: اسم العميل، رقم الطلب، المبلغ، رابط الطلب
// 5. ملخص التكاليف المشتركة
// 6. زر قفل السلة / إغلاقها
```

---

### 2.6 التغييرات في `CreateOrderModal.tsx`

**الخطوة 3 — إضافة قسم "سلة القروب":**

```typescript
// Props جديدة مطلوبة في CreateOrderModalProps:
group_basket_mode: 'none' | 'create' | 'join';  // وضع السلة
setGroupBasketMode: (mode: 'none' | 'create' | 'join') => void;
group_basket_join_code: string;       // كود الانضمام
setGroupBasketJoinCode: (code: string) => void;
group_basket_result: { basket_id: string; basket_code: string } | null;
```

---

### 2.7 التغييرات في `OrderDetailsModal.tsx`

- إضافة تبويب "سلة القروب 🛒" يظهر فقط إذا `order.is_group_basket_host === true`
- داخل التبويب: مكون `GroupBasketTab`

---

### 2.8 التغييرات في صفحة `Orders.tsx` / `CreateOrder hook`

```typescript
// حالات جديدة:
const [group_basket_mode, setGroupBasketMode] = useState<'none'|'create'|'join'>('none');
const [group_basket_join_code, setGroupBasketJoinCode] = useState('');
const [group_basket_result, setGroupBasketResult] = useState(null);

// بعد إنشاء الطلب الرئيسي بنجاح:
// إذا group_basket_mode === 'create':
//   يتم استدعاء create_group_basket(orderId, customerId)
//   يتم عرض كود السلة للموظف

// بعد إنشاء الطلب الفرعي:
// إذا group_basket_mode === 'join':
//   يتم استدعاء join_group_basket(group_basket_join_code, orderId, customerId)
```

---

## 🌐 الجزء الثالث: تحليل موقع العملاء (Customer Portal)

---

### 3.1 واجهة إنشاء الطلب في الموقع

**إضافة قسم "سلة القروب" في خطوة الشحن:**

```html
<!-- قسم سلة القروب في نموذج الطلب -->
<div class="group-basket-section">
  <h3>🛒 سلة القروب (الشحن المشترك)</h3>
  <p>وفّر على رسوم الشحن بالاشتراك مع أصدقائك!</p>
  
  <div class="basket-options">
    <!-- خيار 1: إنشاء سلة -->
    <button id="btn-create-basket">
      🟢 إنشاء سلة قروب جديدة
      <span>أنت المضيف، شارك الكود مع أصدقائك</span>
    </button>
    
    <!-- خيار 2: الانضمام -->
    <button id="btn-join-basket">
      🔗 الانضمام لسلة موجودة
      <span>أدخل كود السلة للانضمام</span>
    </button>
  </div>
  
  <!-- نموذج الانضمام (يظهر عند الضغط على "الانضمام") -->
  <div id="join-basket-form" class="hidden">
    <input type="text" placeholder="GRP-XXXXX" id="basket-code-input" />
    <button id="btn-send-join-request">إرسال طلب الانضمام</button>
  </div>
</div>
```

---

### 3.2 لوحة إدارة السلة للعميل الرئيسي في الموقع

**صفحة: `/my-orders/[orderId]/basket`**

```
📱 لوحة سلة القروب — العميل الرئيسي

╔══════════════════════════════════════════════════════╗
║  🛒 سلة القروب الخاصة بطلبك #SW-10042              ║
║  الكود: GRP-X7K2M  [📋 نسخ] [📤 مشاركة واتساب]   ║
║  الحالة: ● مفتوحة — تنتهي بعد 24 ساعة              ║
╚══════════════════════════════════════════════════════╝

📨 طلبات الانضمام (2)
┌─────────────────────────────────────────────────────┐
│ 👤 أحمد علي                                         │
│ المنتجات: 3 منتجات | الإجمالي: 320 ريال            │
│ [عرض التفاصيل ▼]                                   │
│ [✅ قبول الانضمام] [❌ رفض]                         │
├─────────────────────────────────────────────────────┤
│ 👤 سعد محمد                                         │
│ المنتجات: 5 منتجات | الإجمالي: 580 ريال            │
│ [✅ قبول] [❌ رفض]                                  │
└─────────────────────────────────────────────────────┘

✅ الأعضاء المعتمدون (1)
┌─────────────────────────────────────────────────────┐
│ 👤 محمد أحمد — طلب: #SW-10045                      │
│ 2 منتجات | 210 ريال                                 │
└─────────────────────────────────────────────────────┘

💰 ملخص تكاليف السلة الإجمالية
┌─────────────────────────────────────────────────────┐
│ إجمالي منتجاتك:          450 SAR                   │
│ تكاليف الشحن المشتركة:   320 SAR (مقسمة عليك)      │
│ تكاليف المناديب:         120 SAR                   │
│ ربح الشركة:              90 SAR                    │
│ ─────────────────────────────────────────────────── │
│ إجمالي ما تدفعه:         980 SAR                   │
│ + أعضاء السلة يدفعون منتجاتهم منفصلة              │
└─────────────────────────────────────────────────────┘
```

---

### 3.3 واجهة العميل الفرعي في الموقع (بعد إرسال طلب الانضمام)

```
📱 حالة انضمامك لسلة القروب

╔══════════════════════════════════════════════════════╗
║  ⏳ في انتظار موافقة مضيف السلة                     ║
║  الكود المُرسل: GRP-X7K2M                           ║
║  طلبك: #SW-10047                                    ║
╚══════════════════════════════════════════════════════╝

ستتلقى إشعاراً فور الرد على طلب انضمامك.

✅ عند الموافقة: ستدفع فقط منتجاتك (بدون رسوم شحن!)
❌ عند الرفض: سيُعامَل طلبك بشكل منفصل
```

---

### 3.4 نظام الإشعارات المطلوب

| الحدث | المستلم | نوع الإشعار |
|---|---|---|
| عميل فرعي أرسل طلب انضمام | العميل الرئيسي | تنبيه في التطبيق + واتساب |
| موافقة على الانضمام | العميل الفرعي | تنبيه في التطبيق |
| رفض الانضمام | العميل الفرعي | تنبيه + سبب الرفض |
| اقتراب انتهاء صلاحية كود السلة | العميل الرئيسي | تنبيه تذكيري |
| قفل السلة | جميع الأعضاء | إشعار تأكيدي |

---

## 📊 الجزء الرابع: منطق الفاتورة الموحدة

---

### 4.1 هيكل الفاتورة الموحدة

```
═══════════════════════════════════════════════════════
       فاتورة سلة القروب الموحدة #GRP-X7K2M
═══════════════════════════════════════════════════════
العميل الرئيسي: أحمد أبو عمر        طلب: #SW-10042
التاريخ: 2026-09-07
───────────────────────────────────────────────────────
📦 منتجات الطلب الرئيسي:
  • منتج A × 2 = 200 SAR
  • منتج B × 1 = 150 SAR
  ─ إجمالي المنتجات: 350 SAR
  ─ تأمين: 20 SAR
  ─ تغليف: 15 SAR
───────────────────────────────────────────────────────
👥 طلبات الأعضاء الفرعيين (توثيقية فقط):
  ─ محمد أحمد (طلب #SW-10045): 210 SAR منتجاته
  ─ سعد علي  (طلب #SW-10048): 180 SAR منتجاته
───────────────────────────────────────────────────────
🚚 التكاليف المشتركة (يدفعها المضيف):
  ─ شحن دولي: 280 SAR
  ─ مندوب التوصيل: 80 SAR
  ─ ربح الشركة: 120 SAR
  ─ تغليف شركة الشحن: 30 SAR
───────────────────────────────────────────────────────
💰 إجمالي ما يدفعه العميل الرئيسي: 895 SAR
   (منتجاته + التكاليف المشتركة الكاملة)

💰 إجمالي ما يدفعه محمد أحمد: 210 SAR
💰 إجمالي ما يدفعه سعد علي: 180 SAR
═══════════════════════════════════════════════════════
```

---

## 🗓️ الجزء الخامس: خطة التنفيذ المرحلية

---

### المرحلة 1: قاعدة البيانات (الأولوية القصوى)

**الملفات:** ملف migration جديد: `202609080001_create_group_basket_system.sql`

- [ ] إنشاء جدول `group_baskets`
- [ ] إنشاء جدول `group_basket_members`
- [ ] إضافة حقول سلة القروب لجدول `orders`
- [ ] إنشاء Triggers للتحقق والتحديث التلقائي
- [ ] إنشاء RPCs: `create_group_basket`, `join_group_basket`, `process_basket_join_request`
- [ ] إنشاء فهارس لتحسين الأداء
- [ ] إعداد سياسات RLS

---

### المرحلة 2: خدمات TypeScript (Backend Layer)

**الملفات الجديدة:**
- `src/services/groupBasketService.ts` — الخدمات الأساسية
- `src/services/groupBasketCalculations.ts` — حسابات التوزيع المالي
- `src/hooks/useGroupBasket.ts` — Hook للحالة والبيانات

---

### المرحلة 3: واجهات النظام الداخلي

**الملفات المعدّلة:**
- `src/components/orders/CreateOrderModal.tsx` — إضافة قسم سلة القروب في Step 3
- `src/components/orders/OrderDetailsModal.tsx` — إضافة تبويب سلة القروب
- `src/pages/Orders.tsx` — إضافة state وربط الدوال

**الملفات الجديدة:**
- `src/components/orders/GroupBasketTab.tsx` — تبويبة إدارة السلة
- `src/components/orders/GroupBasketCreateSection.tsx` — قسم إنشاء/انضمام
- `src/components/orders/GroupBasketJoinModal.tsx` — نافذة إدخال كود الانضمام

---

### المرحلة 4: واجهات الموقع الإلكتروني للعملاء

**الملفات الجديدة (في مشروع الموقع):**
- `pages/my-orders/[id]/basket.tsx` — صفحة إدارة سلة قروب للعميل الرئيسي
- `components/portal/GroupBasketCreateSection.tsx` — قسم الإنشاء في نموذج الطلب
- `components/portal/GroupBasketJoinSection.tsx` — قسم الانضمام
- `components/portal/BasketMemberCard.tsx` — بطاقة عضو السلة
- `components/portal/GroupBasketStatus.tsx` — عرض حالة الانضمام للعميل الفرعي

---

### المرحلة 5: نظام الإشعارات والتوثيق

- ربط إشعارات الانضمام بجدول `notifications`
- إضافة إشعارات واتساب عند الموافقة/الرفض
- تسجيل الأحداث في `orders_history`

---

## ❓ أسئلة مفتوحة تحتاج توضيح

> [!IMPORTANT]
> **السؤال 1:** هل يمكن للعميل الفرعي الانضمام من الموقع فقط، أم أيضاً يمكن للموظف إضافته يدوياً من النظام؟

> [!IMPORTANT]
> **السؤال 2:** عند موافقة العميل الرئيسي على انضمام عميل فرعي — هل تُنشأ فاتورة موحدة فوراً أم تبقى الطلبات منفصلة حتى يتم إقفال السلة يدوياً؟

> [!IMPORTANT]
> **السؤال 3:** هل عمولة البنك تُحسب على المنتجات فقط أم على إجمالي ما يدفعه العميل الفرعي؟

> [!WARNING]
> **السؤال 4:** ماذا يحدث إذا أراد العميل الفرعي إلغاء طلبه بعد الموافقة عليه؟ هل يتأثر الطلب الرئيسي؟

> [!IMPORTANT]
> **السؤال 5:** هل يمكن للعميل الرئيسي أن يكون أيضاً عضواً في سلة قروب أخرى بطلب مختلف؟

> [!IMPORTANT]
> **السؤال 6:** حد أقصى للأعضاء في السلة — هل هو قابل للتخصيص من الإعدادات؟

> [!WARNING]
> **السؤال 7:** هل يحتاج الموقع مشروع منفصل (Next.js) أم يُضاف لنفس مشروع React الحالي (src/pages)؟

---

## 🔐 اعتبارات الأمان

- التحقق من هوية العميل الرئيسي قبل قبول/رفض الانضمام (في API)
- التحقق من ملكية الطلب الفرعي للعميل قبل إرسال طلب الانضمام
- منع انضمام طلب واحد في أكثر من سلة في نفس الوقت
- انتهاء صلاحية كود السلة بعد مدة قابلة للضبط (افتراضي: 48 ساعة)
- تشفير الكود بدرجة كافية من الإنتروبيا لمنع التخمين

---

## 📝 ملاحظة للتوثيق

سيتم عند موافقة الخطة:
1. توثيق كل قاعدة بيانات في `DBdevloping_history.md`
2. تتبع التقدم في `todo.md`
3. توثيق التغييرات في `devloping_history.md`
