export const LOCKED = '🔒 مقيد';

export const ACTIVE_DELIVERY_STATUSES = [
  'Shipped',
  'In Transit',
  'Out For Delivery',
  'In Local Warehouse',
  'جاري التوصيل',
  'قيد الشحن',
  'وصل المخزن',
];

export const FIXED_COURIER_COORDS = [
  { x: 28, y: 32 },
  { x: 58, y: 44 },
  { x: 39, y: 48 },
  { x: 74, y: 25 },
  { x: 15, y: 62 },
  { x: 50, y: 75 },
];

export const COURIER_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80',
];

export const DASHBOARD_ACTION_LABELS = {
  login: { ar: 'تسجيل دخول للنظام', en: 'User successfully logged in' },
  logout: { ar: 'تسجيل خروج من النظام', en: 'User logged out' },
  add_user: { ar: 'إضافة مستخدم جديد', en: 'Created new user account' },
  edit_user: { ar: 'تعديل بيانات مستخدم', en: 'Modified user profile' },
  add_order: { ar: 'تم إنشاء طلب شحن جديد', en: 'New delivery slot registered' },
  edit_order: { ar: 'تحديث بيانات الطلب', en: 'Updated order details' },
  delete_order: { ar: 'حذف طلب شحن من النظام', en: 'Deleted shipping order' },
  add_customer: { ar: 'تم تسجيل عميل جديد', en: 'Customer profile added' },
  add_courier: { ar: 'تم إضافة مندوب توصيل جديد', en: 'Registered new dispatcher' },
  add_expense: { ar: 'تسجيل مصروفات تشغيلية', en: 'Recorded operational expenses' },
  settle_custody: { ar: 'تسوية عهدة مالية للمندوب', en: 'Settled courier custody' },
} as const;
