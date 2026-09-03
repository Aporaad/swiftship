import React, { useState, useEffect } from 'react';
import {
  Layers, Plus, Edit2, Trash2, CheckCircle2, ShieldCheck, ArrowUp, ArrowDown,
  Activity, ToggleLeft, ToggleRight, Settings, Info, AlertCircle, Save, X, Sparkles,
  ArrowRightLeft, FileText, Check, Filter, Search
} from 'lucide-react';
import { db } from '../lib/supabase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs } from '../lib/supabase';
import { useOrderStatuses, OrderStatusItem, DEFAULT_ORDER_STATUSES } from '../hooks/useOrderStatuses';
import { autoEntryService, AutoEntryRule, DEFAULT_AUTO_ENTRIES } from '../services/autoEntryService';
import { AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS, type AutoEntryAmountSource, getRuleAmountSources } from '../services/autoEntryRules';
import { AutoEntryAmountSourceList } from './AutoEntryAmountSourceList';
import { AutoEntryCurrencySelector } from './AutoEntryCurrencySelector';
import { useRole } from '../hooks/useRole';
import { useExchangeRates } from '../hooks/useExchangeRates';
import toast from 'react-hot-toast';

interface OrderStatusManagementTabProps {
  isAr: boolean;
  initialSubTab?: 'statuses' | 'entries';
  hideStatusManagement?: boolean;
}

