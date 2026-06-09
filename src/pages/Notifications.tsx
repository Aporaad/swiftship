import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, Package, CheckCircle, AlertTriangle, Clock, X, Settings2, 
  Send, Database, Key, Phone, ShieldCheck, Layers, Play, Check, 
  FileText, Info, ExternalLink, Lock, Settings, HelpCircle, Activity, Sparkles, RefreshCw
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit, writeBatch, doc } from 'firebase/firestore';
import { db, auth, safeToDate } from '../lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useRole } from '../hooks/useRole';
import { ShieldAlert } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { whatsappService, WhatsAppConfig, defaultWhatsAppConfig } from '../services/whatsappService';
import toast from 'react-hot-toast';
import { activityLogService } from '../services/activityLogService';

export default function Notifications() {
  const { settings } = useSettings();
  const isAr = settings.language === 'ar';
  
  // Tabs: 'alerts' (system notifications), 'settings' (whatsapp settings), 'logs' (whatsapp dispatch logs)
  const [activeTab, setActiveTab] = useState<'alerts' | 'settings' | 'logs'>('alerts');
  
  // State variables
  const [notifications, setNotifications] = useState<any[]>([]);
  const { role, hasPermission, loading: roleLoading } = useRole();
  const canSendNotif = role === 'Admin' || hasPermission('send_notifications');
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  
  // WhatsApp Settings state
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig>(defaultWhatsAppConfig);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // WhatsApp Delivery Logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  
  // Test message tool states
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Test connection states
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string; isWarning?: boolean } | null>(null);

  // active text reference in template editor
  const [activeTemplateField, setActiveTemplateField] = useState<'onOrderCreated' | 'onOrderStatusChanged' | 'onPaymentReceived' | null>(null);
  const templateRefs = {
    onOrderCreated: useRef<HTMLTextAreaElement>(null),
    onOrderStatusChanged: useRef<HTMLTextAreaElement>(null),
    onPaymentReceived: useRef<HTMLTextAreaElement>(null)
  };

  // 1. Listen to system notifications — filtered by role's notification category permissions
  useEffect(() => {
    if (roleLoading) return;
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const isAdmin = role === 'Admin';
      const canOrderNotif = isAdmin || hasPermission('notify_orders');
      const canFinanceNotif = isAdmin || hasPermission('notify_finance');
      const canSystemNotif = isAdmin || hasPermission('notify_system');
      const allNotifs = snap.docs.map(d => {
        const data = d.data() as any;
        return { id: d.id, ...data, createdAt: safeToDate(data.createdAt) };
      });
      // Strict category filtering — only show categories the user has permission for
      const filtered = allNotifs.filter(n => {
        if (!isAdmin) {
          const isCreator = n.creatorId === auth.currentUser?.uid;
          const isTarget = n.userId === auth.currentUser?.uid;
          const isAssociated = n.associatedUserIds?.includes(auth.currentUser?.uid);
          if (!isCreator && !isTarget && !isAssociated) return false;
        }
        const cat = n.category || 'system';
        if (cat === 'order') return canOrderNotif;
        if (cat === 'finance') return canFinanceNotif;
        if (cat === 'system') return canSystemNotif;
        return isAdmin; // unknown categories only for Admin
      });
      setNotifications(filtered);
      setLoadingAlerts(false);
    }, (error) => {
      console.error('Error fetching alerts:', error);
      setLoadingAlerts(false);
    });
    return unsub;
  }, [roleLoading, role, hasPermission]);

  // 2. Fetch WhatsApp Configurations on startup
  useEffect(() => {
    async function loadConfig() {
      try {
        const conf = await whatsappService.getConfig();
        setWhatsappConfig(conf);
        
        // Auto initialize test message template
        setTestMessage(isAr ? 'رسالة تجريبية لتأكيد الاتصال ببوابة WhatsApp اللوجيستية للشركة 🚀' : 'Test message to confirm connection to company WhatsApp logistics gateway 🚀');
      } catch (err) {
        console.error('Error reading WhatsApp config:', err);
      } finally {
        setLoadingConfig(false);
      }
    }
    loadConfig();
  }, [isAr]);

  // 3. Listen to WhatsApp logs in real-time
  useEffect(() => {
    const qLogs = query(collection(db, 'whatsapp_logs'), orderBy('createdAt', 'desc'), limit(150));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(d => {
        const data = d.data() as any;
        return { id: d.id, ...data, createdAt: safeToDate(data.createdAt) };
      }));
      setLoadingLogs(false);
    }, (error) => {
      console.error('Error fetching logs:', error);
      setLoadingLogs(false);
    });
    return unsubLogs;
  }, []);

  const markAllAsRead = async () => {
    // Requires manage_notifications permission
    if (role !== 'Admin' && !hasPermission('manage_notifications')) {
      toast.error(isAr ? 'لا تملك صلاحية إدارة الإشعارات' : 'No permission to manage notifications');
      return;
    }
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read).forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
      activityLogService.log('mark_all_read', 'All Notifications');
      toast.success(isAr ? 'تم تحديد جميع الإشعارات كمقروءة' : 'Marked all as read');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error executing action');
    }
  };

  const markAsRead = async (id: string, read: boolean) => {
    if (read) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'notifications', id), { read: true });
      await batch.commit();
    } catch (e) {
      console.error(e);
    }
  };

  // Save WhatsApp Webhook/Config — guarded by manage_whatsapp
  const handleSaveWhatsAppConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'Admin' && !hasPermission('manage_whatsapp')) {
      toast.error(isAr ? 'لا تملك صلاحية تعديل إعدادات WhatsApp' : 'No permission to edit WhatsApp settings');
      return;
    }
    setIsSaving(true);
    try {
      await whatsappService.saveConfig(whatsappConfig);
      activityLogService.log('save_whatsapp_settings', whatsappConfig.provider);
      toast.success(isAr ? 'تم حفظ إعدادات وقوالب WhatsApp بنجاح!' : 'WhatsApp config and templates saved successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  // Direct manual test trigger — guarded by send_notifications
  const handleSendTestMessage = async () => {
    if (role !== 'Admin' && !hasPermission('send_notifications')) {
      toast.error(isAr ? 'لا تملك صلاحية إرسال إشعارات مخصصة' : 'No permission to send custom notifications');
      return;
    }
    if (!testPhone) {
      toast.error(isAr ? 'الرجاء إدخال رقم الهاتف للتجربة' : 'Please input a test phone number');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await whatsappService.sendDirect(testPhone, testMessage, 'TEST-ID', 'direct-debugger');
      setTestResult(result);
      if (result.success) {
        activityLogService.log('send_test_whatsapp', testPhone, { message: testMessage });
        toast.success(isAr ? 'تم إرسال رسالة تجريبية بنجاح!' : 'Test message emitted successfully!');
      } else {
        toast.error(isAr ? `فشل الإرسال: ${result.errorMsg || ''}` : `Emit failed: ${result.errorMsg || ''}`);
      }
    } catch (err: any) {
      console.error(err);
      setTestResult({ success: false, status: 'Failed', errorMsg: err.message });
      toast.error(err.message || 'Diagnostic error');
    } finally {
      setIsTesting(false);
    }
  };

  // Trigger dummy credential connections test to active provider
  const handleTestConnection = async () => {
    if (role !== 'Admin' && !hasPermission('manage_whatsapp')) {
      toast.error(isAr ? 'لا تملك صلاحية تعديل إعدادات WhatsApp' : 'No permission to edit WhatsApp settings');
      return;
    }
    setIsTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await whatsappService.testConnection(whatsappConfig.provider, whatsappConfig.config);
      setConnectionStatus(res);
      if (res.success) {
        if (res.isWarning) {
          toast.success(isAr ? 'تم فحص الاتصال بالبوابة مع وجود تحذيرات!' : 'Gateway connection checked with warnings!');
        } else {
          toast.success(isAr ? 'تم التحقق من الاتصال بالبوابة بنجاح!' : 'Gateway connection verified successfully!');
        }
      } else {
        toast.error(isAr ? `فشل فحص الاتصال: ${res.message}` : `Connection check failed: ${res.message}`);
      }
    } catch (err: any) {
      console.error(err);
      setConnectionStatus({ success: false, message: err.message || 'Connection test error' });
      toast.error(err.message || 'Gateway connection failed');
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Add template variable tags directly at cursor
  const insertTag = (tag: string, field: 'onOrderCreated' | 'onOrderStatusChanged' | 'onPaymentReceived') => {
    const textarea = templateRefs[field].current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = whatsappConfig.templates[field];
    const newText = text.substring(0, start) + tag + text.substring(end);

    setWhatsappConfig({
      ...whatsappConfig,
      templates: {
        ...whatsappConfig.templates,
        [field]: newText
      }
    });

    // Reset cursor focus
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'order': return <Package className="w-5 h-5 text-cyan-400" />;
      case 'alert': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      default: return <Bell className="w-5 h-5 text-[#d4af37]" />;
    }
  };

  // Tag helper chips
  const placechips = [
    { tag: '{customerName}', ar: 'اسم الزبون', en: 'Client Name' },
    { tag: '{orderNumber}', ar: 'رقم الفاتورة/الطلب', en: 'Invoice ID' },
    { tag: '{trackingNumber}', ar: 'رقم التتبع الموحد', en: 'Tracking Number' },
    { tag: '{shippingCompany}', ar: 'قناة الشحن', en: 'Shipping' },
    { tag: '{orderStatus}', ar: 'الحالة اللوجستية', en: 'Status' },
    { tag: '{locationYemen}', ar: 'الموقع الحالي في اليمن', en: 'Position' },
    { tag: '{totalCost}', ar: 'التكلفة الكلية للطلب YER', en: 'Total Price' },
    { tag: '{amountPaid}', ar: 'المبلغ المدفوع حركياً YER', en: 'Paid Amt' },
    { tag: '{amountRemaining}', ar: 'المبالغ المتبقية للامتياز YER', en: 'Remaining Bal' },
    { tag: '{totalCostSaved}', ar: 'إجمالي السداد المتراكم YER', en: 'Total Setlled' }
  ];

  // Page guard: must have view_notifications
  if (!roleLoading && role !== 'Admin' && !hasPermission('view_notifications')) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-800 shadow-xl text-center select-none">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide">{isAr ? 'وصول مقيد' : 'Access Denied'}</h2>
        <p className="text-slate-500 max-w-md">{isAr ? 'لا تملك صلاحية عرض الإشعارات. تواصل مع مديرك لطلب الصلاحية.' : 'You do not have permission to view notifications. Contact your administrator.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 text-start font-sans selection:bg-[#d4af37]/30">
      
      {/* Dynamic Upper Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-br from-slate-900 via-[#121215] to-black border border-slate-800 p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-4">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-3.5 rounded-2xl text-[#d4af37] shadow-[0_4px_15px_rgba(212,175,55,0.15)] shrink-0 animate-pulse">
            <Bell className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight leading-tight mb-1">
              {isAr ? 'نظام السيطرة والاتصال اللوجيستي الموحد' : 'Unified Logistics Network & Alerts'}
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping"></span>
              {isAr ? 'إدارة قوالب المعاملات • ربط بوابات WhatsApp • تقارير التسليم اللحظي' : 'LIVELINK • WhatsApp API configuration & automated triggers'}
            </p>
          </div>
        </div>

          {/* Navigation Tabs */}
          <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-slate-850 self-stretch md:self-auto gap-1">
            <button 
              type="button"
              onClick={() => setActiveTab('alerts')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === 'alerts' ? 'bg-[#d4af37] text-black shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'}`}
            >
              <Bell className="w-3.5 h-3.5" />
              {isAr ? 'الإشعارات العامة' : 'Alerts'}
              {notifications.filter(n => !n.read).length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${activeTab === 'alerts' ? 'bg-black text-white' : 'bg-[#d4af37] text-black font-extrabold'}`}>
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            
            {(role === 'Admin' || hasPermission('manage_whatsapp')) && (
              <>
                <button 
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === 'settings' ? 'bg-[#d4af37] text-black shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'}`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  {isAr ? 'إعدادات وقوالب WhatsApp' : 'WhatsApp Settings'}
                </button>
                
                <button 
                  type="button"
                  onClick={() => setActiveTab('logs')}
                  className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === 'logs' ? 'bg-[#d4af37] text-black shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'}`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  {isAr ? 'سجلات الإرسال' : 'Delivery Logs'}
                </button>
              </>
            )}
          </div>
        </div>

      {/* 1. Alerts Tab content */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <span className="text-slate-400 text-xs font-black">{isAr ? `إجمالي الإشعارات داخل النظام: ${notifications.length}` : `Operational alerts history: ${notifications.length}`}</span>
            {notifications.some(n => !n.read) && (
              <button 
                onClick={markAllAsRead}
                className="text-amber-400 hover:text-[#d4af37] text-xs font-bold cursor-pointer transition select-none flex items-center gap-1"
              >
                <Check className="w-4 h-4" />
                {isAr ? 'تحديد الكل كمقروء' : 'Mark all as read'}
              </button>
            )}
          </div>

          <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden shadow-2xl">
            {loadingAlerts ? (
              <div className="p-20 text-center text-slate-500 font-bold font-mono tracking-widest animate-pulse">
                <RefreshCw className="w-8 h-8 text-[#d4af37] animate-spin mx-auto mb-2" />
                <span>[ POLL_ALERT_QUEUE ]</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-20 text-center text-slate-600 font-bold uppercase tracking-widest font-mono text-xs max-w-md mx-auto space-y-2">
                <Bell className="w-12 h-12 text-slate-805 mx-auto opacity-60" />
                <p className="text-white text-sm">{isAr ? 'قائمة الواردات اللوجيستية فارغة حالياً' : 'No notification logs recorded yet'}</p>
                <p className="text-[10px] text-slate-500">{isAr ? 'سيتم سرد الإشعارات المتعلقة بإنشاء الشحنات والتحويلات المالية هنا مباشرة.' : 'System event operations stream instantly on client updates.'}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-850 bg-black/10">
                {notifications.map(notification => (
                  <div 
                    key={notification.id} 
                    className={`p-5 hover:bg-[#0c0c0f] transition-all flex gap-4 cursor-pointer relative ${!notification.read ? 'bg-[#d4af37]/5' : ''}`}
                    onClick={() => markAsRead(notification.id, notification.read)}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${!notification.read ? 'bg-black/80 border-[#d4af37]/30 text-[#d4af37]' : 'bg-[#0e0e11] border-slate-850 text-slate-450'}`}>
                      {getIcon(notification.type || notification.eventType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <h3 className={`text-xs truncate ${!notification.read ? 'font-black text-white' : 'font-extrabold text-slate-400'}`}>
                          {notification.title}
                        </h3>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold font-mono shrink-0">
                          <Clock className="w-3.5 h-3.5 text-[#d4af37]/70" />
                          {notification.createdAt ? formatDistanceToNow(notification.createdAt, { addSuffix: true, locale: ar }) : ''}
                        </div>
                      </div>
                      <p className={`text-xs leading-relaxed ${!notification.read ? 'text-slate-200 font-bold' : 'text-slate-500'}`}>
                        {notification.message}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="flex items-center justify-center shrink-0 pl-1">
                        <div className="w-2.5 h-2.5 bg-[#d4af37] rounded-full animate-pulse shadow-[0_0_10px_#d4af37]"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. WhatsApp Settings & Template Builder Tab content */}
      {activeTab === 'settings' && (role === 'Admin' || hasPermission('manage_whatsapp')) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Settings Parameters Form - ColSpan 2 */}
          <div className="lg:col-span-2 space-y-6">
            
            {loadingConfig ? (
              <div className="bg-[#121215] border border-slate-850 p-20 rounded-3xl text-center font-mono">
                <RefreshCw className="w-8 h-8 text-[#d4af37] animate-spin mx-auto mb-2" />
                <span>[ LOADING_CONFIG_LEDGERS ]</span>
              </div>
            ) : (
              <form onSubmit={handleSaveWhatsAppConfig} className="space-y-6">
                
                {/* Global Enable toggle / Provider Select */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
                  
                  <div className="flex items-center justify-between pb-4 border-b border-slate-850">
                    <div className="space-y-1">
                      <span className="text-[10px] text-[#d4af37] font-black uppercase tracking-widest">{isAr ? 'الخدمات السحابية اللوجستية' : 'Cloud Courier dispatch gateway'}</span>
                      <h3 className="text-white text-base font-black leading-tight">{isAr ? 'الحالة الكلية للخدمة والبوابة' : 'WhatsApp Delivery Engine State'}</h3>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={whatsappConfig.enabled}
                        onChange={(e) => setWhatsappConfig({ ...whatsappConfig, enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-14 h-7 bg-slate-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-[#d4af37] dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-slate-400 peer-checked:after:bg-black after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#d4af37] transition duration-300"></div>
                    </label>
                  </div>

                  {/* Provider Grid Cards */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block">{isAr ? 'اختر مزود بوابة الإرسال المدمج' : 'Supported Gateways'}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      
                      {/* Ultramsg Card */}
                      <div 
                        onClick={() => setWhatsappConfig({ ...whatsappConfig, provider: 'ultramsg' })}
                        className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between h-32 ${whatsappConfig.provider === 'ultramsg' ? 'bg-[#d4af37]/5 border-[#d4af37] text-white shadow-md' : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800'}`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-mono text-[10px] bg-sky-950/50 text-sky-400 border border-sky-950/70 px-2 py-0.5 rounded font-bold uppercase font-sans">ULTRAMSG (الموصى به)</span>
                          {whatsappConfig.provider === 'ultramsg' && <CheckCircle className="w-5 h-5 text-[#d4af37]" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-100">{isAr ? 'بوابة UltraMsg اللحظية' : 'UltraMsg Instalink'}</h4>
                          <p className="text-[10px] text-slate-500 leading-normal mt-1">{isAr ? 'الأكثر وثوقية وشهرة بالشرق الأوسط لسرعة ربط الباركود السريع.' : 'Instant setup via simple browser QR scans.'}</p>
                        </div>
                      </div>

                      {/* Twilio Card */}
                      <div 
                        onClick={() => setWhatsappConfig({ ...whatsappConfig, provider: 'twilio' })}
                        className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between h-32 ${whatsappConfig.provider === 'twilio' ? 'bg-[#d4af37]/5 border-[#d4af37] text-white shadow-md' : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800'}`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-mono text-[10px] bg-red-950/50 text-red-500 border border-red-950/70 px-2 py-0.5 rounded font-bold uppercase font-sans">TWILIO WHATSAPP</span>
                          {whatsappConfig.provider === 'twilio' && <CheckCircle className="w-5 h-5 text-[#d4af37]" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-100">{isAr ? 'خدمة Twilio API الرسمية' : 'Twilio Enterprise'}</h4>
                          <p className="text-[10px] text-slate-500 leading-normal mt-1">{isAr ? 'القناة العالمية الرسمية للشركات ذات التراخيص ومستندات الفاتورة.' : 'Official enterprise business profiles globally.'}</p>
                        </div>
                      </div>

                      {/* Custom HTTP URL Card */}
                      <div 
                        onClick={() => setWhatsappConfig({ ...whatsappConfig, provider: 'custom' })}
                        className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between h-32 ${whatsappConfig.provider === 'custom' ? 'bg-[#d4af37]/5 border-[#d4af37] text-white shadow-md' : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800'}`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-mono text-[10px] bg-purple-950/50 text-purple-400 border border-purple-950/70 px-2 py-0.5 rounded font-bold uppercase font-sans">CUSTOM HTTP WEBHOOK</span>
                          {whatsappConfig.provider === 'custom' && <CheckCircle className="w-5 h-5 text-[#d4af37]" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-100">{isAr ? 'رابط خادم بروتوكول مخصص HTTP' : 'Developer Custom API'}</h4>
                          <p className="text-[10px] text-slate-500 leading-normal mt-1">{isAr ? 'اربط مع أي ملقم خارجي أو واجهة API محلية بشكل متجاوب كلياً.' : 'Hook with custom SMS, local servers, or Webhooks.'}</p>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>

                {/* Sub-form Fields according to active provider */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
                  
                  <div className="pb-3 border-b border-slate-850">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">{isAr ? 'بيانات وإعدادات المصادقة الائتمانية للبوابة' : 'Secure API Credentials Mapping'}</h3>
                    <p className="text-[10px] text-slate-500 leading-relaxed mt-1">{isAr ? 'يرجى حظر إفشاء هذه البيانات إلا للمسؤول ومزامنتها في ملف سري.' : 'Sensitive tokens are encrypted and handled inside proxy controllers.'}</p>
                  </div>

                  {whatsappConfig.provider === 'ultramsg' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className="space-y-1.5 text-start">
                        <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{isAr ? 'رقم معرف المثيل (Instance ID) *' : 'UltraMsg Instance ID *'}</label>
                        <div className="relative">
                          <Database className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input 
                            required
                            type="text"
                            placeholder="instance9120"
                            value={whatsappConfig.config.instanceId}
                            onChange={(e) => setWhatsappConfig({
                              ...whatsappConfig,
                              config: { ...whatsappConfig.config, instanceId: e.target.value }
                            })}
                            className="w-full bg-slate-950 border border-slate-750 rounded-xl py-3 pl-11 pr-3.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-[#d4af37] focus:border-[#d4af37]"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 text-start">
                        <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{isAr ? 'رمز التوثيق السري (API Token) *' : 'UltraMsg Token Access *'}</label>
                        <div className="relative">
                          <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input 
                            required
                            type="password"
                            placeholder="••••••••••••••••••••"
                            value={whatsappConfig.config.token}
                            onChange={(e) => setWhatsappConfig({
                              ...whatsappConfig,
                              config: { ...whatsappConfig.config, token: e.target.value }
                            })}
                            className="w-full bg-slate-950 border border-slate-750 rounded-xl py-3 pl-11 pr-3.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-[#d4af37] focus:border-[#d4af37]"
                          />
                        </div>
                      </div>

                    </div>
                  )}

                  {whatsappConfig.provider === 'twilio' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5 text-start">
                          <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{isAr ? 'معرف الحساب (Account SID) *' : 'Twilio Account SID *'}</label>
                          <div className="relative">
                            <Database className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                              required
                              type="text"
                              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxx"
                              value={whatsappConfig.config.accountSid}
                              onChange={(e) => setWhatsappConfig({
                                ...whatsappConfig,
                                config: { ...whatsappConfig.config, accountSid: e.target.value }
                              })}
                              className="w-full bg-slate-950 border border-slate-750 rounded-xl py-3 pl-11 pr-3.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-[#d4af37] focus:border-[#d4af37]"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5 text-start">
                          <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{isAr ? 'رمز المرور/التوثيق (Auth Token) *' : 'Twilio Auth Token *'}</label>
                          <div className="relative">
                            <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                              required
                              type="password"
                              placeholder="••••••••••••••••••••"
                              value={whatsappConfig.config.token}
                              onChange={(e) => setWhatsappConfig({
                                ...whatsappConfig,
                                config: { ...whatsappConfig.config, token: e.target.value }
                              })}
                              className="w-full bg-slate-950 border border-slate-750 rounded-xl py-3 pl-11 pr-3.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-[#d4af37] focus:border-[#d4af37]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-start max-w-md">
                        <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{isAr ? 'رقم الهاتف المرسل الموثق (Twilio Sandbox/Live Sender) *' : 'Twilio WhatsApp Number (Sender) *'}</label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input 
                            required
                            type="text"
                            placeholder="+14155238886"
                            value={whatsappConfig.config.sender}
                            onChange={(e) => setWhatsappConfig({
                              ...whatsappConfig,
                              config: { ...whatsappConfig.config, sender: e.target.value }
                            })}
                            className="w-full bg-slate-950 border border-slate-750 rounded-xl py-3 pl-11 pr-3.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-[#d4af37] focus:border-[#d4af37]"
                          />
                        </div>
                        <p className="text-[9px] text-slate-500">{isAr ? 'ملاحظة: لشبكة Sandbox، استخدم الرقم المعطى من كود اختبار Twilio (مثال: +14155238886).' : 'Twilio requires registered phone numbers to start WhatsApp loops.'}</p>
                      </div>
                    </div>
                  )}

                  {whatsappConfig.provider === 'custom' && (
                    <div className="space-y-4">
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        <div className="md:col-span-2 space-y-1.5 text-start">
                          <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{isAr ? 'واجهة الإرسال مخصصة API Endpoint URL *' : 'HTTP API Destination URL *'}</label>
                          <input 
                            required
                            type="url"
                            placeholder="https://sms-provider.com/api/send-whatsapp?recipient={phone}&text={message}"
                            value={whatsappConfig.config.customUrl}
                            onChange={(e) => setWhatsappConfig({
                              ...whatsappConfig,
                              config: { ...whatsappConfig.config, customUrl: e.target.value }
                            })}
                            className="w-full bg-slate-950 border border-slate-750 rounded-xl py-3 px-3.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-[#d4af37] focus:border-[#d4af37]"
                          />
                        </div>

                        <div className="space-y-1.5 text-start">
                          <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{isAr ? 'طريقة البروتوكول (Method)' : 'Request Protocol'}</label>
                          <select 
                            value={whatsappConfig.config.customMethod}
                            onChange={(e) => setWhatsappConfig({
                              ...whatsappConfig,
                              config: { ...whatsappConfig.config, customMethod: e.target.value }
                            })}
                            className="w-full bg-slate-950 border border-slate-750 rounded-xl py-3 px-3.5 text-xs text-white outline-none focus:ring-1 focus:ring-[#d4af37]"
                          >
                            <option value="POST">POST</option>
                            <option value="GET">GET</option>
                            <option value="PUT">PUT</option>
                          </select>
                        </div>

                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        <div className="space-y-1.5 text-start">
                          <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{isAr ? 'ترويسة الطلب (HTTP Headers) - سطر بسطر' : 'Custom Request Headers (one per line)'}</label>
                          <textarea 
                            rows={3}
                            placeholder="Authorization: Bearer my-key&#10;api-key: d-12345"
                            value={whatsappConfig.config.customHeaders}
                            onChange={(e) => setWhatsappConfig({
                              ...whatsappConfig,
                              config: { ...whatsappConfig.config, customHeaders: e.target.value }
                            })}
                            className="w-full bg-slate-950 border border-slate-750 rounded-xl p-3 text-xs text-white placeholder-slate-600 font-mono outline-none focus:ring-1 focus:ring-[#d4af37] focus:border-[#d4af37] resize-none"
                          />
                        </div>

                        <div className="space-y-1.5 text-start">
                          <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">{isAr ? 'محتوى حزمة البيانات (Custom Payload string JSON)' : 'Request Body template (JSON)'}</label>
                          <textarea 
                            rows={3}
                            placeholder='{ "to": "{phone}", "message": "{message}" }'
                            value={whatsappConfig.config.customBody}
                            onChange={(e) => setWhatsappConfig({
                              ...whatsappConfig,
                              config: { ...whatsappConfig.config, customBody: e.target.value }
                            })}
                            className="w-full bg-slate-950 border border-slate-750 rounded-xl p-3 text-xs text-white placeholder-slate-600 font-mono outline-none focus:ring-1 focus:ring-[#d4af37] focus:border-[#d4af37] resize-none"
                          />
                        </div>

                      </div>

                      <div className="p-4 bg-purple-950/5 border border-purple-950/20 rounded-xl flex items-start gap-2 max-w-full text-[10px] text-purple-400 leading-normal">
                        <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">{isAr ? 'إرشادات مبرمج البوابة المخصصة:' : 'Developer Sandbox Guide:'}</p>
                          <p className="mt-1">{isAr ? 'سيقوم النظام باستبدال الرموز المتغيرة تلقائياً: {phone} لرقم هاتف المستلم الدولي، و {message} لنص الرسالة المكيف من قوالبك.' : 'The system replaces the wildcard placeholders {phone} and {message} with the international formatting variables dynamic results.'}</p>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Test Connection Button & Result Box */}
                  <div className="pt-4 border-t border-slate-850/60 mt-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-[10px] text-slate-500 max-w-xs md:max-w-md leading-relaxed text-start">
                        {isAr 
                          ? 'يمكنك التحقق من صلاحية مفاتيح الربط والاتصال بمزود الخدمة مباشرة دون إرسال رسالة حقيقية للعملاء.' 
                          : 'Verify credential authenticity and server connectivity directly without sending a real message.'}
                      </p>
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={isTestingConnection}
                        className="bg-slate-950 hover:bg-slate-800 text-white font-black px-4 py-2.5 rounded-xl text-xs transition border border-slate-800 hover:border-slate-700 flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer select-none"
                      >
                        {isTestingConnection ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#d4af37]" />
                        ) : (
                          <Layers className="w-3.5 h-3.5 text-[#d4af37]" />
                        )}
                        {isAr ? 'فحص الاتصال ومصادقة المفاتيح' : 'Test Connection'}
                      </button>
                    </div>

                    {connectionStatus && (
                      <div className={`p-4 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2.5 text-start ${
                        connectionStatus.success 
                          ? (connectionStatus.isWarning ? 'bg-amber-950/20 text-amber-400 border-amber-900/30' : 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30') 
                          : 'bg-rose-950/20 text-rose-400 border-rose-900/30'
                      }`}>
                        {connectionStatus.success ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <p className="font-bold">
                            {connectionStatus.success 
                              ? (isAr ? 'تم التحقق بنجاح!' : 'Connection Validated!') 
                              : (isAr ? 'فشل فحص الاتصال والتصريح وثيقة الربط:' : 'Authentication/Connection Failure:')}
                          </p>
                          <p className="opacity-90">{connectionStatus.message}</p>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                {/* Automation Rules Checkboxes */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
                  
                  <div className="pb-3 border-b border-slate-850">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">{isAr ? 'قواعد التنبيه والإرسال التلقائي' : 'Notification Dispatch Rules'}</h3>
                    <p className="text-[10px] text-slate-500 leading-relaxed mt-1">{isAr ? 'اختر متى يجب على ملقم النظام ترحيل رسالة WhatsApp للعميل.' : 'Select key triggers that authorize WhatsApp notifications.'}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Trigger 1 */}
                    <label className="bg-slate-950/20 border border-slate-850 hover:border-slate-800 p-4 rounded-2xl flex items-center justify-between cursor-pointer select-none transition">
                      <div className="space-y-1">
                        <div className="text-xs font-black text-white">{isAr ? 'تسجيل طلب جديد' : 'Order Registered'}</div>
                        <div className="text-[9px] text-slate-500">{isAr ? 'عند إنشاء شحنة بنجاح' : 'Sent when order saved'}</div>
                      </div>
                      <input 
                        type="checkbox"
                        checked={whatsappConfig.triggers.onOrderCreated}
                        onChange={(e) => setWhatsappConfig({
                          ...whatsappConfig,
                          triggers: { ...whatsappConfig.triggers, onOrderCreated: e.target.checked }
                        })}
                        className="w-4 h-4 rounded border-slate-755 text-[#d4af37] focus:ring-[#d4af37]"
                      />
                    </label>

                    {/* Trigger 2 */}
                    <label className="bg-slate-950/20 border border-slate-850 hover:border-slate-800 p-4 rounded-2xl flex items-center justify-between cursor-pointer select-none transition">
                      <div className="space-y-1">
                        <div className="text-xs font-black text-white">{isAr ? 'تحديث خط السير' : 'Logistic status change'}</div>
                        <div className="text-[9px] text-slate-500">{isAr ? 'عند تعديل حالة شحن الطرد' : 'Status path is changed'}</div>
                      </div>
                      <input 
                        type="checkbox"
                        checked={whatsappConfig.triggers.onOrderStatusChanged}
                        onChange={(e) => setWhatsappConfig({
                          ...whatsappConfig,
                          triggers: { ...whatsappConfig.triggers, onOrderStatusChanged: e.target.checked }
                        })}
                        className="w-4 h-4 rounded border-slate-755 text-[#d4af37] focus:ring-[#d4af37]"
                      />
                    </label>

                    {/* Trigger 3 */}
                    <label className="bg-slate-950/20 border border-slate-850 hover:border-slate-800 p-4 rounded-2xl flex items-center justify-between cursor-pointer select-none transition">
                      <div className="space-y-1">
                        <div className="text-xs font-black text-white">{isAr ? 'استلام دفعة مالية' : 'Payment Recorded'}</div>
                        <div className="text-[9px] text-slate-500">{isAr ? 'ترحيل سند القبض المالي' : 'When customer settles balance'}</div>
                      </div>
                      <input 
                        type="checkbox"
                        checked={whatsappConfig.triggers.onPaymentReceived}
                        onChange={(e) => setWhatsappConfig({
                          ...whatsappConfig,
                          triggers: { ...whatsappConfig.triggers, onPaymentReceived: e.target.checked }
                        })}
                        className="w-4 h-4 rounded border-slate-755 text-[#d4af37] focus:ring-[#d4af37]"
                      />
                    </label>

                  </div>

                </div>

                {/* Dynamic Template Editors */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
                  
                  <div className="pb-3 border-b border-slate-850">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">{isAr ? 'محرر وقوالب صياغة الرسائل المأتمتة' : 'Logistics Message Template Customization'}</h3>
                    <p className="text-[10px] text-slate-500 leading-relaxed mt-1">{isAr ? 'اختر القالب وقم بصياغة نصه بمساعدة الكلمات الأساسية أدناه. اضغط على أي معرف tag للمزامنة التلقائية.' : 'Configure automated messages below. Feel free to click tag labels to inject variable tokens.'}</p>
                  </div>

                  {/* Template Editors layout */}
                  <div className="space-y-4">
                    
                    {/* 1. Created template */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center bg-slate-955 px-3 py-1.5 rounded-xl border border-slate-850">
                        <span className="text-xs font-extrabold text-[#d4af37]">1. {isAr ? 'قالب شحنة جديدة ومستلمة' : 'Order registration template'}</span>
                        <span className="text-[9px] font-mono font-bold text-slate-500">onOrderCreated</span>
                      </div>
                      <textarea 
                        ref={templateRefs.onOrderCreated}
                        rows={4}
                        value={whatsappConfig.templates.onOrderCreated}
                        onFocus={() => setActiveTemplateField('onOrderCreated')}
                        onChange={(e) => setWhatsappConfig({
                          ...whatsappConfig,
                          templates: { ...whatsappConfig.templates, onOrderCreated: e.target.value }
                        })}
                        className="w-full bg-slate-950 border border-slate-750 rounded-xl p-3.5 text-xs text-white leading-relaxed outline-none focus:ring-1 focus:ring-[#d4af37] focus:border-[#d4af37]"
                      />
                    </div>

                    {/* 2. Status Changed template */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center bg-slate-955 px-3 py-1.5 rounded-xl border border-slate-850">
                        <span className="text-xs font-extrabold text-[#d4af37]">2. {isAr ? 'قالب تحديث خط السير وعقود الشحن' : 'Tracking status template'}</span>
                        <span className="text-[9px] font-mono font-bold text-slate-500">onOrderStatusChanged</span>
                      </div>
                      <textarea 
                        ref={templateRefs.onOrderStatusChanged}
                        rows={4}
                        value={whatsappConfig.templates.onOrderStatusChanged}
                        onFocus={() => setActiveTemplateField('onOrderStatusChanged')}
                        onChange={(e) => setWhatsappConfig({
                          ...whatsappConfig,
                          templates: { ...whatsappConfig.templates, onOrderStatusChanged: e.target.value }
                        })}
                        className="w-full bg-slate-950 border border-slate-750 rounded-xl p-3.5 text-xs text-white leading-relaxed outline-none focus:ring-1 focus:ring-[#d4af37] focus:border-[#d4af37]"
                      />
                    </div>

                    {/* 3. Payment Received template */}
                    <div className="space-y-2">
                       <div className="flex justify-between items-center bg-slate-955 px-3 py-1.5 rounded-xl border border-slate-850">
                        <span className="text-xs font-extrabold text-[#d4af37]">3. {isAr ? 'قالب السداد المالي وسند المحاسبة' : 'Payment receipt confirmation template'}</span>
                        <span className="text-[9px] font-mono font-bold text-slate-500">onPaymentReceived</span>
                      </div>
                      <textarea 
                        ref={templateRefs.onPaymentReceived}
                        rows={4}
                        value={whatsappConfig.templates.onPaymentReceived}
                        onFocus={() => setActiveTemplateField('onPaymentReceived')}
                        onChange={(e) => setWhatsappConfig({
                          ...whatsappConfig,
                          templates: { ...whatsappConfig.templates, onPaymentReceived: e.target.value }
                        })}
                        className="w-full bg-slate-950 border border-slate-750 rounded-xl p-3.5 text-xs text-white leading-relaxed outline-none focus:ring-1 focus:ring-[#d4af37] focus:border-[#d4af37]"
                      />
                    </div>

                    {/* Tags injection utility board */}
                    {activeTemplateField && (
                      <div className="p-4 bg-slate-955 rounded-2xl border border-slate-800 space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                          <Sparkles className="w-4 h-4 text-[#d4af37]" />
                          <span>{isAr ? `انقر لإدراج الرمز التلقائي داخل : ${activeTemplateField}` : `Click to inject variables inside ${activeTemplateField}`}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1.5">
                          {placechips.map((chip, idx) => (
                            <button 
                              key={idx}
                              type="button"
                              onClick={() => insertTag(chip.tag, activeTemplateField)}
                              className="text-[10px] font-black text-slate-300 hover:text-[#d4af37] bg-slate-900 border border-slate-800 hover:border-[#d4af37]/30 px-2.5 py-1.5 rounded-xl block transition duration-150 transform hover:scale-103"
                            >
                              <code className="text-[#d4af37] pr-1">{chip.tag}</code> • {isAr ? chip.ar : chip.en}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>

                </div>

                {/* Submitting Buttons */}
                <div className="flex justify-end pt-2">
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black px-8 py-3.5 rounded-2xl text-xs transition active:scale-95 shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-5 h-5" />
                    )}
                    {isAr ? 'حفظ وحماية إعدادات الإرسال كلياً' : 'Save WhatsApp Configuration'}
                  </button>
                </div>

              </form>
            )}

          </div>

          {/* WhatsApp Direct Messaging Tester Drawer/ColSpan-1 */}
          <div className="space-y-6">
            
            {canSendNotif && (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl"></div>
                
                <div className="pb-2 border-b border-slate-850">
                  <span className="text-[9px] text-[#d4af37] font-black bg-[#d4af37]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">{isAr ? 'مستكشف بوابة المطور' : 'API testing console'}</span>
                  <h3 className="text-white text-base font-black mt-2 leading-none">{isAr ? 'مسجل الإرسال اليدوي الفوري' : 'Direct API Sender tool'}</h3>
                  <p className="text-[10px] text-slate-500 mt-1">{isAr ? 'اختبر بوابة WhatsApp بإرسال رسالة تجريبية لأي رقم هاتف مباشرة.' : 'Validate credentials by triggering direct outbound text.'}</p>
                </div>

                {/* Input Fields */}
                <div className="space-y-3.5 text-slate-400 text-xs">
                  
                  <div className="space-y-1.5 text-start">
                    <label className="text-[10px] font-bold uppercase tracking-wider block">{isAr ? 'رقم هاتف المستلم الدولي *' : 'Recipient Phone Number *'}</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                      <input 
                        disabled={!canSendNotif}
                        type="text"
                        placeholder={canSendNotif ? "967770000000" : (isAr ? "🔒 مقيد" : "🔒 Restricted")}
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-750 rounded-xl py-3.5 pl-11 pr-3.5 text-xs text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-[#d4af37] focus:border-[#d4af37] disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <span className="text-[9px] text-slate-500 leading-tight block">{isAr ? 'ملاحظة: أدخل الرقم برمز البلد الدولي خالي من المسافات أو الفواصل (مثال لليمن: 96777000000).' : 'Enter country code followed by number without + sign (e.g. 967XXXXXXXXX).'}</span>
                  </div>

                  <div className="space-y-1.5 text-start">
                    <label className="text-[10px] font-bold uppercase tracking-wider block">{isAr ? 'نص الرسالة المبرقة *' : 'Outbound message text *'}</label>
                    <textarea 
                      rows={4}
                      placeholder={canSendNotif ? "Enter manual text..." : (isAr ? "🔒 لا تملك صلاحية إرسال رسائل تجريبية" : "🔒 No permission to send test messages")}
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-750 rounded-xl p-3.5 text-xs text-white placeholder-slate-700 leading-normal outline-none focus:ring-1 focus:ring-[#d4af37] disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!canSendNotif}
                    />
                  </div>

                  <button 
                    type="button"
                    onClick={handleSendTestMessage}
                    disabled={!canSendNotif || isTesting || !testPhone || !testMessage}
                    className="w-full bg-slate-850 hover:bg-slate-750 text-white font-black py-3.5 rounded-2xl text-xs transition active:scale-97 cursor-pointer flex items-center justify-center gap-2 border border-slate-705 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isTesting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 text-[#d4af37]" />
                    )}
                    {isAr ? 'إرسال الومضة الاختيارية للعميل' : 'Emit Outbound Test'}
                  </button>

                </div>

                {/* Interactive output screen */}
                {testResult && (
                  <div className="p-4 bg-slate-955 rounded-2xl border border-slate-800 text-[11px] font-mono leading-relaxed text-wrap break-all space-y-1.5 text-slate-400">
                    <div className="flex justify-between items-center border-b border-slate-850 pb-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-505">{isAr ? 'استجابة البوابة' : 'GATEWAY RESPONSE'}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${testResult.success ? 'bg-emerald-950/40 text-emerald-400' : 'bg-rose-950/40 text-rose-455'}`}>
                        {testResult.success ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    <div className="font-sans font-bold text-white text-xs mt-1">
                      {isAr ? 'الحالة اللوجستية:' : 'Logistic state:'} <span className="text-[#d4af37]">{testResult.status}</span>
                    </div>
                    {testResult.errorMsg && (
                      <div className="text-rose-455 text-[10px] pt-1">
                        {isAr ? 'تفاصيل الخطأ البنيوي:' : 'Error details:'} {testResult.errorMsg}
                      </div>
                    )}
                    {testResult.message && (
                      <div className="text-slate-500 text-[10px] pt-1">
                        {testResult.message}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* Config quick cheatsheet helper */}
            <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl space-y-3.5 text-[11px] text-slate-400">
              <div className="flex items-center gap-1 text-[#d4af37] font-black border-b border-slate-850 pb-2 uppercase tracking-wider text-xs">
                <Info className="w-4 h-4" />
                <span>{isAr ? 'كتيب المساعدة السريعة' : 'API Quick Documentation'}</span>
              </div>
              
              <ul className="space-y-2 list-disc list-inside leading-relaxed text-start">
                <li>{isAr ? 'لاستخدام UltraMsg، يجب مسح رمز QRCode في حساب ملقم UltraMsg لربط رقم شركتك.' : 'Before using UltraMsg, log in and link your phone using their QR code.'}</li>
                <li>{isAr ? 'الرسائل المرسلة في Sandbox لا تؤثر على رصيدك ويتم تقييد نجاح المحاكاة على السجلات مباشرة.' : 'Sandbox mode lets you verify all trigger logic without routing real API requests.'}</li>
                <li>{isAr ? 'يرجى الحظر التام لوضع الرمز (+) في مستطيلات تفاصيل الأرقام لتقادي تشويه الإرسال.' : 'Ensure numbers omit spacing symbols or trailing letters for seamless deliverability.'}</li>
              </ul>
            </div>

          </div>

        </div>
      )}

      {/* 3. Delivery Logs Tab content */}
      {activeTab === 'logs' && (role === 'Admin' || hasPermission('manage_whatsapp')) && (
        <div className="space-y-4">
          
          <div className="flex justify-between items-center px-1">
            <div>
              <span className="text-xs font-black text-slate-400">{isAr ? `إجمالي كشف سجلات الإرسال: ${logs.length}` : `Delivery audit journal: ${logs.length}`}</span>
              <span className="text-[10px] text-slate-500 block">{isAr ? 'تتم المزامنة بشكل مباشر وتحديث الحالات فور حدوثها في النظام.' : 'Live data streaming enabled via secure audit channels.'}</span>
            </div>
          </div>

          <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden shadow-2xl">
            {loadingLogs ? (
              <div className="p-20 text-center text-slate-500 font-bold font-mono tracking-widest animate-pulse">
                <RefreshCw className="w-8 h-8 text-[#d4af37] animate-spin mx-auto mb-2" />
                <span>[ OPEN_DELIVERY_LEDGERS ]</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-20 text-center text-slate-600 font-bold uppercase tracking-widest font-mono text-xs max-w-sm mx-auto space-y-2">
                <Activity className="w-12 h-12 text-slate-805 mx-auto opacity-60" />
                <p className="text-white text-sm">{isAr ? 'سجلات الإرسال خالية حالياً' : 'No outgoing WhatsApp logs found'}</p>
                <p className="text-[10px] text-slate-500">{isAr ? 'بمجرد تنشيط بوابتك وبدأ إرسال الإجراءات تلقائياً، ستتم أرشفة الإرسال وحالة الوصول هنا.' : 'Whenever WhatsApp notifications are fired, chronological logs register here.'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs text-slate-300">
                  <thead className="bg-[#18181b] border-b border-slate-800 font-black text-slate-405 text-[10px] uppercase tracking-wider text-right">
                    <tr>
                      <th className="p-4 text-center">{isAr ? 'الرقم هاتف المستلم' : 'Recipient Phone'}</th>
                      <th className="p-4">{isAr ? 'النوع/الحدث' : 'Trigger Event'}</th>
                      <th className="p-4">{isAr ? 'تفاصيل ونص الرسالة' : 'Notification Text Message'}</th>
                      <th className="p-4 text-center">{isAr ? 'الشركة/الطلب' : 'Order ID'}</th>
                      <th className="p-4 text-center">{isAr ? 'الحالة اللوجيستية' : 'Status'}</th>
                      <th className="p-4 text-center">{isAr ? 'التاريخ والزمن بالدقيقة' : 'Timestamp'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-black/20 transition-colors">
                        
                        {/* Recipient */}
                        <td className="p-4 font-mono font-bold text-center text-white select-all">
                          {log.phone}
                        </td>

                        {/* Event type */}
                        <td className="p-4 font-bold">
                          <span className="px-2 py-0.5 rounded text-[9px] bg-slate-950 border border-slate-800 text-slate-400 uppercase font-mono">
                            {log.eventType || 'manual'}
                          </span>
                        </td>

                        {/* Text message */}
                        <td className="p-4 max-w-xs text-slate-450 leading-relaxed truncate hover:text-white select-all" title={log.message}>
                          {log.message}
                        </td>

                        {/* Reference Order */}
                        <td className="p-4 text-center font-mono text-[10px] font-bold text-cyan-405">
                          {log.orderId ? (
                            <span className="border-b border-dashed border-cyan-500/30 pb-0.5 select-all text-white">
                              {log.orderId}
                            </span>
                          ) : (
                            <span className="text-slate-650">-</span>
                          )}
                        </td>

                        {/* Status Label */}
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black inline-block text-center ${
                            log.status === 'Success' ? 'bg-emerald-950/20 text-emerald-450 border border-emerald-950/40' :
                            log.status === 'Simulated' ? 'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/15' :
                            log.status === 'Skipped' ? 'bg-slate-950/30 text-slate-500 border border-slate-850' :
                            'bg-rose-950/20 text-rose-455 border border-rose-950/40 font-extrabold'
                          }`} title={log.errorMsg || ''}>
                            {log.status === 'Success' && (isAr ? 'تم الإرسال' : 'Success')}
                            {log.status === 'Simulated' && (isAr ? 'محاكاة ناجحة' : 'Simulated')}
                            {log.status === 'Skipped' && (isAr ? 'تم التخطي' : 'Skipped')}
                            {log.status === 'Failed' && (isAr ? 'قيد الفشل' : 'Failed')}
                          </span>
                          
                          {log.status === 'Failed' && log.errorMsg && (
                            <span className="block text-[9px] text-rose-450/80 font-bold tracking-tight mt-1 max-w-[120px] mx-auto truncate" title={log.errorMsg}>
                              {log.errorMsg}
                            </span>
                          )}
                        </td>

                        {/* Timestamps */}
                        <td className="p-4 text-center font-mono text-[10px] text-slate-500">
                          {log.createdAt ? log.createdAt.toLocaleString(isAr ? 'ar-EG' : 'en-US') : ''}
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
