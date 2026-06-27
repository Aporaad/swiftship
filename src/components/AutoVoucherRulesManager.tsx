import React, { useState, useEffect } from 'react';
import { 
  FileText, Activity, ToggleLeft, ToggleRight, Edit2, Check, X, Info, 
  HelpCircle, Settings, HelpCircle as HelpIcon, ArrowRightLeft, Shield, Sparkles
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, getDocs, setDoc } from 'firebase/firestore';
import { financialAccountService } from '../services/financialAccountService';
import { useAutoVoucherRules } from '../hooks/useAutoVoucherRules';

interface AutoVoucherRulesManagerProps {
  isAr: boolean;
  settings: any;
}

export default function AutoVoucherRulesManager({ isAr, settings }: AutoVoucherRulesManagerProps) {
  const { rules } = useAutoVoucherRules();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Input fields for editing
  const [editDescAr, setEditDescAr] = useState('');
  const [editDescEn, setEditDescEn] = useState('');
  const [editDebitType, setEditDebitType] = useState('system'); // 'system' or 'dynamic'
  const [editDebitSystemId, setEditDebitSystemId] = useState('');
  const [editDebitDynamicId, setEditDebitDynamicId] = useState('courier_linked');
  const [editCreditType, setEditCreditType] = useState('system'); // 'system' or 'dynamic'
  const [editCreditSystemId, setEditCreditSystemId] = useState('');
  const [editCreditDynamicId, setEditCreditDynamicId] = useState('courier_linked');

  useEffect(() => {
    // Ensure all rules exist (seeds missing defaults)
    financialAccountService.ensureAutomaticVoucherRules();

    // Sync financial accounts to select debit/credit targets
    const unsubAccs = onSnapshot(collection(db, 'accounts'), (snap) => {
      // Filter out non-system accounts for direct hardcoding, but users can see them
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubAccs();
    };
  }, []);

  const handleToggleRuleActive = async (ruleId: string, currentStatus: boolean) => {
    try {
      const newArray = rules.map(r => r.id === ruleId ? { ...r, isActive: !currentStatus } : r);
      await setDoc(doc(db, 'settings', 'automatic_voucher_rules'), { data: newArray });
    } catch (e) {
      console.error('[AutoVouchers] Failed to toggle rule status:', e);
    }
  };

  const handleOpenEdit = (rule: any) => {
    setEditingRule(rule);
    setEditDescAr(rule.descriptionTempAr || '');
    setEditDescEn(rule.descriptionTempEn || '');
    
    // Map existing Debit Account config
    const deb = rule.debitAccount;
    if (deb.id === 'courier_linked' || deb.id === 'customer_linked') {
      setEditDebitType('dynamic');
      setEditDebitDynamicId(deb.id);
    } else {
      setEditDebitType('system');
      setEditDebitSystemId(deb.id);
    }

    // Map existing Credit Account config
    const cred = rule.creditAccount;
    if (cred.id === 'courier_linked' || cred.id === 'customer_linked') {
      setEditCreditType('dynamic');
      setEditCreditDynamicId(cred.id);
    } else {
      setEditCreditType('system');
      setEditCreditSystemId(cred.id);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    setIsSaving(true);
    try {
      // Resolve Debit mapping
      let finalDeb = { id: '', code: '', name: '', type: '' };
      if (editDebitType === 'dynamic') {
        finalDeb = {
          id: editDebitDynamicId,
          code: editDebitDynamicId === 'courier_linked' ? '2120' : '1130',
          name: editDebitDynamicId === 'courier_linked' 
            ? (isAr ? 'حساب المندوب المرتبط بالشحنة (ديناميكي)' : 'Courier Linked Account (Dynamic)')
            : (isAr ? 'حساب العميل المرتبط بالشحنة (ديناميكي)' : 'Customer Linked Account (Dynamic)'),
          type: 'dynamic'
        };
      } else {
        const foundAcc = accounts.find(a => a.id === editDebitSystemId || a.entityId === editDebitSystemId);
        finalDeb = {
          id: foundAcc?.entityId || editDebitSystemId,
          code: foundAcc?.accountCode || '',
          name: foundAcc?.entityName || (isAr ? 'قيد نظامي مخصص' : 'System Account'),
          type: 'system'
        };
      }

      // Resolve Credit mapping
      let finalCred = { id: '', code: '', name: '', type: '' };
      if (editCreditType === 'dynamic') {
        finalCred = {
          id: editCreditDynamicId,
          code: editCreditDynamicId === 'courier_linked' ? '2120' : '1130',
          name: editCreditDynamicId === 'courier_linked' 
            ? (isAr ? 'حساب المندوب المرتبط بالشحنة (ديناميكي)' : 'Courier Linked Account (Dynamic)')
            : (isAr ? 'حساب العميل المرتبط بالشحنة (ديناميكي)' : 'Customer Linked Account (Dynamic)'),
          type: 'dynamic'
        };
      } else {
        const foundAcc = accounts.find(a => a.id === editCreditSystemId || a.entityId === editCreditSystemId);
        finalCred = {
          id: foundAcc?.entityId || editCreditSystemId,
          code: foundAcc?.accountCode || '',
          name: foundAcc?.entityName || (isAr ? 'قيد نظامي مخصص' : 'System Account'),
          type: 'system'
        };
      }

      const newArray = rules.map(r => r.id === editingRule.id ? {
        ...r,
        descriptionTempAr: editDescAr,
        descriptionTempEn: editDescEn,
        debitAccount: finalDeb,
        creditAccount: finalCred
      } : r);
      await setDoc(doc(db, 'settings', 'automatic_voucher_rules'), { data: newArray });

      setEditingRule(null);
    } catch (err) {
      console.error('[AutoVouchers] Failed to update rule details:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const dynamicOptions = [
    { id: 'courier_linked', labelAr: '👤 حساب عهدة المندوب الموكل (ديناميكي)', labelEn: 'Courier Linked Custody Account (Dynamic)' },
    { id: 'customer_linked', labelAr: '👥 حساب العميل ذو الشحنة (ديناميكي)', labelEn: 'Customer Linked Account (Dynamic)' },
  ];

  return (
    <div className="space-y-6 text-start">
      
      {/* Information Header Banner */}
      <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl relative overflow-hidden shadow">
        <div className="flex items-start gap-4">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-3 rounded-2xl text-[#d4af37] shrink-0">
            <Settings className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-1">
              {isAr ? 'لوحة تهيئة وإدارة القيود وأتمتة العمليات اللوجستية' : 'System Automatic Voucher Rules Studio'}
            </h3>
            <p className="text-xs text-slate-450 leading-relaxed max-w-4xl">
              {isAr 
                ? 'تسمح لك هذه الواجهة بالتحكم الكامل في القيود التلقائية التي يُنشئها النظام عند تسليم الشحنات أو وصول الحاويات. يمكنك تفعيل أو إيقاف أي قيد، تحديد حسابات المدين والدائن (الطرف الدائن والطرف المدين لكل قيد) سواءً كانت ثابتة أو مبنية ديناميكياً على المندوب/العميل المخصص، وضبط بيان القيد ليتماشى تماماً مع معايير شجرتك المحاسبية.'
                : 'Configure corporate-level automated journal posting rules on delivering cargo. Safely toggle triggers, map either rigid ledger accounts or dynamic courier/customer receivables, and fine-tune localized narration templates.'}
            </p>
          </div>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {rules.map((rule) => (
          <div 
            key={rule.id} 
            className={`bg-gradient-to-br from-[#121215] to-[#08080a] border rounded-3xl p-5 shadow-xl transition-all hover:border-slate-800 flex flex-col justify-between ${
              rule.isActive ? 'border-slate-850' : 'border-rose-950/40 opacity-75'
            }`}
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="text-[10px] uppercase font-mono font-black text-[#d4af37] tracking-widest bg-[#d4af37]/10 border border-[#d4af37]/20 px-2 py-0.5 rounded-md">
                    {rule.id}
                  </span>
                  <h4 className="text-sm font-extrabold text-white mt-2">
                    {isAr ? rule.nameAr : rule.nameEn}
                  </h4>
                </div>
                
                <button
                  type="button"
                  onClick={() => handleToggleRuleActive(rule.id, rule.isActive)}
                  className="transition active:scale-95 shrink-0"
                  title={isAr ? 'تغيير حالة القيد' : 'Toggle transaction generation'}
                >
                  {rule.isActive ? (
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-xl">
                      <ToggleRight className="w-4 h-4 text-emerald-400" />
                      {isAr ? 'نشط ومفعل' : 'ACTIVE'}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-black px-2.5 py-1 rounded-xl">
                      <ToggleLeft className="w-4 h-4 text-rose-500" />
                      {isAr ? 'موقوف ومعطل' : 'DISABLED'}
                    </div>
                  )}
                </button>
              </div>

              {/* Template Show */}
              <div className="bg-black/30 p-3 rounded-2xl border border-slate-900">
                <span className="text-[9px] text-slate-500 font-bold block uppercase mb-1">
                  {isAr ? 'بيان الشرح المالي للقيد تلقائياً:' : 'Narration Text Template:'}
                </span>
                <p className="text-xs text-slate-200 leading-normal font-sans">
                  💬 {isAr ? rule.descriptionTempAr : rule.descriptionTempEn}
                </p>
              </div>

              {/* Operations Sides (Debit vs Credit Accounts) */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="bg-slate-950/55 border border-slate-900 p-3 rounded-2xl">
                  <span className="text-[9.5px] font-black text-emerald-450 block mb-1">
                    {isAr ? 'الطرف المدين (من حـ/)' : 'Debit Account Dr.'}
                  </span>
                  <span className="font-mono text-[9.5px] font-black text-slate-600 block">
                    {rule.debitAccount?.code || '—'}
                  </span>
                  <span className="text-xs font-bold text-slate-300 block truncate mt-0.5">
                    {rule.debitAccount?.name || '—'}
                  </span>
                </div>

                <div className="bg-slate-950/55 border border-slate-900 p-3 rounded-2xl">
                  <span className="text-[9.5px] font-black text-rose-450 block mb-1">
                    {isAr ? 'الطرف الدائن (إلى حـ/)' : 'Credit Account Cr.'}
                  </span>
                  <span className="font-mono text-[9.5px] font-black text-slate-600 block">
                    {rule.creditAccount?.code || '—'}
                  </span>
                  <span className="text-xs font-bold text-slate-300 block truncate mt-0.5">
                    {rule.creditAccount?.name || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action edit rule */}
            <div className="pt-4 border-t border-slate-900 mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => handleOpenEdit(rule)}
                className="bg-slate-900 hover:bg-slate-805 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white px-3.5 py-1.5 rounded-xl font-black text-[11px] flex items-center gap-1 transition"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#d4af37]" />
                {isAr ? 'تعديل وتحديد الأطراف والبيان' : 'Configure Rule Details'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Rule Drawer Modal */}
      {editingRule && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 text-start">
          <form 
            onSubmit={handleSaveRule} 
            className="bg-[#121215] border border-[#d4af37]/25 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] font-sans"
          >
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#d4af37]" />
                <h3 className="font-black text-white text-xs uppercase tracking-widest">
                  {isAr ? 'تحديث وتعيين أطراف القيد التلقائي' : 'Configure Automation Rule Posting'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingRule(null)} 
                className="text-slate-500 hover:text-white p-1.5 bg-slate-900 border border-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              
              <div className="bg-[#d4af37]/5 border border-[#d4af37]/15 p-3 rounded-2xl text-xs text-slate-350 leading-relaxed font-sans">
                💡 <span className="font-extrabold text-white">{isAr ? 'القالب التوليدي المعياري:' : 'Rule Code ID:'}</span> {editingRule.id}
                <p className="mt-1">
                  {isAr 
                    ? 'سيقوم النظام بصرف القيد التلقائي مستبدلاً المتغيرات ({orderNumber}) بالرقم الحقيقي للشحنات المنفذة.'
                    : 'System dynamically replaces ({orderNumber}) with actual shipment values during ledger posting.'}
                </p>
              </div>

              {/* Arabic Description */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{isAr ? 'شرح وبيان القيد (عربي) *' : 'Description Template (Arabic) *'}</label>
                <input
                  type="text"
                  required
                  value={editDescAr}
                  onChange={(e) => setEditDescAr(e.target.value)}
                  className="w-full bg-black/40 border border-slate-850 rounded-xl p-3 outline-none focus:border-[#d4af37] text-white text-xs font-bold"
                  placeholder="أدخل الشرح بالعربية..."
                />
              </div>

              {/* English Description */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{isAr ? 'شرح وبيان القيد (إنجليزي) *' : 'Description Template (English) *'}</label>
                <input
                  type="text"
                  required
                  value={editDescEn}
                  onChange={(e) => setEditDescEn(e.target.value)}
                  className="w-full bg-black/40 border border-slate-850 rounded-xl p-3 outline-none focus:border-[#d4af37] text-white text-xs font-bold"
                  placeholder="Enter narration in English..."
                  style={{ direction: 'ltr' }}
                />
              </div>

              {/* DEBIT ACCOUNT (DR.) CONTROL */}
              <div className="border border-slate-850 bg-black/20 p-4 rounded-2xl space-y-4 text-start">
                <div>
                  <span className="text-emerald-450 hover:text-emerald-400 text-[10.5px] font-black uppercase tracking-wider block mb-1">
                    {isAr ? 'الطرف المدين لقيد اللينك (من حـ/)' : 'Debit Account Setup (Dr.)'}
                  </span>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setEditDebitType('system')}
                      className={`py-2 text-[10.5px] font-black rounded-lg border transition ${
                        editDebitType === 'system'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                          : 'bg-black/35 border-slate-800 text-slate-500 hover:text-slate-350'
                      }`}
                    >
                      {isAr ? '📦 حساب نظامي ثابت' : 'Fixed System Account'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditDebitType('dynamic')}
                      className={`py-2 text-[10.5px] font-black rounded-lg border transition ${
                        editDebitType === 'dynamic'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                          : 'bg-black/35 border-slate-800 text-slate-500 hover:text-slate-350'
                      }`}
                    >
                      {isAr ? '👤 حساب ديناميكي بالشحنة' : 'Dynamic Account'}
                    </button>
                  </div>
                </div>

                {editDebitType === 'system' ? (
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase">{isAr ? 'اختر الحساب النظامي المدين' : 'Select Ledger Account'}</label>
                    <select
                      value={editDebitSystemId}
                      onChange={(e) => setEditDebitSystemId(e.target.value)}
                      className="w-full bg-[#121215] border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold cursor-pointer"
                    >
                      <option value="">{isAr ? '-- اختر حساب الشجرة المحاسبية --' : '-- Choose System Account --'}</option>
                      {accounts.filter(a => a.entityType === 'system').map(acc => (
                        <option key={acc.id} value={acc.entityId || acc.id}>
                          [{acc.accountCode}] - {acc.entityName}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase">{isAr ? 'اختر الطرف الديناميكي المستهدف' : 'Select Dynamic Counterparty'}</label>
                    <select
                      value={editDebitDynamicId}
                      onChange={(e) => setEditDebitDynamicId(e.target.value)}
                      className="w-full bg-[#121215] border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold cursor-pointer"
                    >
                      {dynamicOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>
                          {isAr ? opt.labelAr : opt.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* CREDIT ACCOUNT (CR.) CONTROL */}
              <div className="border border-slate-850 bg-black/20 p-4 rounded-2xl space-y-4 text-start">
                <div>
                  <span className="text-rose-450 hover:text-rose-450 text-[10.5px] font-black uppercase tracking-wider block mb-1">
                    {isAr ? 'الطرف الدائن لقيد اللينك (إلى حـ/)' : 'Credit Account Setup (Cr.)'}
                  </span>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setEditCreditType('system')}
                      className={`py-2 text-[10.5px] font-black rounded-lg border transition ${
                        editCreditType === 'system'
                          ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                          : 'bg-black/35 border-slate-800 text-slate-500 hover:text-slate-350'
                      }`}
                    >
                      {isAr ? '📦 حساب نظامي ثابت' : 'Fixed System Account'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCreditType('dynamic')}
                      className={`py-2 text-[10.5px] font-black rounded-lg border transition ${
                        editCreditType === 'dynamic'
                          ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                          : 'bg-black/35 border-slate-800 text-slate-500 hover:text-slate-350'
                      }`}
                    >
                      {isAr ? '👤 حساب ديناميكي بالشحنة' : 'Dynamic Account'}
                    </button>
                  </div>
                </div>

                {editCreditType === 'system' ? (
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase">{isAr ? 'اختر الحساب النظامي الدائن' : 'Select Ledger Account'}</label>
                    <select
                      value={editCreditSystemId}
                      onChange={(e) => setEditCreditSystemId(e.target.value)}
                      className="w-full bg-[#121215] border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold cursor-pointer"
                    >
                      <option value="">{isAr ? '-- اختر حساب الشجرة المحاسبية --' : '-- Choose System Account --'}</option>
                      {accounts.filter(a => a.entityType === 'system').map(acc => (
                        <option key={acc.id} value={acc.entityId || acc.id}>
                          [{acc.accountCode}] - {acc.entityName}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase">{isAr ? 'اختر الطرف الديناميكي المستهدف' : 'Select Dynamic Counterparty'}</label>
                    <select
                      value={editCreditDynamicId}
                      onChange={(e) => setEditCreditDynamicId(e.target.value)}
                      className="w-full bg-[#121215] border border-slate-800 text-white rounded-xl p-2.5 outline-none text-xs font-bold cursor-pointer"
                    >
                      {dynamicOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>
                          {isAr ? opt.labelAr : opt.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

            </div>

            <div className="p-4 border-t border-slate-850 bg-[#07070a]/40 flex justify-end gap-3 shrink-0">
              <button 
                type="button" 
                onClick={() => setEditingRule(null)} 
                className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                type="submit" 
                disabled={isSaving}
                className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                {isSaving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ وضبط العمل المالي' : 'Save Rule Config')}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