export default function OrderStatusManagementTab({
  isAr,
  initialSubTab,
  hideStatusManagement = false,
}: OrderStatusManagementTabProps) {
  const { role, hasPermission } = useRole();
  const { activeCurrencies, loading: currenciesLoading } = useExchangeRates();
  const { statuses, loading: statusesLoading, getFirstStatus, getLastStatus } = useOrderStatuses();
  const [autoEntries, setAutoEntries] = useState<AutoEntryRule[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  // Granular Permissions
  const canViewStatuses = role === 'Admin' || hasPermission('view_order_statuses');
  const canAddStatus = role === 'Admin' || hasPermission('add_order_statuses');
  const canEditStatus = role === 'Admin' || hasPermission('edit_order_statuses');
  const canDeleteStatus = role === 'Admin' || hasPermission('delete_order_statuses');

  const canViewEntries = role === 'Admin' || hasPermission('view_auto_entries');
  const canAddEntry = role === 'Admin' || hasPermission('add_auto_entries');
  const canEditEntry = role === 'Admin' || hasPermission('edit_auto_entries');
  const canDeleteEntry = role === 'Admin' || hasPermission('delete_auto_entries');

  // Active Sub-Tab inside Management
  const [activeSubTab, setActiveSubTab] = useState<'statuses' | 'entries'>(() => {
    if (initialSubTab) return initialSubTab;
    if (hideStatusManagement) return 'entries';
    if (!canViewStatuses && canViewEntries) return 'entries';
    return 'statuses';
  });

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<OrderStatusItem | null>(null);

  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AutoEntryRule | null>(null);

  // Form State for Status
  const [statusFormData, setStatusFormData] = useState<Partial<OrderStatusItem>>({
    id: 1,
    nameAr: '',
    nameEn: '',
    isFirst: false,
    isLast: false,
    color: 'blue',
    code: '',
    description: ''
  });

  // Form State for Auto Entry
  const [entryFormData, setEntryFormData] = useState<Partial<AutoEntryRule>>({
    id: '',
    statusId: 1,
    nameAr: '',
    nameEn: '',
    isActive: true,
    amountSource: 'order_total',
    amountSources: ['order_total'],
    amountStrategy: 'sum',
    currency: undefined,
    skipWhenZero: true,
    debitAccount: { id: 'customer_linked', code: '1130', name: 'حساب العميل (ديناميكي)', type: 'dynamic' },
    creditAccount: { id: 'sys_profit_account', code: '4000-0001', name: 'حساب أرباح الشركة', type: 'system' },
    descriptionTempAr: '',
    descriptionTempEn: ''
  });

  const [debitType, setDebitType] = useState<'system' | 'dynamic'>('dynamic');
  const [creditType, setCreditType] = useState<'system' | 'dynamic'>('system');

  // Load auto entries and financial accounts
  useEffect(() => {
    autoEntryService.ensureAutoEntries();

    const unsubEntries = onSnapshot(collection(db, 'auto_entries'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AutoEntryRule));
      if (list.length > 0) {
        setAutoEntries(list);
      } else {
        setAutoEntries(DEFAULT_AUTO_ENTRIES);
      }
      setLoadingEntries(false);
    }, (err) => {
      console.warn('[OrderStatusManagementTab] Error loading auto_entries:', err);
      setAutoEntries(DEFAULT_AUTO_ENTRIES);
      setLoadingEntries(false);
    });

    const unsubAccs = onSnapshot(collection(db, 'accounts'), (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubEntries();
      unsubAccs();
    };
  }, []);

  // Handle Opening Status Modal
  const handleOpenAddStatus = () => {
    const nextId = statuses.length > 0 ? Math.max(...statuses.map(s => s.id)) + 1 : 1;
    setEditingStatus(null);
    setStatusFormData({
      id: nextId,
      nameAr: '',
      nameEn: '',
      isFirst: statuses.length === 0,
      isLast: false,
      color: 'blue',
      code: `stage_${nextId}`,
      description: ''
    });
    setIsStatusModalOpen(true);
  };

  const handleOpenEditStatus = (st: OrderStatusItem) => {
    setEditingStatus(st);
    setStatusFormData({ ...st });
    setIsStatusModalOpen(true);
  };

  // Save Status (Add or Edit)
  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusFormData.nameAr || !statusFormData.id) {
      toast.error(isAr ? 'يرجى إدخال اسم المرحلة ورقمها الترتيبي' : 'Please provide stage name and ID');
      return;
    }

    try {
      const targetId = Number(statusFormData.id);

      // If setting as isFirst, clear isFirst from other statuses
      if (statusFormData.isFirst) {
        for (const st of statuses) {
          if (st.id !== targetId && st.isFirst) {
            await updateDoc(doc(db, 'order_status', String(st.id)), { isFirst: false });
          }
        }
      }

      // If setting as isLast, clear isLast from other statuses
      if (statusFormData.isLast) {
        for (const st of statuses) {
          if (st.id !== targetId && st.isLast) {
            await updateDoc(doc(db, 'order_status', String(st.id)), { isLast: false });
          }
        }
      }

      const payload = {
        id: targetId,
        nameAr: statusFormData.nameAr,
        nameEn: statusFormData.nameEn || statusFormData.nameAr,
        isFirst: !!statusFormData.isFirst,
        isLast: !!statusFormData.isLast,
        sortOrder: targetId,
        color: statusFormData.color || 'blue',
        code: statusFormData.code || `stage_${targetId}`,
        description: statusFormData.description || '',
        updatedAt: Date.now()
      };

      await setDoc(doc(db, 'order_status', String(targetId)), payload, { merge: true });
      toast.success(isAr ? 'تم حفظ المرحلة بنجاح' : 'Stage saved successfully');
      setIsStatusModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save status:', err);
      toast.error(isAr ? 'حدث خطأ أثناء حفظ المرحلة' : 'Error saving status');
    }
  };

  // Delete Status
  const handleDeleteStatus = async (st: OrderStatusItem) => {
    if (statuses.length <= 1) {
      toast.error(isAr ? 'لا يمكن حذف المرحلة الوحيدة في النظام' : 'Cannot delete the only stage in the system');
      return;
    }

    const linkedRules = autoEntries.filter(e => e.statusId === st.id);
    if (linkedRules.length > 0) {
      toast.error(isAr
        ? `تعذر الحذف: هذه المرحلة مرتبطة بـ (${linkedRules.length}) قيود تلقائية. يرجى إعادة توجيه القيود أولاً.`
        : `Cannot delete: stage is linked to ${linkedRules.length} auto entries.`
      );
      return;
    }

    if (!window.confirm(isAr ? `هل أنت تأكد من حذف المرحلة: ${st.nameAr}؟` : `Are you sure you want to delete stage: ${st.nameAr}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'order_status', String(st.id)));
      toast.success(isAr ? 'تم حذف المرحلة بنجاح' : 'Stage deleted');
    } catch (err) {
      console.error('Failed to delete status:', err);
      toast.error(isAr ? 'فشل حذف المرحلة' : 'Failed to delete stage');
    }
  };

  // Auto Entry Handlers
  const handleOpenAddEntry = () => {
    setEditingEntry(null);
    const firstStatus = statuses[0]?.id || 1;
    setEntryFormData({
      id: `auto_${Date.now()}`,
      statusId: firstStatus,
      nameAr: '',
      nameEn: '',
      isActive: true,
      amountSource: 'order_total',
      amountSources: ['order_total'],
      amountStrategy: 'sum',
      currency: undefined,
      skipWhenZero: true,
      debitAccount: { id: 'customer_linked', code: '1130', name: 'حساب العميل (ديناميكي)', type: 'dynamic' },
      creditAccount: { id: 'sys_profit_account', code: '4000-0001', name: 'حساب أرباح الشركة (نظامي)', type: 'system' },
      descriptionTempAr: 'قيد تلقائي للطلب رقم: {orderNumber}',
      descriptionTempEn: 'Auto entry for order: {orderNumber}'
    });
    setDebitType('dynamic');
    setCreditType('system');
    setIsEntryModalOpen(true);
  };

  const handleOpenEditEntry = (entry: AutoEntryRule) => {
    setEditingEntry(entry);
    setEntryFormData({
      ...entry,
      amountSources: getRuleAmountSources(entry),
      amountStrategy: entry.amountStrategy || 'sum',
      currency: entry.currency || undefined,
      skipWhenZero: entry.skipWhenZero ?? true,
    });
    setDebitType(entry.debitAccount?.type || 'dynamic');
    setCreditType(entry.creditAccount?.type || 'system');
    setIsEntryModalOpen(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryFormData.nameAr || !entryFormData.statusId) {
      toast.error(isAr ? 'يرجى كتابة اسم القيد واختيار المرحلة المرتبطة' : 'Please provide rule name and stage');
      return;
    }

    try {
      const linkedStatus = statuses.find(s => s.id === Number(entryFormData.statusId));

      const payload: AutoEntryRule = {
        id: entryFormData.id || `auto_${Date.now()}`,
        statusId: Number(entryFormData.statusId),
        statusNameAr: linkedStatus ? linkedStatus.nameAr : '',
        nameAr: entryFormData.nameAr,
        nameEn: entryFormData.nameEn || entryFormData.nameAr,
        isActive: entryFormData.isActive ?? true,
        amountSource: (entryFormData.amountSources || [entryFormData.amountSource || 'order_total'])[0],
        amountSources: entryFormData.amountSources?.length
          ? entryFormData.amountSources
          : [entryFormData.amountSource || 'order_total'],
        amountStrategy: 'sum',
        currency: entryFormData.currency || undefined,
        skipWhenZero: entryFormData.skipWhenZero ?? true,
        debitAccount: entryFormData.debitAccount!,
        creditAccount: entryFormData.creditAccount!,
        descriptionTempAr: entryFormData.descriptionTempAr || entryFormData.nameAr,
        descriptionTempEn: entryFormData.descriptionTempEn || entryFormData.nameEn || entryFormData.nameAr,
        createdAt: Date.now()
      };

      await autoEntryService.saveAutoEntry(payload);
      toast.success(isAr ? 'تم حفظ القيد التلقائي بنجاح' : 'Auto entry saved');
      setIsEntryModalOpen(false);
    } catch (err) {
      console.error('Failed to save auto entry:', err);
      toast.error(isAr ? 'حدث خطأ في حفظ القيد التلقائي' : 'Failed to save auto entry');
    }
  };

  const handleToggleEntryActive = async (rule: AutoEntryRule) => {
    try {
      await autoEntryService.saveAutoEntry({
        ...rule,
        isActive: !rule.isActive
      });
      toast.success(rule.isActive ? (isAr ? 'تم إيقاف القيد التلقائي' : 'Disabled') : (isAr ? 'تم تفعيل القيد التلقائي' : 'Enabled'));
    } catch (err) {
      console.error('Failed to toggle entry:', err);
    }
  };

  const handleDeleteEntry = async (ruleId: string) => {
    if (!window.confirm(isAr ? 'هل أنت تأكد من حذف هذا القيد التلقائي؟' : 'Are you sure you want to delete this auto entry?')) return;
    try {
      await autoEntryService.deleteAutoEntry(ruleId);
      toast.success(isAr ? 'تم حذف القيد التلقائي' : 'Deleted auto entry');
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  // Color options for badges
  const COLOR_OPTIONS = [
    { id: 'amber', labelAr: 'كهرماني', labelEn: 'Amber', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
    { id: 'blue', labelAr: 'أزرق', labelEn: 'Blue', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
    { id: 'indigo', labelAr: 'نيلي', labelEn: 'Indigo', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-400' },
    { id: 'purple', labelAr: 'بنفسجي', labelEn: 'Purple', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
    { id: 'orange', labelAr: 'برتقالي', labelEn: 'Orange', bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400' },
    { id: 'cyan', labelAr: 'سماوي غامق', labelEn: 'Cyan', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400' },
    { id: 'sky', labelAr: 'سماوي فاتح', labelEn: 'Sky', bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-400' },
    { id: 'emerald', labelAr: 'زمردي/أخضر', labelEn: 'Emerald', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    { id: 'rose', labelAr: 'وردي/أحمر', labelEn: 'Rose', bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400' }
  ];

  const getColorStyle = (colorId?: string) => {
    return COLOR_OPTIONS.find(c => c.id === colorId) || COLOR_OPTIONS[1];
  };

  const AMOUNT_SOURCE_OPTIONS = AUTO_ENTRY_AMOUNT_SOURCE_OPTIONS;

  const dynamicAccountOptions = [
    { id: 'customer_linked', code: '1130', nameAr: '👤 حساب العميل المرتبط بالطلب (ديناميكي)', nameEn: 'Customer Account (Dynamic)' },
    { id: 'payment_account_selected', code: '1110', nameAr: '💳 حساب الدفع/التحصيل المختار للطلب (ديناميكي)', nameEn: 'Selected Payment Receiving Account (Dynamic)' },
    { id: 'delivery_courier_linked', code: '2120', nameAr: '🛵 حساب مندوب التوصيل المرتبط بالطلب', nameEn: 'Delivery courier account (Dynamic)' },
    { id: 'shipping_courier_linked', code: '2120', nameAr: '🚚 حساب مندوب/وكيل الشحن المرتبط بالطلب', nameEn: 'Shipping courier account (Dynamic)' },
    { id: 'courier_linked', code: '2120', nameAr: '🛵 حساب المندوب المرتبط بالطلب (توافق سابق)', nameEn: 'Courier account (Legacy dynamic)' },
    { id: 'purchase_source_linked', code: '2110', nameAr: '🧾 حساب مصدر شراء المنتجات المرتبط', nameEn: 'Purchase source account (Dynamic)' },
    { id: 'shipping_company_linked', code: '2115', nameAr: '🚛 حساب شركة الشحن المرتبطة', nameEn: 'Shipping company account (Dynamic)' },
    { id: 'product_cost_source', code: '5100-4483', nameAr: '📦 مصدر تكلفة المنتجات: المندوب عند تحديده أو حساب تكاليف الطلب', nameEn: 'Product cost source: courier or order-cost account' },
    { id: 'order_cost_account', code: '5100-4483', nameAr: '📦 حساب تكاليف الطلبات النظامي', nameEn: 'Order costs system account' }
  ];

  return (
    <div className="space-y-6 text-start font-sans">

      {/* Top Banner & Header */}
      <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-[#d4af37]/10 border border-[#d4af37]/30 p-3.5 rounded-2xl text-[#d4af37] shrink-0">
              <Layers className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#d4af37] bg-[#d4af37]/10 border border-[#d4af37]/20 px-2 py-0.5 rounded-md">
                  {isAr ? 'نظام التحكم بمراحل الشحنات والقيود' : 'Status & Auto Entry Engine'}
                </span>
              </div>
              <h2 className="text-base font-black text-white mt-1">
                {isAr ? 'إدارة حالات الطلب والقيود التلقائية المربوطة والمراحل' : 'Order Statuses & Auto Entry Rules Studio'}
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {isAr
                  ? 'يمكنك إضافة وتعديل مراحل الطلب بالترتيب الرقمي (id)، وتحديد مرحلة البداية والنهاية، وإنشاء قيود محاسبية تلقائية تنفذ فور وصول الطلب لأي مرحلة.'
                  : 'Manage dynamic order status sequence (by stage ID), configure first/last milestones, and build automated ledger entries executed on stage transition.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canAddStatus && (
              <button
                type="button"
                onClick={handleOpenAddStatus}
                className="bg-gradient-to-r from-[#d4af37] to-amber-600 hover:from-amber-600 hover:to-[#d4af37] text-black font-black text-xs px-4 py-2.5 rounded-xl shadow-lg transition active:scale-95 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {isAr ? 'إضافة مرحلة جديدة' : 'Add New Stage'}
              </button>
            )}
            {canAddEntry && (
              <button
                type="button"
                onClick={handleOpenAddEntry}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-750 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow transition active:scale-95 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'إضافة قيد تلقائي' : 'Add Auto Entry'}
              </button>
            )}
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-2 border-t border-slate-900 pt-4 mt-5">
          {canViewStatuses && !hideStatusManagement && (
            <button
              type="button"
              onClick={() => setActiveSubTab('statuses')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${activeSubTab === 'statuses'
                ? 'bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#d4af37]'
                : 'bg-black/30 border border-slate-850 text-slate-400 hover:text-white'
                }`}
            >
              <Layers className="w-4 h-4" />
              {isAr ? 'مراحل وحالات الطلب' : 'Order Status Stages'}
              <span className="bg-black/50 text-white text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-800">
                {statuses.length}
              </span>
            </button>
          )}

          {canViewEntries && (
            <button
              type="button"
              onClick={() => setActiveSubTab('entries')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${activeSubTab === 'entries'
                ? 'bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#d4af37]'
                : 'bg-[#d4af37]/5 border border-slate-850 text-slate-400 hover:text-white'
                }`}
            >
              <Sparkles className="w-4 h-4 text-[#d4af37]" />
              {isAr ? 'جدول القيود التلقائية للمراحل' : 'Auto Entry Rules Table'}
              <span className="bg-black/50 text-[#d4af37] text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-800">
                {autoEntries.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* SEARCH / FILTER BAR */}
      <div className="flex items-center justify-between gap-4 bg-[#121215] border border-slate-850 p-3 rounded-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم أو الكود أو رقم المرحلة...' : 'Search stages or auto entries...'}
            className="w-full bg-black/40 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#d4af37]"
          />
        </div>
      </div>

      {/* SECTION 1: ORDER STATUSES STAGES */}
      {activeSubTab === 'statuses' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {statuses
              .filter(st => !searchQuery || st.nameAr.includes(searchQuery) || st.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) || String(st.id).includes(searchQuery))
              .map((st) => {
                const colorStyle = getColorStyle(st.color);
                const linkedRules = autoEntries.filter(r => r.statusId === st.id);

                return (
                  <div
                    key={st.id}
                    className={`bg-gradient-to-br from-[#121215] to-[#08080a] border rounded-3xl p-5 shadow-lg relative flex flex-col justify-between transition-all hover:border-[#d4af37]/40 ${st.isFirst ? 'border-amber-500/50' : st.isLast ? 'border-emerald-500/50' : 'border-slate-850'
                      }`}
                  >
                    <div className="space-y-3">
                      {/* Top Bar with Stage ID and Badges */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-750 text-[#d4af37] font-mono font-black text-sm flex items-center justify-center shadow">
                            {st.id}
                          </span>
                          <div>
                            <span className="text-[10px] font-mono uppercase text-slate-500 block">
                              {isAr ? `مرحلة ID: ${st.id}` : `Stage #${st.id}`}
                            </span>
                            {st.code && (
                              <span className="text-[9px] font-mono text-slate-600 block">
                                {st.code}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {st.isFirst && (
                            <span className="text-[10px] font-black bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-lg flex items-center gap-1">
                              ⭐ {isAr ? 'البداية' : 'First'}
                            </span>
                          )}
                          {st.isLast && (
                            <span className="text-[10px] font-black bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-lg flex items-center gap-1">
                              🏁 {isAr ? 'التسليم النهائي' : 'Last'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Names */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-xl text-xs font-black border ${colorStyle.bg} ${colorStyle.border} ${colorStyle.text}`}>
                            {st.nameAr}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-slate-400 mt-1.5">
                          {st.nameEn}
                        </p>
                        {st.description && (
                          <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                            {st.description}
                          </p>
                        )}
                      </div>

                      {/* Linked Auto Entries Count */}
                      <div className="bg-black/30 border border-slate-900 rounded-2xl p-2.5 flex items-center justify-between text-xs">
                        <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                          {isAr ? 'القيود التلقائية المرتبطة:' : 'Linked Auto Entries:'}
                        </span>
                        <span className={`font-mono font-black text-xs px-2 py-0.5 rounded-md ${linkedRules.length > 0 ? 'bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30' : 'text-slate-600'
                          }`}>
                          {linkedRules.length} {isAr ? 'قيد' : 'rule(s)'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-slate-900 mt-4 flex items-center justify-end gap-2">
                      {canEditStatus && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditStatus(st)}
                          className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
                          title={isAr ? 'تعديل المرحلة' : 'Edit Stage'}
                        >
                          <Edit2 className="w-4 h-4 text-[#d4af37]" />
                        </button>
                      )}
                      {canDeleteStatus && (
                        <button
                          type="button"
                          onClick={() => handleDeleteStatus(st)}
                          className="p-2 bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900 rounded-xl text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          title={isAr ? 'حذف المرحلة' : 'Delete Stage'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* SECTION 2: AUTO ENTRIES RULES */}
      {activeSubTab === 'entries' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {autoEntries
              .filter(e => !searchQuery || e.nameAr.includes(searchQuery) || (e.nameEn && e.nameEn.toLowerCase().includes(searchQuery.toLowerCase())))
              .map((entry) => {
                const linkedStatus = statuses.find(s => s.id === entry.statusId);
                const statusColor = getColorStyle(linkedStatus?.color);

                return (
                  <div
                    key={entry.id}
                    className={`bg-gradient-to-br from-[#121215] to-[#08080a] border rounded-3xl p-5 shadow-lg relative flex flex-col justify-between transition-all ${entry.isActive ? 'border-slate-850 hover:border-[#d4af37]/40' : 'border-rose-950/40 opacity-70'
                      }`}
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-black text-[#d4af37] bg-[#d4af37]/10 border border-[#d4af37]/20 px-2 py-0.5 rounded-md">
                              {entry.id}
                            </span>
                            {linkedStatus && (
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${statusColor.bg} ${statusColor.border} ${statusColor.text}`}>
                                {isAr ? `المرحلة ${linkedStatus.id}: ${linkedStatus.nameAr}` : `Stage ${linkedStatus.id}: ${linkedStatus.nameEn}`}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-black text-white mt-2">
                            {isAr ? entry.nameAr : entry.nameEn}
                          </h4>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleEntryActive(entry)}
                          className="shrink-0 transition active:scale-95"
                        >
                          {entry.isActive ? (
                            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-xl">
                              <ToggleRight className="w-4 h-4" />
                              {isAr ? 'نشط' : 'ACTIVE'}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-black px-2.5 py-1 rounded-xl">
                              <ToggleLeft className="w-4 h-4" />
                              {isAr ? 'موقوف' : 'DISABLED'}
                            </div>
                          )}
                        </button>
                      </div>

                      {/* Narration template */}
                      <div className="bg-black/30 p-3 rounded-2xl border border-slate-900 text-xs">
                        <span className="text-[9px] text-slate-500 font-bold block uppercase mb-1">
                          {isAr ? 'قالب بيان القيد التلقائي:' : 'Narration Text:'}
                        </span>
                        <p className="text-xs text-slate-300 font-sans">
                          💬 {isAr ? entry.descriptionTempAr : entry.descriptionTempEn}
                        </p>
                      </div>

                      {/* Debit and Credit Sides */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-950/60 border border-slate-900 p-3 rounded-2xl">
                          <span className="text-[10px] font-black text-emerald-400 block mb-1">
                            {isAr ? 'الطرف المدين (من حـ/)' : 'Debit Dr.'}
                          </span>
                          <span className="font-mono text-[9.5px] font-black text-slate-500 block">
                            {entry.debitAccount?.code || '—'}
                          </span>
                          <span className="text-xs font-extrabold text-slate-200 block truncate mt-0.5">
                            {entry.debitAccount?.name || '—'}
                          </span>
                        </div>

                        <div className="bg-slate-950/60 border border-slate-900 p-3 rounded-2xl">
                          <span className="text-[10px] font-black text-rose-400 block mb-1">
                            {isAr ? 'الطرف الدائن (إلى حـ/)' : 'Credit Cr.'}
                          </span>
                          <span className="font-mono text-[9.5px] font-black text-slate-500 block">
                            {entry.creditAccount?.code || '—'}
                          </span>
                          <span className="text-xs font-extrabold text-slate-200 block truncate mt-0.5">
                            {entry.creditAccount?.name || '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-slate-900 mt-4 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {isAr ? 'مصادر المبلغ: ' : 'Amount sources: '}
                        {getRuleAmountSources(entry)
                          .map(source => {
                            const option = AMOUNT_SOURCE_OPTIONS.find(item => item.id === source);
                            return isAr ? option?.labelAr : option?.labelEn;
                          })
                          .filter(Boolean)
                          .join(isAr ? ' + ' : ' + ')}
                      </span>

                      <div className="flex items-center gap-2">
                        {canEditEntry && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditEntry(entry)}
                            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4 text-[#d4af37]" />
                          </button>
                        )}
                        {canDeleteEntry && (
                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="p-2 bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900 rounded-xl text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT STATUS */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 text-start">
          <form
            onSubmit={handleSaveStatus}
            className="bg-[#121215] border border-[#d4af37]/30 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] font-sans"
          >
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-black/40 shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#d4af37]" />
                <h3 className="font-black text-white text-xs uppercase tracking-widest">
                  {editingStatus ? (isAr ? 'تعديل مرحلة طلب' : 'Edit Stage') : (isAr ? 'إضافة مرحلة جديدة للطلب' : 'Add New Stage')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="text-slate-500 hover:text-white p-1.5 bg-slate-900 border border-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">

              <div className="grid grid-cols-2 gap-4">
                {/* Stage ID */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    {isAr ? 'رقم المرحلة (ID الترتيبي) *' : 'Stage ID Number *'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={statusFormData.id || ''}
                    onChange={(e) => setStatusFormData(prev => ({ ...prev, id: parseInt(e.target.value, 10) || 1 }))}
                    className="w-full bg-black/40 border border-slate-850 rounded-xl p-3 outline-none focus:border-[#d4af37] text-white text-xs font-mono font-bold"
                  />
                </div>

                {/* Code */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    {isAr ? 'الرمز الكودي الفريد' : 'Unique Code'}
                  </label>
                  <input
                    type="text"
                    value={statusFormData.code || ''}
                    onChange={(e) => setStatusFormData(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full bg-black/40 border border-slate-850 rounded-xl p-3 outline-none focus:border-[#d4af37] text-white text-xs font-mono"
                    placeholder="e.g. stage_1"
                  />
                </div>
              </div>

              {/* Name Ar */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {isAr ? 'اسم المرحلة بالعربي *' : 'Stage Name (Arabic) *'}
                </label>
                <input
                  type="text"
                  required
                  value={statusFormData.nameAr || ''}
                  onChange={(e) => setStatusFormData(prev => ({ ...prev, nameAr: e.target.value }))}
                  className="w-full bg-black/40 border border-slate-850 rounded-xl p-3 outline-none focus:border-[#d4af37] text-white text-xs font-bold"
                  placeholder="مثال: وصل مستودع صنعاء..."
                />
              </div>

              {/* Name En */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {isAr ? 'اسم المرحلة بالإنجليزي' : 'Stage Name (English)'}
                </label>
                <input
                  type="text"
                  value={statusFormData.nameEn || ''}
                  onChange={(e) => setStatusFormData(prev => ({ ...prev, nameEn: e.target.value }))}
                  className="w-full bg-black/40 border border-slate-850 rounded-xl p-3 outline-none focus:border-[#d4af37] text-white text-xs font-bold"
                  placeholder="e.g. Arrived Sanaa Hub..."
                  style={{ direction: 'ltr' }}
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {isAr ? 'وصف المرحلة' : 'Description'}
                </label>
                <textarea
                  rows={2}
                  value={statusFormData.description || ''}
                  onChange={(e) => setStatusFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-black/40 border border-slate-850 rounded-xl p-3 outline-none focus:border-[#d4af37] text-white text-xs"
                  placeholder={isAr ? 'ملاحظات تفصيلية عن هذه المرحلة...' : 'Notes about this stage...'}
                />
              </div>

              {/* Color selection */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {isAr ? 'لون شارة المرحلة' : 'Stage Badge Color'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setStatusFormData(prev => ({ ...prev, color: c.id }))}
                      className={`p-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 ${c.bg} ${c.border} ${c.text} ${statusFormData.color === c.id ? 'ring-2 ring-[#d4af37]' : ''
                        }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-current"></span>
                      {isAr ? c.labelAr : c.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* First & Last Stage Toggles */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className={`p-3 rounded-2xl border cursor-pointer flex items-center gap-3 transition ${statusFormData.isFirst ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-black/30 border-slate-850 text-slate-400'
                  }`}>
                  <input
                    type="checkbox"
                    checked={!!statusFormData.isFirst}
                    onChange={(e) => setStatusFormData(prev => ({ ...prev, isFirst: e.target.checked }))}
                    className="rounded border-slate-700 accent-[#d4af37]"
                  />
                  <span className="text-xs font-black">
                    ⭐ {isAr ? 'المرحلة الأولى (البداية)' : 'First Stage'}
                  </span>
                </label>

                <label className={`p-3 rounded-2xl border cursor-pointer flex items-center gap-3 transition ${statusFormData.isLast ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-black/30 border-slate-850 text-slate-400'
                  }`}>
                  <input
                    type="checkbox"
                    checked={!!statusFormData.isLast}
                    onChange={(e) => setStatusFormData(prev => ({ ...prev, isLast: e.target.checked }))}
                    className="rounded border-slate-700 accent-[#d4af37]"
                  />
                  <span className="text-xs font-black">
                    🏁 {isAr ? 'المرحلة الأخيرة (التسليم)' : 'Last Stage'}
                  </span>
                </label>
              </div>

            </div>

            <div className="p-4 border-t border-slate-850 bg-black/40 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs transition cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-amber-600 hover:from-amber-600 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow transition active:scale-95 cursor-pointer"
              >
                {isAr ? 'حفظ المرحلة' : 'Save Stage'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD / EDIT AUTO ENTRY */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 text-start">
          <form
            onSubmit={handleSaveEntry}
            className="bg-[#121215] border border-[#d4af37]/30 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] font-sans"
          >
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-black/40 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#d4af37]" />
                <h3 className="font-black text-white text-xs uppercase tracking-widest">
                  {editingEntry ? (isAr ? 'تعديل قيد تلقائي' : 'Edit Auto Entry Rule') : (isAr ? 'إضافة قيد تلقائي جديد' : 'Add Auto Entry Rule')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEntryModalOpen(false)}
                className="text-slate-500 hover:text-white p-1.5 bg-slate-900 border border-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">

              {/* Linked Stage Selector */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {isAr ? 'ربط القيد بمرحلة الطلب (المرحلة الترتيبية) *' : 'Link to Order Stage *'}
                </label>
                <select
                  required
                  value={entryFormData.statusId || ''}
                  onChange={(e) => setEntryFormData(prev => ({ ...prev, statusId: Number(e.target.value) }))}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl p-3 outline-none focus:border-[#d4af37] text-xs font-bold cursor-pointer"
                >
                  {statuses.map(st => (
                    <option key={st.id} value={st.id}>
                      [{st.id}] - {st.nameAr} ({st.nameEn})
                    </option>
                  ))}
                </select>
              </div>

              {/* Entry Name Ar */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {isAr ? 'عنوان اسم القيد (عربي) *' : 'Rule Title (Arabic) *'}
                </label>
                <input
                  type="text"
                  required
                  value={entryFormData.nameAr || ''}
                  onChange={(e) => setEntryFormData(prev => ({ ...prev, nameAr: e.target.value }))}
                  className="w-full bg-black/40 border border-slate-850 rounded-xl p-3 outline-none focus:border-[#d4af37] text-white text-xs font-bold"
                  placeholder="مثال: قيد عهدة المندوب آلياً..."
                />
              </div>

              {/* Amount Sources */}
              <div className="space-y-3 border border-slate-850 bg-black/20 p-4 rounded-2xl">
                <div>
                  <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">
                    {isAr ? 'مصادر مبلغ القيد التلقائي (يمكن اختيار أكثر من مصدر)' : 'Voucher amount sources (select one or more)'}
                  </label>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {isAr ? 'يجمع النظام المصادر المختارة بعد تحويلها إلى عملة القيد المختارة.' : 'Selected sources are converted to the target currency and summed.'}
                  </p>
                </div>
                <AutoEntryAmountSourceList
                  isAr={isAr}
                  selectedSources={entryFormData.amountSources || [entryFormData.amountSource || 'order_total']}
                  onToggle={(source, checked) => setEntryFormData(previous => {
                    const current = getRuleAmountSources(previous);
                    const amountSources = checked
                      ? [...new Set([...current, source])]
                      : current.filter(item => item !== source);
                    return {
                      ...previous,
                      amountSources,
                      amountSource: amountSources[0] || 'order_total',
                    };
                  })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AutoEntryCurrencySelector
                    isAr={isAr}
                    currencies={activeCurrencies}
                    loading={currenciesLoading}
                    value={entryFormData.currency}
                    onChange={(currency) => setEntryFormData(previous => ({ ...previous, currency }))}
                  />
                  <label className="flex items-center gap-2 mt-5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entryFormData.skipWhenZero ?? true}
                      onChange={(e) => setEntryFormData(previous => ({ ...previous, skipWhenZero: e.target.checked }))}
                      className="rounded border-slate-700 accent-[#d4af37]"
                    />
                    {isAr ? 'تجاوز القيد إذا كان مجموع المصادر صفراً' : 'Skip voucher when total is zero'}
                  </label>
                </div>
                {(entryFormData.amountSources || []).includes('custom') && (
                  <label className="block space-y-1">
                    <span className="block text-[10px] font-black text-slate-400 uppercase">{isAr ? 'المبلغ الثابت المخصص' : 'Custom fixed amount'}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entryFormData.customAmount ?? ''}
                      onChange={(e) => setEntryFormData(previous => ({ ...previous, customAmount: Number(e.target.value || 0) }))}
                      className="w-full bg-black/40 border border-slate-850 rounded-xl p-3 outline-none focus:border-[#d4af37] text-white text-xs font-bold"
                    />
                  </label>
                )}
              </div>

              {/* Narration template Ar */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {isAr ? 'قالب بيان الشرح القيد المحاسبي (عربي)' : 'Narration Text (Arabic)'}
                </label>
                <input
                  type="text"
                  value={entryFormData.descriptionTempAr || ''}
                  onChange={(e) => setEntryFormData(prev => ({ ...prev, descriptionTempAr: e.target.value }))}
                  className="w-full bg-black/40 border border-slate-850 rounded-xl p-3 outline-none focus:border-[#d4af37] text-white text-xs"
                  placeholder="مثال: قيد تلقائي للطلب رقم: {orderNumber}"
                />
              </div>

              {/* DEBIT ACCOUNT (DR.) CONTROL */}
              <div className="border border-slate-850 bg-black/20 p-4 rounded-2xl space-y-3">
                <span className="text-emerald-400 text-[10.5px] font-black uppercase tracking-wider block">
                  {isAr ? 'الطرف المدين لقيد اللينك (من حـ/)' : 'Debit Account Dr.'}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDebitType('dynamic')}
                    className={`py-2 text-[10px] font-black rounded-lg border transition ${debitType === 'dynamic' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-black/35 border-slate-800 text-slate-500'
                      }`}
                  >
                    {isAr ? '👤 حساب ديناميكي' : 'Dynamic Account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebitType('system')}
                    className={`py-2 text-[10px] font-black rounded-lg border transition ${debitType === 'system' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-black/35 border-slate-800 text-slate-500'
                      }`}
                  >
                    {isAr ? '📦 حساب نظامي ثابت' : 'Fixed System Account'}
                  </button>
                </div>

                {debitType === 'dynamic' ? (
                  <select
                    value={entryFormData.debitAccount?.id || 'customer_linked'}
                    onChange={(e) => {
                      const opt = dynamicAccountOptions.find(o => o.id === e.target.value);
                      setEntryFormData(prev => ({
                        ...prev,
                        debitAccount: { id: opt!.id, code: opt!.code, name: isAr ? opt!.nameAr : opt!.nameEn, type: 'dynamic' }
                      }));
                    }}
                    className="w-full bg-[#121215] border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold cursor-pointer"
                  >
                    {dynamicAccountOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>
                        {isAr ? opt.nameAr : opt.nameEn}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={entryFormData.debitAccount?.id || ''}
                    onChange={(e) => {
                      const acc = accounts.find(a => a.id === e.target.value || a.entityId === e.target.value);
                      if (acc) {
                        setEntryFormData(prev => ({
                          ...prev,
                          debitAccount: { id: acc.entityId || acc.id, code: acc.accountCode || '', name: acc.entityName || acc.name, type: 'system' }
                        }));
                      }
                    }}
                    className="w-full bg-[#121215] border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold cursor-pointer"
                  >
                    <option value="">{isAr ? '-- اختر حساب من الشجرة --' : '-- Select System Account --'}</option>
                    {accounts.filter(a => a.entityType === 'system').map(acc => (
                      <option key={acc.id} value={acc.entityId || acc.id}>
                        [{acc.accountCode}] - {acc.entityName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* CREDIT ACCOUNT (CR.) CONTROL */}
              <div className="border border-slate-850 bg-black/20 p-4 rounded-2xl space-y-3">
                <span className="text-rose-400 text-[10.5px] font-black uppercase tracking-wider block">
                  {isAr ? 'الطرف الدائن لقيد اللينك (إلى حـ/)' : 'Credit Account Cr.'}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreditType('dynamic')}
                    className={`py-2 text-[10px] font-black rounded-lg border transition ${creditType === 'dynamic' ? 'bg-rose-500/10 border-rose-500/40 text-rose-400' : 'bg-black/35 border-slate-800 text-slate-500'
                      }`}
                  >
                    {isAr ? '👤 حساب ديناميكي' : 'Dynamic Account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreditType('system')}
                    className={`py-2 text-[10px] font-black rounded-lg border transition ${creditType === 'system' ? 'bg-rose-500/10 border-rose-500/40 text-rose-400' : 'bg-black/35 border-slate-800 text-slate-500'
                      }`}
                  >
                    {isAr ? '📦 حساب نظامي ثابت' : 'Fixed System Account'}
                  </button>
                </div>

                {creditType === 'dynamic' ? (
                  <select
                    value={entryFormData.creditAccount?.id || 'customer_linked'}
                    onChange={(e) => {
                      const opt = dynamicAccountOptions.find(o => o.id === e.target.value);
                      setEntryFormData(prev => ({
                        ...prev,
                        creditAccount: { id: opt!.id, code: opt!.code, name: isAr ? opt!.nameAr : opt!.nameEn, type: 'dynamic' }
                      }));
                    }}
                    className="w-full bg-[#121215] border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold cursor-pointer"
                  >
                    {dynamicAccountOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>
                        {isAr ? opt.nameAr : opt.nameEn}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={entryFormData.creditAccount?.id || ''}
                    onChange={(e) => {
                      const acc = accounts.find(a => a.id === e.target.value || a.entityId === e.target.value);
                      if (acc) {
                        setEntryFormData(prev => ({
                          ...prev,
                          creditAccount: { id: acc.entityId || acc.id, code: acc.accountCode || '', name: acc.entityName || acc.name, type: 'system' }
                        }));
                      }
                    }}
                    className="w-full bg-[#121215] border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold cursor-pointer"
                  >
                    <option value="">{isAr ? '-- اختر حساب من الشجرة --' : '-- Select System Account --'}</option>
                    {accounts.filter(a => a.entityType === 'system').map(acc => (
                      <option key={acc.id} value={acc.entityId || acc.id}>
                        [{acc.accountCode}] - {acc.entityName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

            </div>

            <div className="p-4 border-t border-slate-850 bg-black/40 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsEntryModalOpen(false)}
                className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs transition cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-amber-600 hover:from-amber-600 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow transition active:scale-95 cursor-pointer"
              >
                {isAr ? 'حفظ القيد التلقائي' : 'Save Auto Entry'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
