import React, { useState, useEffect } from 'react';
import CopyToClipboard from '../components/CopyToClipboard';
import { 
  Package, 
  Search, 
  Clock, 
  CheckCircle2, 
  Truck, 
  PackageCheck, 
  AlertCircle, 
  ArrowLeft, 
  Home, 
  Plus, 
  Trash2, 
  Copy, 
  Send, 
  BadgeAlert, 
  Anchor, 
  Check, 
  FileText, 
  Layers, 
  Sparkles, 
  User, 
  Phone, 
  Coins, 
  Database,
  Info
} from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useSettings } from '../context/SettingsContext';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

import { useRole } from '../hooks/useRole';
import { useOrderStatuses } from '../hooks/useOrderStatuses';

// Fix typical leaflet icon issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface TrackingUpdate {
  status: string;
  timestamp: number;
  location: string;
  notes?: string;
  createdBy?: string;
}

export default function Tracking() {
  const { settings, t } = useSettings();
  const navigate = useNavigate();
  const { role, hasPermission, loading: roleLoading } = useRole();
  const { statuses: orderStatusesList } = useOrderStatuses();
  const isAr = settings.language === 'ar';

  const [trackingNumber, setTrackingNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // High fidelity tracking results state
  const [trackingData, setTrackingData] = useState<any>(null);
  const [resolvedSource, setResolvedSource] = useState<'public' | 'orders_db' | null>(null);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (trackingData?.trackingNumber) {
      navigator.clipboard.writeText(trackingData.trackingNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Administrative / Editing capabilities
  const [isStaff, setIsStaff] = useState(false);
  const [adminMemo, setAdminMemo] = useState('');
  const [statusSelector, setStatusSelector] = useState('تم تسجيل الطلب');
  const [gpsLocation, setGpsLocation] = useState('مستودع الفرز والتبريد');
  const [customLogNotes, setCustomLogNotes] = useState('');
  
  // Customer WhatsApp support configuration
  const [customSupportMsg, setCustomSupportMsg] = useState('');

  // Verify if current visitor has administrative clearance
  useEffect(() => {
    const checkStaffStatus = async () => {
      const user = auth.currentUser;
      if (user) {
        setIsStaff(true);
        if (!roleLoading && role !== 'Admin' && !hasPermission('track_order')) {
          navigate('/orders');
        }
      }
    };
    checkStaffStatus();
  }, [role, roleLoading, hasPermission, navigate]);

  // Standard tracking translation lookup
  const statusTranslations: Record<string, string> = {
    'تم تسجيل الطلب': isAr ? 'تم تسجيل الطلب واستخلاص الفاتورة' : 'Invoice saved / Registered',
    'وصل مستودع السعودية': isAr ? 'وصل مستودع السعودية للتعبئة' : 'Arrived Saudi packaging HUB',
    'جاري الشحن لليمن': isAr ? 'جاري الشحن لليمن براً / جوأً' : 'Shipped/Transit to Yemen',
    'في التخليص الجمركي': isAr ? 'في التخليص الجمركي والأوراق' : 'Customs clearance & processing',
    'وصل مركز التوزيع في اليمن': isAr ? 'وصل مركز التوزيع والفرز النهائي' : 'Arrived final Yemen depot',
    'مع المندوب للتوصيل': isAr ? 'مع المندوب بانتظار التسليم' : 'Out for final delivery',
    'تم التسليم': isAr ? 'تم التسليم وتفصيل العهد الموردة' : 'Delivered successfully',
    'ملغي': isAr ? 'ملغي ومسترجع' : 'Cancelled / Revoked',
    
    // Legacy mapping compatibility
    'Pending': isAr ? 'قيد الانتظار والمراجعة' : 'Pending',
    'Ordered': isAr ? 'تم تأكيد طلب الشحن' : 'Ordered',
    'Processing': isAr ? 'قيد التجهيز بمستودعاتنا' : 'Processing',
    'Shipped': isAr ? 'تم الترحيل والشحن الدولي' : 'Shipped/Dispatched',
    'In Transit': isAr ? 'بالشحن الدولي البري' : 'In Transit',
    'In Local Warehouse': isAr ? 'وصل مخزن التجميع المحلي' : 'In Local Warehouse',
    'Out For Delivery': isAr ? 'خرج للتسليم مع المندوب' : 'Out For Delivery',
    'Delivered': isAr ? 'تم التسليم بنجاح للعميل' : 'Delivered'
  };

  const getTranslatedStatus = (status: string) => {
    return statusTranslations[status] || status;
  };

  // Get professional icon representing current logistics status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'تم تسجيل الطلب':
      case 'Pending':
      case 'Ordered':
        return <Clock className="w-5 h-5 text-amber-500" />;
      case 'وصل مستودع السعودية':
      case 'Processing':
        return <Package className="w-5 h-5 text-yellow-400" />;
      case 'جاري الشحن لليمن':
      case 'Shipped':
        return <Truck className="w-5 h-5 text-blue-400" />;
      case 'في التخليص الجمركي':
      case 'In Transit':
        return <Anchor className="w-5 h-5 text-purple-400 animate-pulse" />;
      case 'وصل مركز التوزيع في اليمن':
      case 'In Local Warehouse':
        return <Home className="w-5 h-5 text-indigo-400" />;
      case 'مع المندوب للتوصيل':
      case 'Out For Delivery':
        return <Truck className="w-5 h-5 text-cyan-400 animate-bounce" />;
      case 'تم التسليم':
      case 'Delivered':
        return <CheckCircle2 className="w-5 h-5 text-[#d4af37]" />;
      case 'ملغي':
        return <AlertCircle className="w-5 h-5 text-rose-500" />;
      default:
        return <PackageCheck className="w-5 h-5 text-slate-400" />;
    }
  };

  // Get glow and border color classes based on current status
  const getStatusColorClasses = (status: string) => {
    if (status === 'تم التسليم' || status === 'Delivered') {
      return 'border-[#d4af37]/30 text-[#d4af37] bg-[#d4af37]/5 shadow-[0_0_15px_rgba(212,175,55,0.05)]';
    }
    if (status === 'ملغي') {
      return 'border-rose-500/20 text-rose-400 bg-rose-950/20';
    }
    if (status === 'مع المندوب للتوصيل' || status === 'Out For Delivery') {
      return 'border-cyan-500/30 text-cyan-400 bg-cyan-950/10 animate-pulse';
    }
    return 'border-amber-500/20 text-amber-400 bg-amber-950/10';
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = trackingNumber.trim();
    if (!queryStr) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');
    setTrackingData(null);
    setResolvedSource(null);

    try {
      // 1. Ask backend API (which integrates third-party APIs + our local database)
      const res = await fetch('/api/tracking/live/' + encodeURIComponent(queryStr));
      
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const json = await res.json();
            if (json.success && json.tracking) {
               const t = json.tracking;
               let reconstructed: any = null;

           if (t.isLiveApi) {
               // Render live external API data
               reconstructed = {
                  id: queryStr,
                  trackingNumber: queryStr,
                  orderNumber: 'N/A (External)',
                  status: t.status || 'تم تسجيل الطلب',
                  customerName: 'Verified Caller',
                  customerPhone: '***',
                  customerAddress: t.currentLocation || 'N/A',
                  weight: 0,
                  cbm: 0,
                  shippingCompany: 'External Carrier',
                  amountPaid: 0,
                  amountRemaining: 0,
                  totalCostYER: 0,
                  currency: 'YER',
                  products: [],
                  history: t.history || [],
                  currentCoordinates: t.currentCoordinates
               };
               setResolvedSource('public');
           } else {
               // Internal Order doc
               const docData = t.docData;
               reconstructed = {
                  id: docData.id || queryStr,
                  trackingNumber: docData.trackingNumber || docData.orderNumber,
                  orderNumber: docData.orderNumber,
                  status: t.status,
                  customerName: docData.customerName,
                  customerPhone: docData.customerPhone,
                  customerAddress: docData.customerAddress || docData.destination || 'صنعاء، اليمن',
                  weight: docData.totalWeight || 0,
                  cbm: docData.totalCBM || 0,
                  shippingCompany: docData.shippingCompany || '',
                  amountPaid: docData.amountPaid || 0,
                  amountRemaining: docData.amountRemaining || 0,
                  totalCostYER: docData.totalCostYER || 0,
                  currency: docData.currency || 'YER',
                  products: docData.items || [],
                  history: t.history || [],
                  currentCoordinates: t.currentCoordinates
               };
               setResolvedSource('orders_db');
           }

           setTrackingData(reconstructed);
           setGpsLocation(t.currentLocation || 'مستودع الفرز والتبريد');
           setStatusSelector(t.status || 'تم تسجيل الطلب');
           return;
        }
        }
      }

      // If nothing worked
      setError(
        isAr 
          ? 'تعذر العثور على شحنة مطابقة لرقم التتبع أو رقم هاتف العميل. يرجى مراجعة المدخل والمحاولة.' 
          : 'Could not resolve tracking profile. Double check tracking ID or customer phone.'
      );
    } catch (err: any) {
      setError(isAr ? 'حدث خطأ تقني في تأمين الاتصال بقاعدة البيانات.' : 'Error contacting real-time telemetry servers.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Publishes order database telemetry to the public-accessible endpoint with 1-click
  const handleDeployToPublic = async () => {
    if (!trackingData || resolvedSource !== 'orders_db') return;
    setLoading(true);
    try {
      const publicId = (trackingData.trackingNumber || trackingData.orderNumber).toUpperCase();
      const publicRef = doc(db, 'public_tracking', publicId);
      
      const payload = {
        trackingNumber: publicId,
        orderNumber: trackingData.orderNumber || '',
        status: trackingData.status,
        customerName: trackingData.customerName || '',
        customerPhone: trackingData.customerPhone || '',
        customerAddress: trackingData.customerAddress || '',
        weight: trackingData.weight || 0,
        cbm: trackingData.cbm || 0,
        shippingCompany: trackingData.shippingCompany || '',
        amountPaid: trackingData.amountPaid || 0,
        amountRemaining: trackingData.amountRemaining || 0,
        totalCostYER: trackingData.totalCostYER || 0,
        currency: trackingData.currency || 'YER',
        products: trackingData.products || [],
        history: trackingData.history || [],
        locationYemen: gpsLocation,
        updatedAt: Date.now()
      };

      await setDoc(publicRef, payload);
      setResolvedSource('public'); // Switch search reference so updates sync directly
      setSuccessMsg(isAr ? 'تم نشر وتفعيل واجهة التتبع العامة للعميل بنجاح!' : 'Successfully published tracking portal for Client!');
    } catch (err) {
      console.error(err);
      setError(isAr ? 'فشل نشر وتأمين واجهة العميل العامة.' : 'Failed to publish public client profile.');
    } finally {
      setLoading(false);
    }
  };

  // Quick administration function to push status and logistics log events directly
  const handlePushLogEvent = async () => {
    if (!trackingData) return;
    setLoading(true);
    try {
      const newEvent: TrackingUpdate = {
        status: statusSelector,
        timestamp: Date.now(),
        location: gpsLocation,
        notes: customLogNotes.trim() ? customLogNotes.trim() : `تحديث لوجيستي روتيني: ${gpsLocation}`,
        createdBy: auth.currentUser?.email || 'System Agent'
      };

      const revisedHistory = [...(trackingData.history || []), newEvent];
      
      // Update locally first for beautiful instant reactivity
      const updatedData = {
        ...trackingData,
        status: statusSelector,
        locationYemen: gpsLocation,
        history: revisedHistory
      };
      setTrackingData(updatedData);

      // Persist directly based on where we loaded from
      if (resolvedSource === 'public') {
        const docRef = doc(db, 'public_tracking', trackingData.trackingNumber.toUpperCase());
        await updateDoc(docRef, {
          status: statusSelector,
          locationYemen: gpsLocation,
          history: revisedHistory,
          updatedAt: Date.now()
        });
      } else if (resolvedSource === 'orders_db') {
        const docRef = doc(db, 'orders', trackingData.id);
        const statusItem = orderStatusesList.find(s => s.nameAr === statusSelector || s.nameEn === statusSelector || s.code === statusSelector);
        const statusIdStr = String(statusItem?.id || '2');
        await updateDoc(docRef, {
          orderStatusId: statusIdStr,
          order_status_id: statusIdStr,
          orderStatus: statusSelector,
          locationYemen: gpsLocation,
          history: revisedHistory,
          updatedAt: Date.now()
        });
      }

      setCustomLogNotes('');
      setSuccessMsg(isAr ? 'تم قيد وتسجيل الحدث اللوجيستي الجديد وحفظ وتأمين السجل!' : 'Successfully recorded and synced new transit milestone!');
    } catch (err) {
      console.error(err);
      setError(isAr ? 'حدث خطأ أثناء إجراء التعديلات.' : 'Error writing log event updates.');
    } finally {
      setLoading(false);
    }
  };

  // Instantly clean timeline log events (Super Admin only)
  const handleClearHistory = async () => {
    if (!trackingData || !window.confirm(isAr ? 'هل أنت متأكد من مسح جميع الأحداث السابقة والشروع بسجل جديد؟' : 'Are you sure you want to reset shipment history?')) return;
    setLoading(true);
    try {
      const initialHistory = [
        {
          status: 'تم تسجيل الطلب',
          timestamp: Date.now(),
          location: isAr ? 'مستودع الشحن' : 'Shipping HUB',
          notes: isAr ? 'إعادة تهيئة المسار وبداية رصد التتبع الموحد للنظام' : 'Reinitialized tracking records'
        }
      ];

      const updatedData = {
        ...trackingData,
        history: initialHistory,
        status: 'تم تسجيل الطلب'
      };
      setTrackingData(updatedData);

      if (resolvedSource === 'public') {
        await updateDoc(doc(db, 'public_tracking', trackingData.trackingNumber.toUpperCase()), {
          history: initialHistory,
          status: 'تم تسجيل الطلب',
          updatedAt: Date.now()
        });
      } else if (resolvedSource === 'orders_db') {
        await updateDoc(doc(db, 'orders', trackingData.id), {
          history: initialHistory,
          orderStatus: 'تم تسجيل الطلب',
          updatedAt: Date.now()
        });
      }

      setSuccessMsg(isAr ? 'تم تصفية السجل اللوجيستي وتوليد خط بداية جديد!' : 'History cleared successfully!');
    } catch (err) {
      console.error(err);
      setError(isAr ? 'فشلت تصفية المسارات.' : 'Failed clearing tracking logs.');
    } finally {
      setLoading(false);
    }
  };

  const currentMilestones = [
    { key: 'تم تسجيل الطلب', label: isAr ? 'تم تسجيل الطلب' : 'Registered' },
    { key: 'وصل مستودع السعودية', label: isAr ? 'مستودع السعودية' : 'Saudi HUB' },
    { key: 'جاري الشحن لليمن', label: isAr ? 'جاري الشحن لليمن' : 'Yemen Transit' },
    { key: 'في التخليص الجمركي', label: isAr ? 'التخليص الجمركي' : 'Customs' },
    { key: 'وصل مركز التوزيع في اليمن', label: isAr ? 'مركز التوزيع باليمن' : 'Yemen HUB' },
    { key: 'تم التسليم', label: isAr ? 'تم التسليم للعميل' : 'Delivered' }
  ];

  return (
    <div className={auth.currentUser 
      ? "space-y-6 pb-20 text-start font-sans selection:bg-[#d4af37]/30 text-slate-300"
      : "min-h-screen bg-gradient-to-b from-[#0e0e11] to-[#060608] text-slate-300 font-sans selection:bg-[#d4af37]/30 text-start pb-32"
    }>
      
      {!auth.currentUser && (
        /* Premium Luxury SubHeader for Guests */
        <header className="bg-black/30 sticky top-0 z-50 border-b border-[#d4af37]/15 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-[#d4af37]/35 rounded-2xl flex items-center justify-center font-black bg-gradient-to-br from-[#1c1c22] to-black text-[#d4af37] shadow-[0_0_15px_rgba(212,175,55,0.15)] select-none">
              A
            </div>
            <div className="text-start">
              <span className="text-sm font-black tracking-widest text-white uppercase block leading-none">ALX_DELIVER</span>
              <span className="text-[10px] text-[#d4af37] font-bold block uppercase tracking-[0.2em] mt-1 pr-1">{isAr ? 'تتبع الشحنات الذكي' : 'Smart Tracking Telemetry'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isStaff && (
              <span className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/25 text-[9px] font-black px-2.5 py-1 rounded-xl uppercase tracking-widest hidden sm:inline-block">
                {isAr ? 'صلاحيات الموظف نشطة' : 'Staff Clearance On'}
              </span>
            )}
            <Link 
              to="/" 
              className="px-4 py-2 bg-slate-900 hover:bg-slate-850 hover:text-white border border-slate-800 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 text-[#d4af37]"
            >
              <ArrowLeft className="w-4 h-4" />
              {isAr ? 'الرئيسية' : 'Portal Node'}
            </Link>
          </div>
        </div>
      </header>
    )}

      {/* Main Container */}
      <main className={`max-w-4xl mx-auto px-6 ${auth.currentUser ? 'pt-4' : 'pt-12'}`}>
        
        {/* Page Hero Introduction */}
        <div className="text-center mb-10">
          <div className="inline-flex p-3 bg-gradient-to-b from-[#18181f] to-transparent rounded-3xl border border-[#d4af37]/15 justify-center mb-5 shadow-2xl">
            <div className="p-3 bg-[#d4af37]/10 rounded-2xl border border-[#d4af37]/30 text-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.1)]">
              <Truck className="w-10 h-10 animate-pulse" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase mb-2">
            {isAr ? 'بوابة رصد الشحنات والتتبع' : 'CARGO DISPATCH TELEMETRY'}
          </h1>
          <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-[0.35em] inline-block border-y border-slate-900 py-1.5 px-6">
            {isAr ? 'محطة التحكم المركزية ومطابقة كود الحاويات' : 'Real-time routing network & delivery validation'}
          </p>
        </div>

        <div className="bg-[#121215] border border-slate-850 rounded-3xl p-6 shadow-2xl mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#d4af37]/2 to-transparent rounded-full blur-3xl pointer-events-none"></div>
          
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder={isAr ? 'أدخل كود التتبع أو رقم هاتف العميل...' : 'SHN-XXXX-XXXX / Phone...'}
                className="w-full pr-12 pl-4 py-3 bg-black/50 border border-slate-850 rounded-xl text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none transition-all text-start"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !trackingNumber.trim()}
              className="py-3 px-8 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black text-xs font-black rounded-xl transition-all active:scale-[0.98] uppercase tracking-widest shrink-0 disabled:opacity-40"
            >
              {loading ? (isAr ? 'جاري الرصد...' : 'Quering Server...') : (isAr ? 'تحميل بيانات التتبع' : 'Verify State')}
            </button>
          </form>

          <div className="flex items-center gap-2 mt-4 text-slate-500 text-[10px] justify-start px-2 font-mono">
            <Info className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>{isAr ? 'ملاحظة: يدعم رصد النظام أكواد التتبع كـ SHN-... ورقم هاتف المستلم (لصاحب الحساب المعتمد)' : 'Supports querying global Cargo codes and registered client phones.'}</span>
          </div>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="bg-rose-500/10 text-rose-400 p-4 rounded-2xl flex items-center mb-6 border border-rose-500/20 font-mono text-xs uppercase text-start gap-2.5">
            <BadgeAlert className="w-5 h-5 text-rose-500 shrink-0" />
            <span>[error-log]: {error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-2xl flex items-center mb-6 border border-emerald-500/20 font-mono text-xs uppercase text-start gap-2.5">
            <Check className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>[system]: {successMsg}</span>
          </div>
        )}

        {/* Dynamic Result Panel */}
        {trackingData && (
          <div className="space-y-6 animate-fade-in text-start">
            
            {/* 1. Passsport Meta Card */}
            <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 rounded-3xl overflow-hidden shadow-2xl relative">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-b from-[#d4af37]/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="p-5 border-b border-slate-850/80 bg-black/30 flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-850/50 justify-between items-center gap-4">
                <div className="text-start">
                  <span className="text-[9px] font-black tracking-widest text-[#d4af37] uppercase block">{isAr ? 'رقم التتبع المكتشف' : 'LOGISTICS WAYBILL'}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-base font-black text-white">{trackingData.trackingNumber.toUpperCase()}</span>
                    <CopyToClipboard text={trackingData.trackingNumber.toUpperCase()} showIconOnly={true} iconSize={13} className="h-7 w-7" />
                  </div>
                  <span className="text-[10px] text-slate-500 block font-bold font-mono mt-0.5">&gt; ORDER_REF: {trackingData.orderNumber || '—'}</span>
                </div>

                <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl border border-[#d4af37]/15 bg-[#d4af37]/5 shadow-[0_0_10px_rgba(212,175,55,0.05)] text-center shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#d4af37] animate-ping"></div>
                  <span className="text-[10px] font-black text-white tracking-widest uppercase">
                    {getTranslatedStatus(trackingData.status)}
                  </span>
                </div>
              </div>

              {/* Physical Properties Grid */}
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 bg-black/10">
                <div className="p-3 bg-slate-950 border border-slate-850/50 rounded-2xl">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wide block mb-0.5">{isAr ? 'الوزن القائم' : 'Gross Weight'}</span>
                  <span className="font-mono text-sm text-white font-bold">{trackingData.weight || '—'} <span className="text-[10px] text-slate-500">KG</span></span>
                </div>
                
                <div className="p-3 bg-slate-950 border border-slate-850/50 rounded-2xl">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wide block mb-0.5">{isAr ? 'الحجم الحجمي' : 'Volume Unit'}</span>
                  <span className="font-mono text-sm text-[#d4af37] font-bold">{trackingData.cbm || '—'} <span className="text-[10px] text-slate-500">CBM</span></span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-850/50 rounded-2xl">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wide block mb-0.5">{isAr ? 'جهة الوصول الحالية' : 'Current Spot'}</span>
                  <span className="text-[10px] font-black text-cyan-400 block truncate">{gpsLocation}</span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-850/50 rounded-2xl">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wide block mb-0.5">{isAr ? 'الناقل الدولي' : 'Global Ocean Carrier'}</span>
                  <span className="text-[10px] font-black text-pink-400 block truncate uppercase">{trackingData.shippingCompany || '—'}</span>
                </div>
              </div>
            </div>

            {/* 2. Customer Financial Invoice View (Aesthetic Ledger) */}
            <div className="bg-[#121215] border border-slate-850 rounded-3xl p-6 relative overflow-hidden text-start">
              <div className="absolute right-0 top-0 w-2 h-full bg-gradient-to-b from-[#d4af37] to-amber-600"></div>
              
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-850">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#d4af37]" />
                  <h3 className="font-black text-white text-xs uppercase tracking-widest">{isAr ? 'خلاصة كشف الحساب والتحصيل الفردي' : 'Financial Statement Overview'}</h3>
                </div>
                <span className="text-[9px] text-[#d4af37] font-bold font-mono uppercase">YER Ledger</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase">{isAr ? 'إجمالي رسوم الشحن والتعبئة' : 'Total Charges'}</span>
                  <span className="font-mono text-base font-black text-white mt-1">{((parseFloat(trackingData.amountPaid) || 0) + (parseFloat(trackingData.amountRemaining) || 0)).toLocaleString()} <span className="text-[10px] text-slate-500">YER</span></span>
                </div>
                
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase">{isAr ? 'المبالغ الموردة (المدفوع)' : 'Collected'}</span>
                  <span className="font-mono text-base font-black text-emerald-400 mt-1">{(trackingData.amountPaid || 0).toLocaleString()} <span className="text-[10px] text-slate-500">YER</span></span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase">{isAr ? 'المتبقي المستحق عند الاستلام' : 'Due At Handover'}</span>
                  <span className={`font-mono text-base font-black mt-1 ${trackingData.amountRemaining <= 0 ? 'text-emerald-500' : 'text-rose-400 animate-pulse'}`}>
                    {(trackingData.amountRemaining || 0).toLocaleString()} <span className="text-[10px] text-slate-500">YER</span>
                  </span>
                </div>
              </div>

              {trackingData.amountRemaining > 0 && (
                <div className="mt-4 p-3.5 bg-rose-950/10 border border-rose-950/40 rounded-2xl flex items-start gap-3">
                  <Info className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-400 leading-relaxed font-bold">
                    {isAr 
                      ? 'ملاحظة: يرجى تسوية وتوريد الرسوم المتبقية لمندوب التسليم النهائي أو تحويلها للمحاسب المختص بالمؤسسة قبل تسليم الطرد رسمياً.' 
                      : 'Notice: Please settle the remaining fees with the final delivery representative or bank wire before shipping handover.'}
                  </p>
                </div>
              )}
            </div>

            {/* 3. Interactive Shipping Pipelines (Live Route Visual Progress Map) */}
            <div className="bg-[#121215] border border-slate-850 rounded-3xl p-6 text-start">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'خريطة رصد المسار ومطابقة المراحل اللوجيستية' : 'Logistics Pipeline State Checkpoint'}
              </h3>
              
              {/* Stepper block */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-10">
                {currentMilestones.map((step, idx) => {
                  // Determine status index vs current status index
                  const milestoneKeys = currentMilestones.map(m => m.key);
                  const currentIdx = milestoneKeys.indexOf(trackingData.status);
                  const completed = idx <= currentIdx && currentIdx !== -1 && trackingData.status !== 'ملغي';
                  const active = idx === currentIdx;

                  return (
                    <div 
                      key={step.key} 
                      className={`p-3 rounded-2xl border transition-all text-center flex flex-col justify-between h-24 ${
                        active 
                          ? 'border-[#d4af37] bg-[#d4af37]/5 shadow-[0_0_15px_rgba(212,175,55,0.08)]' 
                          : completed 
                          ? 'border-emerald-500/20 bg-emerald-950/5 text-slate-400' 
                          : 'border-slate-850 bg-black/3c opacity-45'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[9px] text-slate-500">0{idx+1}</span>
                        {completed ? (
                          <CheckCircle2 className={`w-3.5 h-3.5 ${active ? 'text-[#d4af37]' : 'text-emerald-400'}`} />
                        ) : (
                          <div className="w-2.5 h-2.5 rounded-full border border-slate-700"></div>
                        )}
                      </div>
                      <span className="text-[9px] font-black uppercase leading-tight mt-auto block text-start select-none">
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Realtime Live Map Frame */}
              <div className="mb-10 w-full h-[400px] rounded-3xl overflow-hidden border border-slate-850 relative bg-black relative shadow-2xl">
                {!trackingData.currentCoordinates && (
                   <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur text-sm text-[#d4af37] animate-pulse">
                     {isAr ? 'جاري استقبال الإحداثيات الجغرافية...' : 'Locating GPS Coordinates...'}
                   </div>
                )}
                {trackingData.currentCoordinates && (
                  <MapContainer 
                    center={trackingData.currentCoordinates as [number, number]} 
                    zoom={5} 
                    style={{ height: '100%', width: '100%', zIndex: 1 }}
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                    
                    {/* Render historical path polyline if there are coordinates */}
                    {(() => {
                      const points = trackingData.history
                         ?.map((h: any) => h.coordinates)
                         .filter(Boolean) as [number, number][];
                         
                      return points?.length > 1 ? (
                        <Polyline positions={points} color="#d4af37" weight={3} dashArray="10, 10" className="animate-pulse" />
                      ) : null;
                    })()}

                    {/* Checkpoints Markers */}
                    {trackingData.history?.map((h: any, i: number) => {
                      if (!h.coordinates) return null;
                      const isCurrent = i === trackingData.history.length - 1;
                      return (
                        <Marker key={i} position={h.coordinates as [number, number]}>
                          <Popup autoClose={false} className="custom-popup">
                            <div className="text-xs font-sans text-start min-w-[200px]">
                              <span className="font-bold block mb-1 text-slate-800">{getTranslatedStatus(h.status)}</span>
                              <span className="text-[10px] text-slate-500 block mb-1">{h.location}</span>
                              <span className="text-[9px] text-slate-400 block border-t pt-1 font-mono">
                                {new Date(h.timestamp).toLocaleString()}
                              </span>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                )}
              </div>

              {/* 4. Vertical Interactive Milestone Tracker Logs */}
              <div className="border-t border-slate-850 pt-6">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 block">
                  {isAr ? 'تسلسل الأحداث والترانزيت التاريخي' : 'CONSOLIDATED TRANSIT HISTORY'}
                </h4>

                <div className="space-y-0 relative">
                  {[...(trackingData.history || [])].reverse().map((event: any, index: number, arr: any[]) => {
                    return (
                      <div key={index} className="relative flex gap-6 pb-6 last:pb-0 text-start group">
                        
                        {/* Connecting track line */}
                        {index !== arr.length - 1 && (
                          <div className="absolute right-5 top-8 bottom-0 w-[1px] bg-slate-800 group-hover:bg-[#d4af37]/20 transition-all"></div>
                        )}

                        <div className="shrink-0 z-10">
                          <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center bg-black/60 shadow-xl transition-all ${
                            index === 0 
                              ? 'border-[#d4af37] ring-1 ring-[#d4af37]/20' 
                              : 'border-slate-800'
                          }`}>
                            {getStatusIcon(event.status)}
                          </div>
                        </div>

                        <div className="flex-1 pt-1.5 bg-black/20 p-4 rounded-2xl border border-slate-850/40 hover:border-slate-800 transition-all">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className={`text-xs font-black uppercase ${index === 0 ? 'text-[#d4af37] text-md' : 'text-slate-300'}`}>
                              {getTranslatedStatus(event.status)}
                            </span>
                            
                            <span className="text-[10px] text-slate-500 font-mono font-bold">
                              {new Date(event.timestamp).toLocaleString(isAr ? 'ar-YE' : 'en-US')}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mb-1.5">
                            <span className="text-emerald-500 font-mono">&gt; LOCATION:</span>
                            <span className="text-white font-mono font-bold">{event.location}</span>
                          </div>

                          {event.notes && (
                            <p className="text-[10px] text-slate-500 leading-relaxed font-bold border-t border-slate-850/50 pt-1.5 mt-1.5 italic">
                              "{event.notes}"
                            </p>
                          )}
                        </div>

                      </div>
                    );
                  })}

                  {(!trackingData.history || trackingData.history.length === 0) && (
                    <div className="p-8 text-center text-slate-600 bg-black/20 rounded-2xl border border-slate-850 border-dashed">
                      {isAr ? 'لا يوجد أحداث تتبع مسجلة حالياً.' : 'No tracking events found.'}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* 5. Inventory Items Manifest */}
            <div className="bg-[#121215] border border-slate-850 rounded-3xl p-6 text-start">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'المحتويات والطرود المجمعة داخل الشحنة' : 'Manifest & Bundled Products'}
              </h3>

              {trackingData.products && trackingData.products.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {trackingData.products.map((item: any, i: number) => (
                    <div key={i} className="bg-black/40 border border-slate-850 p-4 rounded-2xl flex justify-between items-center shadow-inner">
                      <div className="text-start">
                        <span className="text-xs font-bold text-white block mb-1">{item.productName || (isAr ? 'محتوى مجهول الهوية' : 'Unspecified Cargo')}</span>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono font-bold">
                          <span>QTY: {item.quantity || 1}</span>
                          <span>|</span>
                          <span>URL: {item.productUrl ? (
                            <a href={item.productUrl} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">Link</a>
                          ) : '—'}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-[#d4af37] text-xs font-black">
                          {item.productPrice ? `$${parseFloat(item.productPrice).toFixed(1)}` : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 text-center py-6 bg-black/20 rounded-2xl border border-slate-850/50 border-dashed uppercase tracking-widest">
                  {isAr ? '[ طرود مجهولة أو مغلفة بطية مغلقة ]' : '[ manifest_items_locked ]'}
                </p>
              )}
            </div>

            {/* 6. Instant WhatsApp Share & Call center */}
            <div className="bg-gradient-to-r from-emerald-950/20 to-teal-950/20 border border-emerald-800/15 p-6 rounded-3xl text-start flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-start">
                <h4 className="font-extrabold text-white text-xs uppercase tracking-widest mb-1">{isAr ? 'بوابة المساعدة الفورية وجدولة التوصيل' : 'WhatsApp Delivery Dispatch'}</h4>
                <p className="text-[10px] text-slate-400">
                  {isAr ? 'تواصل المباشر مع مركز الدعم أو المندوب للاستفسار وتوجيه التوصيل لعنوانك.' : 'Contact customer care or final-mile driver regarding shipment.'}
                </p>
              </div>
              <a
                href={`https://wa.me/967777777777?text=${encodeURIComponent(
                  isAr 
                    ? `أهلاً، أود الاستعلام عن تحديثات إضافية بخصوص الشحنة الخاصة بي رقم: (${trackingData.trackingNumber}) وحالة الدفع.`
                    : `Hi alx team, I would like to inquire about my package ${trackingData.trackingNumber}.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-slate-900 border border-emerald-400/20 font-black text-xs rounded-xl flex items-center gap-2 shadow-lg hover:shadow-emerald-900/10 uppercase tracking-widest text-black shrink-0 transition-all font-sans"
              >
                <Send className="w-4 h-4 text-black" />
                {isAr ? 'افتح واتساب الآن' : 'Initiate WhatsApp Chat'}
              </a>
            </div>

            {/* 7. Administrative Live Dispatch Controller Panel (Only visible to authenticated operators) */}
            {isStaff && (
              <div className="bg-gradient-to-b from-[#18181f] to-[#121215] border border-[#d4af37]/25 p-6 rounded-3xl text-start shadow-2xl space-y-5 relative">
                <div className="absolute top-3 left-4 flex gap-2">
                  <span className="text-[8px] bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 font-bold px-2 py-0.5 rounded uppercase font-mono tracking-widest">
                    Role_Clearance: Admin/Employee
                  </span>
                </div>

                <div className="flex items-center gap-2 pb-4 border-b border-slate-800/60">
                  <Database className="w-5 h-5 text-[#d4af37] animate-pulse" />
                  <div>
                    <h3 className="font-extrabold text-[#d4af37] text-xs uppercase tracking-widest">{isAr ? 'محطة تعديل الأحداث وتحديث الشحنة' : 'Logistics Controller Hub'}</h3>
                    <p className="text-[9px] text-slate-500 uppercase font-mono font-bold">{isAr ? 'لوحة الموظفين المعتمدين والمشرفين لشركة الشحن' : 'Registered carrier telemetry & database coordinator'}</p>
                  </div>
                </div>

                {resolvedSource === 'orders_db' && (
                  <div className="p-4 bg-[#d4af37]/5 border border-[#d4af37]/20 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-start">
                      <h4 className="font-extrabold text-white text-[11px] mb-0.5">{isAr ? 'تفعيل لوحة التتبع العام للعميل' : 'Activate Public Client Portal'}</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-bold">
                        {isAr 
                          ? 'تفاصيل هذه الشحنة مخزنة فقط بقاعدة إدارة المبيعات المغلقة. يرجى ترحيلها ونشرها ليتمكن العميل من تتبعها عاماً دون تسجيل دخول بالنظام.' 
                          : 'This payload is only in Secure DB. Publish to public domain to allow the client to track without logging in.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDeployToPublic}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs rounded-xl uppercase tracking-widest transition-all shadow-md active:scale-95 shrink-0"
                    >
                      {isAr ? 'ترحيل وتفعيل الآن 🚀' : 'Authorize & Publish 🚀'}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1.5">{isAr ? 'الحدث اللوجيستي الجديد' : 'New Milestone Tag'}</label>
                    <select 
                      value={statusSelector} 
                      onChange={e => setStatusSelector(e.target.value)}
                      className="w-full bg-black/60 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-[#d4af37]/40 font-bold"
                    >
                      {orderStatusesList.map(st => (
                        <option key={st.id} value={st.nameAr}>{isAr ? st.nameAr : st.nameEn}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1.5">{isAr ? 'إحداثيات التواجد الحالية' : 'Yemen Node Coordinates'}</label>
                    <input 
                      type="text" 
                      value={gpsLocation} 
                      onChange={e => setGpsLocation(e.target.value)}
                      placeholder="الأخضر، منفذ الوديعة البري" 
                      className="w-full bg-black/60 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-[#d4af37]/40 text-start" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1.5">{isAr ? 'ملاحظات وتفاصيل الترانزيت (اختياري)' : 'Transit log details (optional)'}</label>
                  <textarea
                    rows={2}
                    value={customLogNotes}
                    onChange={e => setCustomLogNotes(e.target.value)}
                    placeholder={isAr ? 'مثال: تم فرز الصناديق وتحميل الحاوية رقم كود 88 على خط النقل الدولي...' : 'Enter tracking notes to show client on timeline...'}
                    className="w-full bg-black/60 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-[#d4af37]/40 text-start"
                  />
                </div>

                <div className="pt-3 border-t border-slate-800/40 flex justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="px-4 py-2 bg-rose-950/20 text-rose-400 hover:bg-rose-900 hover:text-white border border-rose-900/30 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                  >
                    {isAr ? 'تصفية تاريخ الأحداث' : 'Reset Timeline'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handlePushLogEvent}
                    className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-[#d4af37] text-black font-black text-xs rounded-xl uppercase tracking-widest transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-yellow-950/25"
                  >
                    {isAr ? 'حفظ وتسجيل التحديث اللوجيستي' : 'Sync Log Event'}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Dynamic empty/waiting state */}
        {!trackingData && !loading && (
          <div className="p-16 text-center border border-slate-850 bg-black/30 rounded-3xl mt-6 relative overflow-hidden backdrop-blur-sm">
            <Sparkles className="w-12 h-12 text-[#d4af37] mx-auto opacity-35 animate-pulse mb-4" />
            <h4 className="text-sm font-black text-white uppercase tracking-wider mb-2">{isAr ? 'بانتظار رصد إحداثيات الشحنة' : 'Awaiting dispatch query'}</h4>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-relaxed">
              {isAr 
                ? 'الرجاء إدخال رقم تتبع الشحنة أو رقم الهاتف في الصندوق بالأعلى للوصول لبيانات التوجيه المحدثة.' 
                : 'Enter waybill number or customer credentials to start cargo telemetry stream.'}
            </p>
          </div>
        )}

      </main>
    </div>
  );
}
