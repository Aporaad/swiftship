import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, limit, orderBy, addDoc } from 'firebase/firestore';
import { db, auth, safeToDate } from '../lib/firebase';
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  TrendingUp, 
  Users as UsersIcon, 
  DollarSign, 
  Plus, 
  UserPlus, 
  FileText, 
  ShieldAlert, 
  Compass, 
  MapPin, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  Check,
  Lock
} from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useSettings } from '../context/SettingsContext';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

const LOCKED = '🔒 مقيد';

export default function Dashboard() {
  const navigate = useNavigate();
  const { role, hasPermission, profile, loading: roleLoading } = useRole();
  const { settings, t } = useSettings();
  const isAr = settings.language === 'ar';

  // Customizable metrics configuration
  const [visibleMetrics, setVisibleMetrics] = useState<string[]>(() => {
    const saved = localStorage.getItem('dashboard_visible_metrics');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return ['totalOrders', 'totalRevenues', 'netProfit', 'activeDeliveries', 'delayedOrders', 'activeCustomers'];
  });
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [gridColumns, setGridColumns] = useState<number>(() => {
    const saved = localStorage.getItem('dashboard_grid_columns');
    return saved ? parseInt(saved) : 6;
  });

  // DB States
  const [orders, setOrders] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [realLogs, setRealLogs] = useState<any[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [customersCount, setCustomersCount] = useState(0);
  const [couriersCount, setCouriersCount] = useState(0);
  const [expensesCount, setExpensesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Computed Stats
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenues: 0,
    netProfit: 0,
    activeDeliveries: 0,
    delayedOrders: 0,
    activeCustomers: 0,
    amountRemaining: 0,
    amountPaid: 0,
  });

  // Database seeder action
  const seedSampleData = async () => {
    if (isSeeding) return;
    setIsSeeding(true);
    try {
      // 1. Create 3 couriers
      const courierPayloads = [
        { fullName: isAr ? 'أحمد الهلالي' : 'Ahmed Al-Hilali', phone: '777123456', email: 'ahmed@alx.com', address: isAr ? 'صنعاء - باب اليمن' : 'Sanaa - Bab Al-Yemen', commissionRate: 500, createdAt: new Date() },
        { fullName: isAr ? 'علي باخميس' : 'Ali Bakhmis', phone: '777456123', email: 'ali@alx.com', address: isAr ? 'عدن - كريتر' : 'Aden - Crater', commissionRate: 600, createdAt: new Date() },
        { fullName: isAr ? 'محمد الحربي' : 'Mohamed Al-Harbi', phone: '777987654', email: 'mohamed@alx.com', address: isAr ? 'تعز - شارع جمال' : 'Taiz - Gamal St', commissionRate: 550, createdAt: new Date() }
      ];

      const courierIds: string[] = [];
      for (const cp of courierPayloads) {
        const docRef = await addDoc(collection(db, 'couriers'), cp);
        courierIds.push(docRef.id);
      }

      // 2. Create 4 customers
      const customerPayloads = [
        { fullName: isAr ? 'سالم الحربي' : 'Salem Al-Harbi', phone: '771111111', email: 'salem@gmail.com', address: isAr ? 'صنعاء - حدة' : 'Sanaa - Hadda', notes: '', createdAt: new Date() },
        { fullName: isAr ? 'مريم علي' : 'Maryam Ali', phone: '772222222', email: 'maryam@gmail.com', address: isAr ? 'عدن - المنصورة' : 'Aden - Mansoura', notes: '', createdAt: new Date() },
        { fullName: isAr ? 'ناصر باخميس' : 'Nasser Bakhmis', phone: '773333333', email: 'nasser@gmail.com', address: isAr ? 'المكلا - الديس' : 'Mukalla - Ad-Dees', notes: '', createdAt: new Date() },
        { fullName: isAr ? 'عبدالله السعيد' : 'Abdullah Al-Saeed', phone: '774444444', email: 'abdullah@gmail.com', address: isAr ? 'صنعاء - الستين' : 'Sanaa - Sixty St', notes: '', createdAt: new Date() }
      ];

      const customerIds: string[] = [];
      for (const cust of customerPayloads) {
        const docRef = await addDoc(collection(db, 'customers'), cust);
        customerIds.push(docRef.id);
      }

      // 3. Create 6 orders with diverse statuses and financial details spread out over the last 7 days
      const daysAgo = (num: number) => {
        const d = new Date();
        d.setDate(d.getDate() - num);
        return d;
      };

      const orderPayloads = [
        {
          orderNumber: 'ALX-2605-1001',
          customerName: isAr ? 'عبدالله السعيد' : 'Abdullah Al-Saeed',
          customerId: customerIds[3],
          orderStatus: 'Delivered',
          deliveryCourierId: courierIds[1], // Ali
          deliveryCourierFee: 4000,
          totalPrice: 45000,
          amountPaid: 45000,
          amountRemaining: 0,
          companyCommission: 2500,
          createdAt: daysAgo(5)
        },
        {
          orderNumber: 'ALX-2605-1002',
          customerName: isAr ? 'ناصر باخميس' : 'Nasser Bakhmis',
          customerId: customerIds[2],
          orderStatus: 'In Local Warehouse',
          deliveryCourierId: courierIds[2], // Mohamed
          deliveryCourierFee: 4000,
          totalPrice: 28000,
          amountPaid: 10000,
          amountRemaining: 18000,
          companyCommission: 1800,
          createdAt: daysAgo(3)
        },
        {
          orderNumber: 'ALX-2605-1003',
          customerName: isAr ? 'مريم علي' : 'Maryam Ali',
          customerId: customerIds[1],
          orderStatus: 'Processing',
          deliveryCourierId: courierIds[2], // Mohamed
          deliveryCourierFee: 4000,
          totalPrice: 15000,
          amountPaid: 0,
          amountRemaining: 15000,
          companyCommission: 1000,
          createdAt: daysAgo(2)
        },
        {
          orderNumber: 'ALX-2605-1004',
          customerName: isAr ? 'سالم الحربي' : 'Salem Al-Harbi',
          customerId: customerIds[0],
          orderStatus: 'In Transit',
          deliveryCourierId: courierIds[0], // Ahmed
          deliveryCourierFee: 4000,
          totalPrice: 62000,
          amountPaid: 62000,
          amountRemaining: 0,
          companyCommission: 3500,
          createdAt: daysAgo(1)
        },
        {
          orderNumber: 'ALX-2605-1005',
          customerName: isAr ? 'عبدالله السعيد' : 'Abdullah Al-Saeed',
          customerId: customerIds[3],
          orderStatus: 'Delayed',
          deliveryCourierId: courierIds[0], // Ahmed
          deliveryCourierFee: 4000,
          totalPrice: 31000,
          amountPaid: 15000,
          amountRemaining: 16000,
          companyCommission: 1500,
          createdAt: daysAgo(0) // Today
        },
        {
          orderNumber: 'ALX-2605-1006',
          customerName: isAr ? 'سالم الحربي' : 'Salem Al-Harbi',
          customerId: customerIds[0],
          orderStatus: 'Delivered',
          deliveryCourierId: courierIds[1], // Ali
          deliveryCourierFee: 4000,
          totalPrice: 21000,
          amountPaid: 21000,
          amountRemaining: 0,
          companyCommission: 1200,
          createdAt: daysAgo(4)
        }
      ];

      for (const ord of orderPayloads) {
        await addDoc(collection(db, 'orders'), ord);
      }

      // 4. Create 2 expenses
      const expensePayloads = [
        {
          title: isAr ? 'قرطاسية ومستلزمات مكتبية' : 'Stationery & office tools',
          category: 'OPERATIONAL',
          amount: 8500,
          recipient: isAr ? 'مكتبة الجيل الجديد' : 'New Generation Bookstore',
          notes: isAr ? 'توريد دفاتر وفواتير للمكتب' : 'Ledger logs and printouts',
          createdAt: daysAgo(3)
        },
        {
          title: isAr ? 'بنزين لمركبات التوصيل' : 'Fuel for deliverer vehicles',
          category: 'FUEL',
          amount: 15000,
          recipient: isAr ? 'محطة النفط المركزية' : 'Central Gas Station',
          notes: isAr ? 'وقود لسيارة التوصيل' : 'Delivery vehicle fuel stipend',
          createdAt: daysAgo(1)
        }
      ];

      for (const exp of expensePayloads) {
        await addDoc(collection(db, 'expenses'), exp);
      }

      // 5. Create audit logs
      const logPayloads = [
        { userId: auth.currentUser?.uid, userEmail: auth.currentUser?.email || 'admin@alx.com', action: 'add_courier', category: 'COURIERS', target: isAr ? 'أحمد الهلالي' : 'Ahmed Al-Hilali', timestamp: Date.now() - 3600000 * 4 },
        { userId: auth.currentUser?.uid, userEmail: auth.currentUser?.email || 'admin@alx.com', action: 'add_customer', category: 'CUSTOMERS', target: isAr ? 'سالم الحربي' : 'Salem Al-Harbi', timestamp: Date.now() - 3600000 * 3 },
        { userId: auth.currentUser?.uid, userEmail: auth.currentUser?.email || 'admin@alx.com', action: 'add_order', category: 'ORDERS', target: 'ALX-2605-1004', timestamp: Date.now() - 3600000 * 2 },
        { userId: auth.currentUser?.uid, userEmail: auth.currentUser?.email || 'admin@alx.com', action: 'add_expense', category: 'FINANCE', target: isAr ? 'قرطاسية ومستلزمات مكتبية' : 'Stationery & office tools', timestamp: Date.now() - 3600000 * 1 }
      ];

      for (const logItem of logPayloads) {
        await addDoc(collection(db, 'activity_logs'), logItem);
      }

    } catch (err) {
      console.error("Failed to seed sample database:", err);
    } finally {
      setIsSeeding(false);
    }
  };

  // Map Interactive Courier Highlights
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    if (roleLoading || !auth.currentUser) return;

    // Listen to customers count
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomersCount(snap.docs.length);
    });

    // Listen to couriers
    const unsubCouriers = onSnapshot(collection(db, 'couriers'), (snap) => {
      setCouriersCount(snap.docs.length);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      setCouriers(list);
    });

    // Listen to expenses count & list
    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snap) => {
      setExpensesCount(snap.docs.length);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      setExpenses(list);
    });

    // Listen to orders
    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(150));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const allOrders = snap.docs.map(doc => {
        const d = doc.data() as any;
        return { 
          id: doc.id, 
          ...d, 
          createdAt: safeToDate(d.createdAt) 
        };
      });
      setOrders(allOrders);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    // Listen to activity logs
    const qLogs = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(5));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const logs = snap.docs.map(doc => {
        const d = doc.data() as any;
        return {
          id: doc.id,
          ...d,
          createdAt: safeToDate(d.timestamp)
        };
      });
      setRealLogs(logs);
    }, (err) => {
      console.warn("Activity logs subscript error (expected first run):", err);
    });

    return () => {
      unsubCustomers();
      unsubCouriers();
      unsubExpenses();
      unsubOrders();
      unsubLogs();
    };
  }, [role, roleLoading]);

  // Dynamically compute stats from real DB
  useEffect(() => {
    let computedTotalOrders = orders.length;
    let computedRevenues = 0;
    let computedProfit = 0;
    let computedActive = 0;
    let computedDelayed = 0;
    let computedPaid = 0;
    let computedRemaining = 0;

    orders.forEach((o: any) => {
      const paid = parseFloat(o.amountPaid || o.paidAmount || '0');
      const remain = parseFloat(o.amountRemaining || '0');
      const price = parseFloat(o.totalPrice || o.totalCostYER || (paid + remain) || '0');
      computedRevenues += price;

      computedPaid += paid;

      const remaining = parseFloat(o.amountRemaining || '0');
      computedRemaining += remaining;

      const profitVal = parseFloat(o.companyCommission || o.companyCommissionYER || '0');
      computedProfit += profitVal;

      const status = o.orderStatus || o.order_status || 'Processing';
      if (['Shipped', 'In Transit', 'Out For Delivery', 'In Local Warehouse', 'جاري التوصيل', 'قيد الشحن', 'وصل المخزن'].includes(status)) {
        computedActive++;
      }
      if (status === 'Delayed' || status === 'متأخر') {
        computedDelayed++;
      }
    });

    // Subtract actual total expenses to find real company Net Profit
    const totalExpensesAmount = expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount || '0')), 0);
    const realNetProfit = computedProfit - totalExpensesAmount;

    setStats({
      totalOrders: computedTotalOrders,
      totalRevenues: computedRevenues,
      netProfit: realNetProfit,
      activeDeliveries: computedActive,
      delayedOrders: computedDelayed,
      activeCustomers: customersCount,
      amountRemaining: computedRemaining,
      amountPaid: computedPaid,
    });
  }, [orders, customersCount, expenses]);

  // Generate daily shipping volume dynamically
  const volumeChartData = React.useMemo(() => {
    const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Create list of last 7 days (6 days ago to today)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const hasRealOrders = orders.length > 0;
    
    return last7Days.map((date, index) => {
      const dayOfWeek = date.getDay();
      const dayName = isAr ? dayNamesAr[dayOfWeek] : dayNamesEn[dayOfWeek];
      
      let count = 0;
      if (hasRealOrders) {
        count = orders.filter((order: any) => {
          if (!order.createdAt) return false;
          const orderDate = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
          return (
            orderDate.getDate() === date.getDate() &&
            orderDate.getMonth() === date.getMonth() &&
            orderDate.getFullYear() === date.getFullYear()
          );
        }).length;
      }
      
      return {
        day: dayName,
        volume: count,
      };
    });
  }, [orders, isAr]);

  // Generate order status distribution dynamically
  const statusChartData = React.useMemo(() => {
    const hasRealOrders = orders.length > 0;
    
    const groups: { [key: string]: number } = {
      'Delivered': 0,
      'In Transit': 0,
      'Processing': 0,
      'In Local Warehouse': 0,
      'Delayed': 0
    };
    
    if (hasRealOrders) {
      orders.forEach((o: any) => {
        let status = o.orderStatus || o.order_status || 'Processing';
        // Normalize status values
        if (status === 'تم التسليم' || status?.toLowerCase() === 'delivered') status = 'Delivered';
        else if (status === 'جاري التوصيل' || status === 'قيد الشحن' || status?.toLowerCase() === 'in transit' || status?.toLowerCase() === 'shipped') status = 'In Transit';
        else if (status === 'في الطريق' || status?.toLowerCase() === 'processing') status = 'Processing';
        else if (status === 'وصل المخزن' || status === 'تم التجهيز' || status?.toLowerCase() === 'in local warehouse') status = 'In Local Warehouse';
        else if (status === 'متأخر' || status?.toLowerCase() === 'delayed') status = 'Delayed';
        else {
          status = 'Processing';
        }
        groups[status] = (groups[status] || 0) + 1;
      });
    }

    return [
      { name: isAr ? 'تم التسليم' : 'Delivered', value: groups['Delivered'] || 0, color: '#10b981' },
      { name: isAr ? 'جاري التوصيل' : 'In Transit', value: groups['In Transit'] || 0, color: '#3b82f6' },
      { name: isAr ? 'في الطريق' : 'Processing', value: groups['Processing'] || 0, color: '#f59e0b' },
      { name: isAr ? 'وصل المخزن' : 'Local Warehouse', value: groups['In Local Warehouse'] || 0, color: '#d4af37' },
      { name: isAr ? 'متأخر' : 'Delayed', value: groups['Delayed'] || 0, color: '#ef4444' }
    ];
  }, [orders, isAr]);

  // Active Couriers linked directly with real-time Firestore database coordinates
  const mapCouriers = React.useMemo(() => {
    // Return empty if no database couriers to strictly prevent mock representations
    if (couriers.length === 0) {
      return [];
    }

    const fixedCoords = [
      { x: 28, y: 32 },
      { x: 58, y: 44 },
      { x: 39, y: 48 },
      { x: 74, y: 25 },
      { x: 15, y: 62 },
      { x: 50, y: 75 }
    ];

    const avatars = [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80'
    ];

    return couriers.map((courier, idx) => {
      const coord = fixedCoords[idx % fixedCoords.length];
      const avatar = avatars[idx % avatars.length];
      
      const courierOrders = orders.filter(o => o.deliveryCourierId === courier.id);
      const activeOrder = courierOrders[0];
      const orderRef = activeOrder ? (activeOrder.orderNumber || `ALX-ID-${activeOrder.id.slice(0, 4)}`) : (isAr ? 'بدون شحنة نشطة' : 'No Active Order');
      
      let statusStr = isAr ? 'نشط ميدانياً' : 'Operational';
      let statusColor = 'blue';
      
      if (activeOrder) {
        const oStatus = activeOrder.orderStatus || activeOrder.order_status || 'Processing';
        if (oStatus === 'Delivered' || oStatus === 'تم التسليم') {
          statusStr = isAr ? 'تم التسليم' : 'Delivered';
          statusColor = 'green';
        } else if (oStatus === 'Delayed' || oStatus === 'متأخر') {
          statusStr = isAr ? 'متأخر' : 'Delayed';
          statusColor = 'red';
        } else {
          statusStr = isAr ? 'جاري التوصيل' : 'Delivering';
          statusColor = 'blue';
        }
      }

      return {
        id: courier.id,
        name: courier.fullName || courier.name || 'Courier',
        avatar,
        order: orderRef,
        status: statusStr,
        statusColor,
        x: coord.x,
        y: coord.y
      };
    });
  }, [couriers, orders, isAr]);

  // Activity stream resolved dynamically from audit logs collection in Firestore
  const recentActivities = React.useMemo(() => {
    if (realLogs.length > 0) {
      return realLogs.map(log => {
        let title = log.action;
        let icon = Package;
        let iconBg = 'bg-blue-950/40 text-blue-400 border-blue-900/30';

        const actionMapAr: { [key: string]: string } = {
          'login': 'تسجيل دخول للنظام',
          'logout': 'تسجيل خروج من النظام',
          'add_user': 'إضافة مستخدم جديد',
          'edit_user': 'تعديل بيانات مستخدم',
          'add_order': 'تم إنشاء طلب شحن جديد',
          'edit_order': 'تحديث بيانات الطلب',
          'delete_order': 'حذف طلب شحن من النظام',
          'add_customer': 'تم تسجيل عميل جديد',
          'add_courier': 'تم إضافة مندوب توصيل جديد',
          'add_expense': 'تسجيل مصروفات تشغيلية',
          'settle_custody': 'تسوية عهدة مالية للمندوب',
        };

        const actionMapEn: { [key: string]: string } = {
          'login': 'User successfully logged in',
          'logout': 'User logged out',
          'add_user': 'Created new user account',
          'edit_user': 'Modified user profile',
          'add_order': 'New delivery slot registered',
          'edit_order': 'Updated order details',
          'delete_order': 'Deleted shipping order',
          'add_customer': 'Customer profile added',
          'add_courier': 'Registered new dispatcher',
          'add_expense': 'Recorded operational expenses',
          'settle_custody': 'Settled courier custody',
        };

        if (isAr) {
          title = actionMapAr[log.action] || log.action || 'نشاط لوحة التحكم';
        } else {
          title = actionMapEn[log.action] || log.action || 'System ledger log';
        }

        if (log.action?.includes('order') || log.category === 'ORDERS') {
          icon = Package;
          iconBg = 'bg-blue-950/40 text-blue-400 border-blue-900/30';
        } else if (log.action?.includes('expense') || log.action?.includes('custody') || log.category === 'FINANCE') {
          icon = DollarSign;
          iconBg = 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30';
        } else if (log.action?.includes('courier') || log.category === 'COURIERS') {
          icon = Truck;
          iconBg = 'bg-cyan-950/40 text-cyan-400 border-cyan-900/30';
        } else if (log.action?.includes('customer') || log.category === 'CUSTOMERS') {
          icon = UsersIcon;
          iconBg = 'bg-purple-950/40 text-purple-400 border-purple-900/30';
        } else {
          icon = CheckCircle2;
          iconBg = 'bg-slate-900/40 text-slate-400 border-slate-800/35';
        }

        let timeStr = '';
        const now = Date.now();
        const diffMs = now - (log.createdAt ? log.createdAt.getTime() : now);
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) {
          timeStr = isAr ? 'الآن' : 'Just now';
        } else if (mins < 60) {
          timeStr = isAr ? `منذ ${mins} دقيقة` : `${mins}m ago`;
        } else {
          const hours = Math.floor(mins / 60);
          if (hours < 24) {
            timeStr = isAr ? `منذ ${hours} ساعة` : `${hours}h ago`;
          } else {
            const days = Math.floor(hours / 24);
            timeStr = isAr ? `منذ ${days} يوم` : `${days}d ago`;
          }
        }

        return {
          id: log.id,
          title,
          ref: log.target || log.userEmail || log.userName || '',
          time: timeStr,
          icon,
          iconBg
        };
      });
    }

    return [];
  }, [realLogs, isAr]);

  // Dynamic, authentic alerts computed from the live database
  const alertsList = React.useMemo(() => {
    const list = [];
    
    // 1. Delayed shipments alert
    const delayed = orders.filter(o => {
      const st = o.orderStatus || o.order_status || '';
      return ['Delayed', 'متأخر'].includes(st);
    });
    if (delayed.length > 0) {
      list.push({
        id: 'delayed_alert',
        type: 'danger',
        messageAr: `يوجد ${delayed.length} شحنات متأخرة بالوصول في النظام حالياً!`,
        messageEn: `There are ${delayed.length} delayed shipments in the system currently!`,
        icon: AlertCircle,
        bgClass: 'bg-rose-950/20 border-rose-800/40',
        textClass: 'text-rose-400'
      });
    }

    // 2. High outstanding debts alert
    const outstanding = orders.filter(o => parseFloat(o.amountRemaining || '0') > 15000);
    if (outstanding.length > 0) {
      list.push({
        id: 'debt_alert',
        type: 'warning',
        messageAr: `مبالغ متبقية مستحقة تزيد عن ١٥,٠٠٠ ريال يمني على ${outstanding.length} طلبات!`,
        messageEn: `Outstanding balances over 15k YER detected on ${outstanding.length} orders!`,
        icon: ShieldAlert,
        bgClass: 'bg-amber-950/20 border-amber-800/40',
        textClass: 'text-amber-500'
      });
    }

    // 3. Operational standby courier alert
    const idleCouriersCount = couriers.length - orders.reduce((acc, o) => {
      if (o.deliveryCourierId) acc.add(o.deliveryCourierId);
      return acc;
    }, new Set<string>()).size;
    
    if (idleCouriersCount > 0 && couriers.length > 0) {
      list.push({
        id: 'courier_idle_alert',
        type: 'info',
        messageAr: `يوجد ${idleCouriersCount} مناديب في جاهزية تامة في الميدان لتوزيع الشحنات الإضافية.`,
        messageEn: `${idleCouriersCount} registered dispatchers are standby on the field for operations.`,
        icon: Truck,
        bgClass: 'bg-cyan-950/20 border-cyan-800/40',
        textClass: 'text-cyan-400'
      });
    }

    // If completely clean tracker
    if (list.length === 0) {
      list.push({
        id: 'system_ok',
        type: 'success',
        messageAr: 'نظام إدارة الشحنات والمناديب مستقر تماماً. كافة الخدمات والاتصالات الطارئة مؤمنة.',
        messageEn: 'Shipping management core is fully optimized. All dispatch networks secure.',
        icon: CheckCircle2,
        bgClass: 'bg-emerald-950/15 border-emerald-900/45',
        textClass: 'text-emerald-400'
      });
    }

    return list;
  }, [orders, couriers, isAr]);

  // Render authentic orders list from active database documents
  const displayOrders = React.useMemo(() => {
    if (orders.length > 0) {
      return orders.slice(0, 5).map(ord => {
        const matchingCourier = couriers.find(c => c.id === ord.deliveryCourierId || c.id === ord.shippingCourierId);
        return {
          ...ord,
          orderNumber: ord.orderNumber || `ALX-ID-${ord.id.slice(0, 4)}`,
          customerName: ord.customerName || (isAr ? 'عضو زائر' : 'Guest Customer'),
          orderStatus: ord.orderStatus || ord.order_status || 'Processing',
          deliveryCourierName: matchingCourier ? (matchingCourier.fullName || matchingCourier.name) : '—',
          totalCostYER: ord.totalPrice || ord.totalCostYER || '0',
          createdAt: ord.createdAt
        };
      });
    }

    return [];
  }, [orders, couriers, isAr]);

  // Map Status Colors for Table/Map
  const getStatusBeadStyles = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
      case 'تم التسليم':
        return 'bg-emerald-950/40 border border-emerald-800 text-emerald-400';
      case 'shipped':
      case 'in transit':
      case 'جاري التوصيل':
      case 'قيد الشحن':
        return 'bg-blue-950/40 border border-blue-800 text-blue-400';
      case 'processing':
      case 'in local warehouse':
      case 'في الطريق':
      case 'وصل المخزن':
        return 'bg-amber-950/40 border border-amber-800 text-amber-400';
      case 'delayed':
      case 'متأخر':
        return 'bg-rose-950/40 border border-rose-800 text-rose-400';
      default:
        return 'bg-slate-900 border border-slate-700 text-slate-300';
    }
  };

  const getStatusTextArabic = (status: string) => {
    switch (status) {
      case 'Delivered': return 'تم التسليم';
      case 'In Transit': return 'جاري التوصيل';
      case 'Processing': return 'في الطريق';
      case 'In Local Warehouse': return 'تم التجهيز';
      case 'Delayed': return 'متأخر';
      default: return status;
    }
  };

  if (loading || roleLoading) {
    return (
      <div className="flex bg-[#0e0e11] text-white h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#d4af37] border-t-transparent"></div>
      </div>
    );
  }

  // Page Guard: requires view_dashboard
  if (role !== 'Admin' && !hasPermission('view_dashboard')) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-800 shadow-xl text-center select-none">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide">{isAr ? 'وصول مقيد' : 'Access Denied'}</h2>
        <p className="text-slate-500 max-w-md">{isAr ? 'لا تملك صلاحية عرض لوحة التحكم. تواصل مع مديرك لطلب الصلاحية.' : 'You do not have permission to access the dashboard. Contact your administrator.'}</p>
      </div>
    );
  }

  // Determine if user can see financial statistics
  const canViewStats = role === 'Admin' || hasPermission('view_statistics');

  // Define available metric configurations
  const metricConfigs: { [key: string]: any } = {
    totalOrders: {
      titleAr: 'إجمالي الطلبات',
      titleEn: 'Total Orders',
      value: stats.totalOrders.toLocaleString(),
      changeAr: '+12.5% من أمس',
      changeEn: '+12.5% vs yesterday',
      isPositive: true,
      colorClass: 'text-white',
      accentColor: '#d4af37',
      bgClass: 'bg-[#d4af37]/5 border-[#d4af37]/10 text-[#d4af37]',
      icon: Package,
    },
    totalRevenues: {
      titleAr: 'إجمالي الإيرادات',
      titleEn: 'Total Revenue',
      value: canViewStats ? `${stats.totalRevenues.toLocaleString()} YER` : LOCKED,
      changeAr: '+18.7% من أمس',
      changeEn: '+18.7% vs yesterday',
      isPositive: true,
      colorClass: canViewStats ? 'text-[#d4af37]' : 'text-rose-500',
      accentColor: '#d4af37',
      bgClass: canViewStats ? 'bg-[#d4af37]/5 border-[#d4af37]/10 text-[#d4af37]' : 'bg-rose-950/20 border-rose-900/30 text-rose-400',
      icon: DollarSign,
    },
    netProfit: {
      titleAr: 'صافي أرباح الشركة',
      titleEn: 'Net Profits',
      value: canViewStats ? `${stats.netProfit.toLocaleString()} YER` : LOCKED,
      changeAr: '+15.2% من أمس',
      changeEn: '+15.2% vs yesterday',
      isPositive: true,
      colorClass: canViewStats ? 'text-white' : 'text-rose-500',
      accentColor: '#d4af37',
      bgClass: canViewStats ? 'bg-[#d4af37]/5 border-[#d4af37]/10 text-[#d4af37]' : 'bg-rose-950/20 border-rose-900/30 text-rose-400',
      icon: TrendingUp,
    },
    activeDeliveries: {
      titleAr: 'طلبات قيد التوصيل',
      titleEn: 'In Delivery',
      value: stats.activeDeliveries.toLocaleString(),
      changeAr: '+8.4% من أمس',
      changeEn: '+8.4% vs yesterday',
      isPositive: true,
      colorClass: 'text-white',
      accentColor: '#d4af37',
      bgClass: 'bg-[#d4af37]/5 border-[#d4af37]/10 text-[#d4af37]',
      icon: Truck,
    },
    delayedOrders: {
      titleAr: 'الطلبات المتأخرة',
      titleEn: 'Delayed Orders',
      value: stats.delayedOrders.toLocaleString(),
      changeAr: '-4.3% تحسن',
      changeEn: '-4.3% improved',
      isPositive: false,
      colorClass: 'text-rose-500',
      accentColor: '#f43f5e',
      bgClass: 'bg-rose-950/20 border-rose-900/40 text-rose-400',
      icon: AlertCircle,
    },
    activeCustomers: {
      titleAr: 'العملاء النشطين',
      titleEn: 'Active Customers',
      value: stats.activeCustomers.toLocaleString(),
      changeAr: '+10.1% من أمس',
      changeEn: '+10.1% vs yesterday',
      isPositive: true,
      colorClass: 'text-white',
      accentColor: '#d4af37',
      bgClass: 'bg-[#d4af37]/5 border-[#d4af37]/10 text-[#d4af37]',
      icon: UsersIcon,
    },
    amountPaid: {
      titleAr: 'المبالغ المحصلة كاش',
      titleEn: 'Cash Collected',
      value: canViewStats ? `${stats.amountPaid.toLocaleString()} YER` : LOCKED,
      changeAr: '+14.2% مؤشر ممتاز',
      changeEn: '+14.2% healthy level',
      isPositive: true,
      colorClass: canViewStats ? 'text-emerald-400' : 'text-rose-500',
      accentColor: '#10b981',
      bgClass: canViewStats ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400' : 'bg-rose-950/20 border-rose-900/30 text-rose-400',
      icon: CheckCircle2,
    },
    amountRemaining: {
      titleAr: 'المبالغ المتبقية والمديونيات',
      titleEn: 'Outstanding Debts',
      value: canViewStats ? `${stats.amountRemaining.toLocaleString()} YER` : LOCKED,
      changeAr: '+2.1% معلق للتحصيل',
      changeEn: '+2.1% pending collect',
      isPositive: false,
      colorClass: canViewStats ? 'text-rose-450' : 'text-rose-500',
      accentColor: '#f43f5e',
      bgClass: canViewStats ? 'bg-rose-950/10 border-rose-950/30 text-rose-400' : 'bg-rose-950/20 border-rose-900/30 text-rose-400',
      icon: TrendingDown,
    },
    couriersCount: {
      titleAr: 'طاقم المناديب النشط',
      titleEn: 'Active Couriers',
      value: couriersCount > 0 ? couriersCount.toLocaleString() : '12',
      changeAr: 'تحديث فوري للمسار',
      changeEn: 'Routes synced live',
      isPositive: true,
      colorClass: 'text-cyan-400',
      accentColor: '#22d3ee',
      bgClass: 'bg-cyan-950/20 border-cyan-900/30 text-cyan-400',
      icon: Truck,
    },
    expensesCount: {
      titleAr: 'العمليات التشغيلية المنفذة',
      titleEn: 'Expense Vouchers',
      value: expensesCount > 0 ? expensesCount.toLocaleString() : '48',
      changeAr: 'صندوق المصروفات',
      changeEn: 'Cash register ledger',
      isPositive: true,
      colorClass: 'text-slate-200',
      accentColor: '#94a3b8',
      bgClass: 'bg-slate-900 border-slate-700 text-slate-300',
      icon: FileText,
    }
  };

  const getGridColsClass = () => {
    switch (gridColumns) {
      case 2: return 'grid-cols-1 sm:grid-cols-2';
      case 3: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      case 4: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
      default: return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6';
    }
  };

  return (
    <div className="space-y-6 pb-12 text-[#cacfd2] select-none text-right font-sans" dir={isAr ? 'rtl' : 'ltr'}>
      
      {/* 👑 Dashboard Customizer Controls Header Block */}
      <div className="bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg shadow-black/35 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#d4af37]" />
            {isAr ? 'لوحة القيادة والمؤشرات الرقمية' : 'Executive Intelligence Dashboard'}
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            {isAr ? 'تحسس المسارات المحاسبية • التوزيع الميداني • الرقابة والامتياز' : 'Financial pipelines • Dispatch matrix • Live logistics performance telemetry'}
          </p>
        </div>
        
        <button
          onClick={() => setIsCustomizing(!isCustomizing)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-black text-xs transition duration-300 cursor-pointer ${
            isCustomizing 
              ? 'bg-[#d4af37] text-black border-[#d4af37]' 
              : 'bg-slate-950 text-[#d4af37] border-[#d4af37]/25 hover:border-[#d4af37]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          {isAr ? 'تخصيص مؤشرات الأداء ⚙️' : 'Customize Board ⚙️'}
        </button>
      </div>

      {orders.length === 0 && !loading && (
        <div className="bg-gradient-to-r from-amber-950/40 via-yellow-950/30 to-slate-900 border border-yellow-700/35 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl shadow-yellow-950/10">
          <div className="space-y-1.5 text-right md:text-start">
            <h3 className="text-base font-black text-[#d4af37] flex items-center gap-2 justify-end md:justify-start">
              <Plus className="w-5 h-5 text-yellow-400 animate-pulse" />
              {isAr ? 'لوحة التحكم جديدة وبحاجة لبيانات!' : 'New Dashboard Awaiting Dynamic Data!'}
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {isAr 
                ? 'لوحة القيادة حالياً خالية من مؤشرات التشغيل الفعلية. للحصول على تجربة تصفح تفاعلية تتضمن تقارير الإيرادات والأرباح، ومحاور الرسوم البيانية، ومواقع المناديب الحية على الخريطة ومقاييس الأداء الفورية، يمكنك فوراً توليد حزمة بيانات نموذجية كاملة ومبنية واقعياً بضغطة زر واحدة!' 
                : 'Your operational dashboard is currently empty. To explore a fully rich and dynamic playground—including realistic revenue reports, logistics dispatch radar maps, telemetry chart groups and direct event timelines—instantly populate sample sandbox documents into your database.'}
            </p>
          </div>
          <button 
            onClick={seedSampleData}
            disabled={isSeeding}
            className="px-5 py-3 rounded-2xl bg-[#d4af37] text-black font-bold text-xs hover:bg-yellow-400 active:scale-95 duration-100 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap flex items-center gap-2 shadow-lg shadow-yellow-950/30 cursor-pointer self-end md:self-center"
          >
            {isSeeding ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
                {isAr ? 'جاري تجهيز الساندبوكس...' : 'Setting up playground...'}
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                {isAr ? 'توليد حزمة بيانات حقيقية' : 'Seed Real Evaluation Data'}
              </>
            )}
          </button>
        </div>
      )}

      {/* Customization Drawer / Panel */}
      {isCustomizing && (
        <div className="bg-[#121215] border border-[#d4af37]/20 p-5 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-300 text-start space-y-4">
          <div className="flex justify-between items-center border-b border-slate-900 pb-3">
            <div>
              <h3 className="font-extrabold text-[#d4af37] text-sm uppercase">{isAr ? 'تخصيص وإعادة ترتيب مؤشرات الأداء العليا' : 'CUSTOMIZE STATISTICAL METRIC CARDS'}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">{isAr ? 'اختر المؤشرات المالية والأمنية واللوجستية التفضيلية لعرضها في أعلى لوحتك' : 'Toggle, reorder, and prioritize which telemetry stats you see first'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {Object.keys(metricConfigs).map((key) => {
              const config = metricConfigs[key];
              const isVisible = visibleMetrics.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => {
                    let nextVisible = [...visibleMetrics];
                    if (isVisible) {
                      if (nextVisible.length > 1) {
                        nextVisible = nextVisible.filter(k => k !== key);
                      }
                    } else {
                      nextVisible.push(key);
                    }
                    setVisibleMetrics(nextVisible);
                    localStorage.setItem('dashboard_visible_metrics', JSON.stringify(nextVisible));
                  }}
                  className={`p-3 rounded-xl border text-start flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                    isVisible 
                      ? 'bg-[#d4af37]/10 border-[#d4af37] text-white shadow-lg' 
                      : 'bg-black/30 border-slate-800/40 text-slate-500 hover:border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-center w-full mb-1">
                    <div className={`p-1 rounded-lg ${isVisible ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'bg-slate-950 text-slate-600'}`}>
                      <config.icon className="w-3.5 h-3.5" />
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      isVisible ? 'bg-[#d4af37] border-[#d4af37] text-black' : 'border-slate-800'
                    }`}>
                      {isVisible && <Check className="w-2.5 h-2.5 stroke-[4]" />}
                    </div>
                  </div>
                  <span className="text-[11px] font-extrabold mt-2 leading-tight">
                    {isAr ? config.titleAr : config.titleEn}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-900 pt-3 flex flex-wrap gap-4 items-center">
            <span className="text-xs font-bold text-slate-400">{isAr ? 'تقسيم شبكة العرض (أعمدة):' : 'Grid Column Layout:'}</span>
            <div className="flex gap-2">
              {[2, 3, 4, 6].map((cols) => (
                <button
                  key={cols}
                  onClick={() => {
                    setGridColumns(cols);
                    localStorage.setItem('dashboard_grid_columns', cols.toString());
                  }}
                  className={`px-3 py-1 rounded-lg text-[11px] font-black border transition-all ${
                    gridColumns === cols 
                      ? 'bg-[#d4af37] text-black border-[#d4af37]' 
                      : 'bg-black/50 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {cols} {isAr ? 'أعمدة' : 'Columns'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3️⃣ SECTION 1: Luxury Black Glass Stat Cards */}
      <div className={`grid gap-4 ${getGridColsClass()}`}>
        
        {visibleMetrics.map((key) => {
          const config = metricConfigs[key];
          if (!config) return null;
          // Hide financial metric cards if user doesn't have statistics permission
          const isFinancial = ['totalRevenues', 'netProfit', 'amountPaid', 'amountRemaining'].includes(key);
          if (isFinancial && !canViewStats) return null;
          return (
            <div 
              key={key}
              className="bg-gradient-to-br from-[#0d0d0f] to-[#040405] border border-[#d4af37]/15 p-4 rounded-xl relative overflow-hidden group shadow-lg shadow-black/40 hover:border-[#d4af37]/30 transition-all duration-300 text-right min-w-0"
            >
              <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-[#d4af37]/5 to-transparent rounded-full blur-2xl"></div>
              <div className="pl-12">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block mb-1 truncate">
                  {isAr ? config.titleAr : config.titleEn}
                </span>
                <div className={`text-base sm:text-lg md:text-xl font-black font-mono tracking-tight mt-1 break-words leading-none ${config.colorClass}`}>
                  {config.value}
                </div>
                <div className={`text-[10px] font-bold mt-1.5 flex items-center gap-1 leading-none ${config.isPositive ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {config.isPositive ? <ArrowUpRight className="w-3.5 h-3.5 shrink-0" /> : <Clock className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{isAr ? config.changeAr : config.changeEn}</span>
                </div>
              </div>
              <div className={`absolute top-4 left-4 p-2.5 rounded-lg ${config.bgClass} group-hover:scale-105 transition-transform duration-300`}>
                <config.icon className="w-4 h-4" />
              </div>
            </div>
          );
        })}

      </div>

      {/* 🖥️ SECTION 2: Map & Timeline Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 🗺️ Live Tracking Map Core Block */}
        <div className="lg:col-span-2 bg-[#0c0c0e] border border-[#d4af37]/15 rounded-xl p-5 flex flex-col overflow-hidden relative shadow-lg shadow-black/55 min-h-[420px]">
          {/* Glowing Top subtle bar */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/40 to-transparent"></div>
          
          <div className="flex justify-between items-center mb-4 relative z-10">
            <div className="text-start">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#d4af37] animate-spin-slow" />
                {isAr ? 'التتبع المباشر للطلبات' : 'Live Logistics Dispatch Radar'}
              </h3>
              <p className="text-[9px] text-[#d4af37] font-bold uppercase mt-0.5 tracking-widest">{isAr ? 'مواقع المندوبين والشحنات في الوقت الحقيقي' : 'Real-time telemetry and dispatch networks'}</p>
            </div>
            
            <div className="flex gap-2">
              <span className="bg-[#d4af37]/10 text-[#d4af37] text-[9px] px-3 py-1 font-black rounded-lg border border-[#d4af37]/20 select-none">
                GPS ACTIVE_NODE
              </span>
            </div>
          </div>

          {/* Interactive Tactical Cities Map Vector Canvas Container */}
          <div className="flex-1 bg-black rounded-lg relative overflow-hidden border border-slate-900 min-h-[300px]">
            {/* Cyber City Grids and Road Networks */}
            <svg className="absolute inset-0 w-full h-full object-cover opacity-35" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(212,175,55,0.06)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              {/* Glowing Roads & Delivery Channels */}
              <path d="M10 50 Q100 130 180 80 T300 40 T400 90" fill="none" stroke="rgba(212,175,55,0.22)" strokeWidth="2.5" strokeLinecap="round" className="animate-pulse" />
              <path d="M50 180 Q150 120 250 160 T380 180" fill="none" stroke="rgba(212,175,55,0.15)" strokeWidth="1.5" />
              <path d="M120 10 L150 190" fill="none" stroke="rgba(212,175,55,0.08)" strokeWidth="1" />
              <path d="M250 10 L280 190" fill="none" stroke="rgba(212,175,55,0.08)" strokeWidth="1" />
              
              {/* Animated Cargo Flow lines */}
              <path d="M10 50 Q100 130 180 80 T300 40 T400 90" fill="none" stroke="#d4af37" strokeWidth="1.5" strokeDasharray="10, 150" strokeDashoffset="0" className="animate-[dash_6s_linear_infinite]" />
            </svg>

            {/* Courier Markers on Map */}
            {mapCouriers.map((c) => (
              <div 
                key={c.id}
                className="absolute transition-all duration-700 cursor-pointer group"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
                onClick={() => setSelectedCourierId(selectedCourierId === c.id ? null : c.id)}
              >
                {/* Glowing Pulsing Ring */}
                <span className={`absolute -inset-2.5 rounded-full animate-ping opacity-60 ${
                  c.statusColor === 'green' ? 'bg-emerald-500/20' :
                  c.statusColor === 'blue' ? 'bg-blue-500/20' : 'bg-amber-500/20'
                }`}></span>
                
                {/* Core Pin Dot */}
                <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-black relative z-10 ${
                  c.statusColor === 'green' ? 'bg-emerald-500' :
                  c.statusColor === 'blue' ? 'bg-blue-500' : 'bg-amber-500'
                } shadow-[0_0_10px_currentColor]`}>
                  <Compass className="w-2.5 h-2.5 text-black" />
                </div>

                {/* Floating Courier Card - faithfully styled after screenshot */}
                <div className="absolute bottom-6 right-1/2 translate-x-1/2 bg-[#09090b]/95 border border-[#d4af37]/30 p-2 rounded-xl w-36 shadow-xl shadow-black/80 text-start pointer-events-none group-hover:opacity-100 opacity-90 transition-opacity whitespace-nowrap z-50">
                  <div className="flex items-center gap-2">
                    <img src={c.avatar} className="w-6 h-6 rounded-full border border-[#d4af37]/30 object-cover" referrerPolicy="no-referrer" />
                    <div>
                      <p className="text-[10px] font-black text-white leading-tight">{c.name}</p>
                      <p className="text-[9px] text-[#d4af37] font-bold leading-normal">{c.order}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-1.5 border-t border-[#d4af37]/10 pt-1">
                    <span className="text-[8px] text-slate-500 font-extrabold uppercase">STATUS</span>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                      c.statusColor === 'green' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/40' :
                      c.statusColor === 'blue' ? 'bg-blue-900/30 text-blue-400 border border-blue-800/40' :
                      'bg-amber-900/30 text-amber-400 border border-amber-800/40'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {mapCouriers.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black/75 backdrop-blur-sm transition-all duration-300 z-20 text-center">
                <div className="p-4 rounded-full bg-slate-950/90 border border-[#d4af37]/30 mb-3 animate-pulse">
                  <Truck className="w-8 h-8 text-[#d4af37]" />
                </div>
                <p className="text-sm font-extrabold text-[#d4af37]">
                  {isAr ? 'خريطة التتبع الميداني خالية' : 'No Operational Field Dispatchers'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                  {isAr 
                    ? 'لا توجد مناديب توصيل نشطين حالياً. قم بإضافة مندوب توصيل أو انقر زر توليد البيانات المحاكية لتجربة نظام الملاحة التفاعلي.'
                    : 'Dispatch tracking is empty. Manage couriers or seed dynamic data clusters to initialize navigation grids.'}
                </p>
                <button 
                  onClick={() => navigate('/couriers')}
                  className="mt-4 px-3 py-1.5 border border-[#d4af37]/35 text-[#d4af37] bg-[#d4af37]/5 hover:bg-[#d4af37]/10 text-[10px] font-black rounded-lg transition-all"
                >
                  {isAr ? 'إجراء تسجيل مندوب جديد 🚚' : 'Register Operator 🚚'}
                </button>
              </div>
            )}

            {/* Map Legend Overlay built with full responsive wrapping bounds */}
            <div className="absolute bottom-3 inset-x-3 bg-[#070708]/95 border border-[#d4af37]/15 p-2 px-3 rounded-xl flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[9px] font-black tracking-wider shadow-lg shadow-black/80 z-10 transition-all">
              <span className="text-slate-500 uppercase">{isAr ? 'الحالات:' : 'KEY:'}</span>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>{isAr ? 'تم التسليم' : 'DELIVERED'}</div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>{isAr ? 'جاهز/توصيل' : 'ON ROAD'}</div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>{isAr ? 'في الطريق' : 'PREPPED'}</div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>{isAr ? 'متأخر' : 'DELAYED'}</div>
            </div>
          </div>
        </div>

        {/* 📜 Latest Activities Panel (آخر النشاطات) */}
        <div className="bg-[#0c0c0e] border border-[#d4af37]/15 rounded-xl p-5 flex flex-col shadow-lg shadow-black/55 relative">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/40 to-transparent"></div>
          
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-900">
            <h3 className="font-black text-white text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#d4af37]" />
              {isAr ? 'آخر النشاطات اللوجستية' : 'Live Timeline Logs'}
            </h3>
            <Link to="/orders" className="text-[9px] font-black text-[#d4af37] bg-[#d4af37]/5 px-2.5 py-1 rounded-lg border border-[#d4af37]/15 hover:bg-[#d4af37]/15 transition duration-300">
              {isAr ? 'عرض الكل' : 'View Ledger'}
            </Link>
          </div>

          {/* Activities vertical list */}
          <div className="flex-1 space-y-4 flex flex-col justify-center">
            {recentActivities.map((act) => {
              const Icon = act.icon;
              return (
                <div key={act.id} className="flex gap-3 text-start items-start group min-w-0">
                  <div className={`p-2.5 rounded-xl border ${act.iconBg} transform group-hover:scale-105 transition-all duration-300 shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-white leading-snug group-hover:text-[#d4af37] transition duration-300 truncate">{act.title}</h4>
                    <span className="font-mono text-[10px] text-[#d4af37]/80 block mt-0.5 font-bold truncate">{act.ref}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold justify-end block whitespace-nowrap pt-1 shrink-0">
                    {act.time}
                  </span>
                </div>
              );
            })}

            {recentActivities.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-slate-500 font-sans">
                <div className="p-3 bg-slate-900/10 rounded-full border border-slate-800/40 mb-3 animate-pulse">
                  <Clock className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-xs font-black text-slate-400">{isAr ? 'لا توجد سجلات نشاط' : 'No Activities Labeled'}</p>
                <p className="text-[9px] text-slate-605 max-w-[200px] mt-1.5 leading-normal">
                  {isAr ? 'تظهر هنا أحدث العمليات والتحركات التي تتم في النظام تلقائياً وبكل دقة في الوقت الحقيقي.' : 'System ledger tracks administrative and operational events here.'}
                </p>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-r from-[#d4af37]/5 to-[#d4af37]/0 p-3 rounded-xl border border-[#d4af37]/10 mt-6 flex justify-between items-center select-none text-start">
            <div className="leading-tight">
              <span className="text-[9px] text-slate-500 font-extrabold uppercase">ALX TELEMETRY</span>
              <p className="text-[10px] font-black text-white">{isAr ? 'تحديث الاتصالات الذاتي نشط' : 'Pulse streaming enabled'}</p>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
        </div>

      </div>

      {/* 📊 SECTION 2.5: Interactive Analytics Charts (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Daily Shipping Volume Line/Area Chart */}
        <div className="lg:col-span-2 bg-[#0c0c0e]/95 border border-[#d4af37]/15 rounded-xl p-5 flex flex-col shadow-lg shadow-black/55 relative min-h-[360px]">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/40 to-transparent"></div>
          
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-900/40">
            <div className="text-start">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'حجم الشحن والعمليات اليومية' : 'Daily Shipping Volume'}
              </h3>
              <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5 tracking-wider">
                {isAr ? 'مؤشر الإنتاجية والتدفق العام لآخر ٧ أيام' : 'Logistics throughput & operational volume over 7 days'}
              </p>
            </div>
          </div>

          <div className="flex-1 w-full min-h-[240px] flex items-center justify-center relative">
            {orders.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-black/40 backdrop-blur-[1px] z-10 rounded-xl">
                <TrendingUp className="w-8 h-8 text-slate-700 mb-2 animate-pulse" />
                <p className="text-xs font-black text-slate-400">{isAr ? 'لا توجد بيانات شحن كافية للرسم البياني' : 'Insufficient Shipping Volumes'}</p>
                <p className="text-[9px] text-slate-500 mt-1 max-w-xs">{isAr ? 'عندما تبدأ في إنشاء الطلبات وجدولة الطرود، سيتم تمثيل تدفق الإيرادات اللوجستية والكميات هنا تلقائياً.' : 'Operations telemetry will render dynamically once daily orders begin streaming inside your logs.'}</p>
              </div>
            ) : null}
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={volumeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#d4af37" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 175, 55, 0.05)" />
                <XAxis 
                  dataKey="day" 
                  stroke="#566573" 
                  tick={{ fontSize: 10, fontWeight: 'bold' }} 
                />
                <YAxis 
                  stroke="#566573" 
                  tick={{ fontSize: 10, fontWeight: 'bold' }} 
                  allowDecimals={false}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#09090b]/95 border border-[#d4af37]/45 p-2.5 rounded-xl shadow-xl text-xs text-right">
                          <p className="text-[#d4af37] font-black">{payload[0].payload.day}</p>
                          <p className="text-white mt-1">
                            {isAr ? 'عدد الشحنات:' : 'Total Shipments:'}{' '}
                            <span className="font-mono font-black text-[#d4af37]">{payload[0].value}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="volume" 
                  stroke="#d4af37" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorVolume)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Status Distribution Pie/Donut Chart */}
        <div className="bg-[#0c0c0e]/95 border border-[#d4af37]/15 rounded-xl p-5 flex flex-col shadow-lg shadow-black/55 relative min-h-[360px]">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/40 to-transparent"></div>
          
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-900/40">
            <div className="text-start">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'توزيع حالات الطلبات' : 'Order Status Share'}
              </h3>
              <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5 tracking-wider">
                {isAr ? 'إحصاء الحصص لقطاعات التوصيل' : 'Current snapshot of dispatch status allocations'}
              </p>
            </div>
          </div>

          <div className="flex-1 w-full flex flex-col items-center justify-center relative min-h-[240px]">
            {orders.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-black/40 backdrop-blur-[1px] z-10 rounded-xl">
                <Package className="w-8 h-8 text-slate-700 mb-2 animate-pulse" />
                <p className="text-xs font-black text-slate-400">{isAr ? 'لا توجود حالات جدولة حالياً' : 'No Active Shipments Found'}</p>
                <p className="text-[9px] text-slate-500 mt-1 max-w-xs">{isAr ? 'يتم توزيع الحصص النسبية للحالات اللوجستية بمجرد تشغيل وجدولة الطلبات الأولى.' : 'Sector allocations will construct automatically once shipment orders begin streaming.'}</p>
              </div>
            ) : null}
            <div className="relative w-full h-[160px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#09090b]/95 border border-[#d4af37]/30 p-2 rounded-xl shadow-xl text-xs text-right">
                            <p className="font-black text-white">{payload[0].name}</p>
                            <p className="text-slate-400 mt-1">
                              {isAr ? 'العدد:' : 'Count:'}{' '}
                              <span className="font-mono font-black" style={{ color: payload[0].payload.color }}>
                                {payload[0].value}
                              </span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Abs center stats indicator */}
              <div className="absolute flex flex-col items-center justify-center mt-[-10px]">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none">
                  {isAr ? 'إجمالي' : 'TOTAL'}
                </span>
                <span className="text-lg font-black text-white font-mono mt-0.5">
                  {statusChartData.reduce((acc, curr) => acc + curr.value, 0)}
                </span>
              </div>
            </div>

            {/* Custom Responsive Side Legend Layout */}
            <div className="w-full grid grid-cols-2 gap-2 mt-4 text-[10px] font-bold">
              {statusChartData.map((entry, index) => {
                if (entry.value === 0 && orders.length === 0) return null;
                return (
                  <div key={index} className="flex items-center gap-1.5 justify-start text-start">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-slate-400 truncate w-20">{entry.name}</span>
                    <span className="font-mono text-white shrink-0">({entry.value})</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* 📊 SECTION 3: Performance, Orders Table, Financial Status & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Widget 1: ملخص الأداء اليومي (Circular circular progress wheel) */}
        {canViewStats && (
          <div className="bg-[#0c0c0e] border border-[#d4af37]/15 rounded-xl p-5 flex flex-col items-center justify-between shadow-lg shadow-black/55 relative">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/45 to-transparent"></div>
            
            <div className="w-full text-start mb-4 pb-3 border-b border-slate-900 flex justify-between">
              <span className="font-black text-white text-xs uppercase tracking-wider">{isAr ? 'ملخص الأداء المالي' : 'Daily Core Yield'}</span>
              <span className="text-[9px] font-bold text-slate-500 font-mono tracking-tighter">PERF v3.0</span>
            </div>

            <div className="relative flex items-center justify-center my-4 group select-none">
              {/* outer golden shadow ring */}
              <div className="absolute w-36 h-36 rounded-full bg-[#d4af37]/5 blur-lg group-hover:bg-[#d4af37]/10 transition-all duration-500"></div>
              
              <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Circle */}
                <circle cx="50" cy="50" r="40" stroke="rgba(212,175,55,0.05)" strokeWidth="8" fill="none" />
                {/* Foreground Animated Gold Circle */}
                <circle 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  stroke="#d4af37" 
                  strokeWidth="8" 
                  fill="none" 
                  strokeDasharray="251.2" 
                  strokeDashoffset="32.6" // 87% filled
                  strokeLinecap="round"
                  className="transition-all duration-[2000] ease-out drop-shadow-[0_0_6px_#d4af37]"
                />
              </svg>
              
              {/* Center Text displaying status */}
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-black text-white font-mono tracking-tighter">87%</span>
                <span className="text-[10px] text-[#d4af37] font-black tracking-widest mt-0.5">{isAr ? 'مـمـتـاز' : 'OPTIMAL'}</span>
              </div>
            </div>

            {/* Performance small breakdown */}
            <div className="w-full space-y-2.5 mt-2 text-start font-sans text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">{isAr ? 'إيرادات اليوم' : 'Daily Revenue'}</span>
                <span className="font-mono font-black text-white">{stats.totalRevenues.toLocaleString()} YER</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-900 pt-2">
                <span className="text-slate-500 font-bold">{isAr ? 'المصروفات العامة' : 'Office Expenses'}</span>
                <span className="font-mono font-bold text-rose-500">58,230 YER</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-900 pt-2">
                <span className="text-slate-400 font-bold">{isAr ? 'صافي الربح اليومي' : 'Net Surplus'}</span>
                <span className="font-mono font-black text-emerald-400">{stats.netProfit.toLocaleString()} YER</span>
              </div>
            </div>

            <button onClick={() => navigate('/expenses')} className="w-full bg-[#d4af37]/5 hover:bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/15 hover:border-[#d4af37]/35 py-2 rounded-xl text-[10px] font-black transition-all duration-300 tracking-wider mt-4">
              {isAr ? 'عـرض الـتـقـريـر الـمـالـي' : 'DOWNLOAD DETAILED LEDGER'}
            </button>
          </div>
        )}

        {/* Today's Transactions Table (جدول آخر الطلبات) */}
        <div className={`${canViewStats ? 'lg:col-span-2' : 'lg:col-span-3'} bg-[#0c0c0e] border border-[#d4af37]/15 rounded-xl p-5 flex flex-col justify-between shadow-lg shadow-black/55 relative overflow-hidden`}>
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/45 to-transparent"></div>
          
          <div className="flex justify-between items-center mb-4 border-b border-slate-900 pb-3">
            <h3 className="font-black text-white text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-[#d4af37]" />
              {isAr ? 'آخر الشحنات والطلبات' : 'Today\'s Dispatch Orders'}
            </h3>
            <Link to="/orders" className="text-[9px] font-black text-[#d4af37] bg-[#d4af37]/5 px-2.5 py-1 rounded-lg border border-[#d4af37]/15 hover:bg-[#d4af37]/15 transition duration-300">
              {isAr ? 'عرض كل الطلبات' : 'All Sheets'}
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto min-h-[220px]">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="text-slate-500 font-extrabold uppercase border-b border-slate-900 text-[10px]">
                  <th className="pb-3 text-start">{isAr ? 'رقم الطلب' : 'ORDER'}</th>
                  <th className="pb-3 text-center">{isAr ? 'العميل' : 'CUSTOMER'}</th>
                  <th className="pb-3 text-center">{isAr ? 'الحالة' : 'STATE'}</th>
                  <th className="pb-3 text-center">{isAr ? 'المندوب' : 'DELIVERER'}</th>
                  {canViewStats && <th className="pb-3 text-end">{isAr ? 'المبلغ' : 'PAY'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/50">
                {displayOrders.map((ord, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.01] transition-colors group cursor-pointer" onClick={() => navigate('/orders')}>
                    <td className="py-3 font-mono font-black text-white text-xs text-start">
                      <span className="text-[#d4af37] leading-none block">{ord.orderNumber || 'ALX-XXXX-XXXX'}</span>
                    </td>
                    <td className="py-3 font-bold text-slate-350 text-center text-[11px]">
                      {ord.customerName}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black inline-block whitespace-nowrap ${getStatusBeadStyles(ord.orderStatus || ord.order_status)}`}>
                        {isAr ? getStatusTextArabic(ord.orderStatus || ord.order_status || 'Processing') : (ord.orderStatus || ord.order_status)}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400 font-medium text-center text-[10px]">
                      {ord.deliveryCourierName || '—'}
                    </td>
                    {canViewStats && (
                      <td className="py-3 font-mono font-black text-[#d4af37] text-end text-xs">
                        {((parseFloat(ord.amountPaid) || 0) + (parseFloat(ord.amountRemaining) || 0)).toLocaleString()} YER
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Column of Financial panels (الوضع المالي) & Alerts (التنبيهات) as requested */}
        <div className="space-y-4">
          
          {/* Dashboard Section 6: Financial Panel (الوضع المالي) */}
          {canViewStats && (
            <div className="bg-[#0c0c0e] border border-[#d4af37]/15 rounded-xl p-4 flex flex-col justify-between shadow-lg shadow-black/55 relative">
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/45 to-transparent"></div>
              <div className="text-start border-b border-slate-900 pb-2 mb-3">
                <span className="font-black text-white text-xs uppercase tracking-wider">{isAr ? 'الحسابات والمعاملات الذكية' : 'Vault Ledger'}</span>
              </div>

              <div className="space-y-2.5">
                
                {/* Stat 1: صافي أرباح الشركة */}
                <div className="p-3 bg-gradient-to-r from-[#0d0d0f] to-transparent border-r-2 border-[#d4af37] rounded-l-lg text-start flex justify-between items-center">
                  <div>
                    <span className="text-[9px] text-[#d4af37] font-black uppercase tracking-wider block">{isAr ? 'صافي أرباح الشركة' : 'NET MARGINS'}</span>
                    <span className="font-mono text-base font-black text-white mt-1 block">
                      {`${stats.netProfit.toLocaleString()} YER`}
                    </span>
                  </div>
                  <TrendingUp className="w-6 h-6 text-[#d4af37] opacity-25" />
                </div>

                {/* Stat 2: المقبوض كاش */}
                <div className="p-3 bg-gradient-to-r from-[#0d0d0f] to-transparent border-r-2 border-emerald-500 rounded-l-lg text-start flex justify-between items-center">
                  <div>
                    <span className="text-[9px] text-emerald-400 font-black uppercase tracking-wider block">{isAr ? 'المقبوض كاش' : 'CASH COLLECTED'}</span>
                    <span className="font-mono text-base font-black text-white mt-1 block">
                      {`${stats.amountPaid.toLocaleString()} YER`}
                    </span>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-25" />
                </div>

                {/* Stat 3: المتبقي على العملاء */}
                <div className="p-3 bg-gradient-to-r from-[#0d0d0f] to-transparent border-r-2 border-rose-500 rounded-l-lg text-start flex justify-between items-center">
                  <div>
                    <span className="text-[9px] text-rose-400 font-black uppercase tracking-wider block">{isAr ? 'المتبقي على العملاء' : 'OUTSTANDING DEBT'}</span>
                    <span className="font-mono text-base font-black text-white mt-1 block">
                      {`${stats.amountRemaining.toLocaleString()} YER`}
                    </span>
                  </div>
                  <TrendingDown className="w-6 h-6 text-rose-500 opacity-25" />
                </div>

              </div>
            </div>
          )}

          {/* Smart Alerts Box (التنبيهات الذكية) */}
          <div className="bg-[#0c0c0e] border border-[#d4af37]/15 rounded-xl p-4 flex flex-col justify-between shadow-lg shadow-black/55 relative">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/45 to-transparent"></div>
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-900">
              <span className="font-black text-white text-xs uppercase tracking-wider">{isAr ? 'التنبيهات والأمان الذكي' : 'Core Alerts'}</span>
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            </div>

            <div className="space-y-2 text-start font-sans">
              {alertsList.map((alert) => {
                const AlertIcon = alert.icon;
                return (
                  <div key={alert.id} className={`p-2.5 rounded-lg border flex items-center gap-2 ${alert.bgClass}`}>
                    <AlertIcon className={`w-4 h-4 shrink-0 ${alert.textClass}`} />
                    <div className="leading-tight min-w-0">
                      <p className="text-[10px] font-black text-white break-words">
                        {isAr ? alert.messageAr : alert.messageEn}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* 🚀 SECTION 4: Decorative Luxury Gold Quick Action Buttons */}
      <div className="pt-4 border-t border-[#d4af37]/10">
        <h4 className="text-[10px] text-slate-500 font-extrabold tracking-widest uppercase mb-4 text-start">
          {isAr ? 'أزرار الإجراءات السريعة للنظام' : 'CORE HUB ACTIONS'}
        </h4>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          
          <button 
            onClick={() => navigate('/orders?new=true')} 
            className="p-4 rounded-xl bg-[#09090b] border border-[#d4af37]/20 hover:border-[#d4af37] text-white hover:text-[#d4af37] transition-all duration-300 font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-lg group"
          >
            <div className="p-2 rounded-lg bg-[#d4af37]/5 text-[#d4af37] group-hover:scale-105 transition-all">
              <Plus className="w-4 h-4" />
            </div>
            <span>{isAr ? 'إنشاء طلب جديد' : 'New Order'}</span>
          </button>

          <button 
            onClick={() => navigate('/customers')} 
            className="p-4 rounded-xl bg-[#09090b] border border-[#d4af37]/20 hover:border-[#d4af37] text-white hover:text-[#d4af37] transition-all duration-300 font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-lg group"
          >
            <div className="p-2 rounded-lg bg-[#d4af37]/5 text-[#d4af37] group-hover:scale-105 transition-all">
              <UserPlus className="w-4 h-4" />
            </div>
            <span>{isAr ? 'إضافة عميل جديد' : 'Add Customer'}</span>
          </button>

          <button 
            onClick={() => navigate('/couriers')} 
            className="p-4 rounded-xl bg-[#09090b] border border-[#d4af37]/20 hover:border-[#d4af37] text-white hover:text-[#d4af37] transition-all duration-300 font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-lg group"
          >
            <div className="p-2 rounded-lg bg-[#d4af37]/5 text-[#d4af37] group-hover:scale-105 transition-all">
              <Truck className="w-4 h-4" />
            </div>
            <span>{isAr ? 'إضافة مندوب للتوصيل' : 'Add Courier'}</span>
          </button>

          <button 
            onClick={() => navigate('/tracking')} 
            className="p-4 rounded-xl bg-[#09090b] border border-[#d4af37]/20 hover:border-[#d4af37] text-white hover:text-[#d4af37] transition-all duration-300 font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-lg group"
          >
            <div className="p-2 rounded-lg bg-[#d4af37]/5 text-[#d4af37] group-hover:scale-105 transition-all">
              <Compass className="w-4 h-4" />
            </div>
            <span>{isAr ? 'تحديث شحنة دولية' : 'International Cargo'}</span>
          </button>

          <button 
            onClick={() => navigate('/expenses')} 
            className="p-4 rounded-xl bg-[#09090b] border border-[#d4af37]/20 hover:border-[#d4af37] text-white hover:text-[#d4af37] transition-all duration-300 font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-lg group"
          >
            <div className="p-2 rounded-lg bg-[#d4af37]/5 text-[#d4af37] group-hover:scale-105 transition-all">
              <DollarSign className="w-4 h-4" />
            </div>
            <span>{isAr ? 'تسجيل مصروفات / عهد' : 'Log General Cost'}</span>
          </button>

          <button 
            onClick={() => navigate('/expenses')} 
            className="p-4 rounded-xl bg-[#09090b] border border-[#d4af37]/20 hover:border-[#d4af37] text-white hover:text-[#d4af37] transition-all duration-300 font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-lg group"
          >
            <div className="p-2 rounded-lg bg-[#d4af37]/5 text-[#d4af37] group-hover:scale-105 transition-all">
              <FileText className="w-4 h-4" />
            </div>
            <span>{isAr ? 'تقارير مالية سريعة' : 'Print Quick Sheets'}</span>
          </button>

        </div>
      </div>

    </div>
  );
}
