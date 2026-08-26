import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, X, AlertTriangle } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { useExpenseCategories, ExpenseCategory } from '../hooks/useExpenseCategories';
import { notificationService } from '../services/notificationService';

interface ExpenseCategoriesManagerProps {
  isAr: boolean;
}

export default function ExpenseCategoriesManager({ isAr }: ExpenseCategoriesManagerProps) {
  const categories = useExpenseCategories();
  const [accounts, setAccounts] = useState<any[]>([]);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  
  const [formData, setFormData] = useState({
    id: '',
    labelAr: '',
    labelEn: '',
    icon: '📝',
    accountId: '',
    accountCode: ''
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fetch accounts to link
    const unsubAccs = onSnapshot(collection(db, 'accounts'), (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubAccs();
  }, []);

  const handleOpenAdd = () => {
    setFormData({ id: '', labelAr: '', labelEn: '', icon: '📝', accountId: '', accountCode: '' });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (cat: ExpenseCategory) => {
    setEditingCategory(cat);
    setFormData({
      id: cat.id,
      labelAr: cat.labelAr,
      labelEn: cat.labelEn,
      icon: cat.icon || '📝',
      accountId: cat.accountId || '',
      accountCode: cat.accountCode || ''
    });
    setIsEditOpen(true);
  };

  const handleDelete = async (cat: ExpenseCategory) => {
    if (cat.isSystem) {
      notificationService.notify({
        title: isAr ? 'لا يمكن الحذف' : 'Cannot Delete',
        message: isAr ? 'هذه الفئة أساسية في النظام ولا يمكن حذفها.' : 'This is a system category and cannot be deleted.',
        type: 'error'
      });
      return;
    }

    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذه الفئة؟' : 'Are you sure you want to delete this category?')) return;

    try {
      const newArray = categories.filter(c => c.id !== cat.id);
      await setDoc(doc(db, 'settings', 'expense_categories'), { data: newArray });
      notificationService.notify({
        title: isAr ? 'تم الحذف' : 'Deleted',
        message: isAr ? 'تم حذف الفئة بنجاح.' : 'Category deleted successfully.',
        type: 'success'
      });
    } catch (e: any) {
      console.error(e);
      notificationService.notify({
        title: isAr ? 'فشل الحذف' : 'Deletion Failed',
        message: e.message,
        type: 'error'
      });
    }
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id.trim() || !formData.labelAr.trim() || !formData.labelEn.trim()) return;
    
    setIsLoading(true);
    try {
      // Find account code string
      const selectedAcc = accounts.find(a => a.id === formData.accountId || a.entityId === formData.accountId);
      const accCode = selectedAcc ? selectedAcc.accountCode : '';

      const newCat: ExpenseCategory = {
        id: formData.id,
        labelAr: formData.labelAr,
        labelEn: formData.labelEn,
        icon: formData.icon,
        accountId: formData.accountId,
        accountCode: accCode,
        isSystem: false // User created
      };
      const newArray = [...categories, newCat];
      await setDoc(doc(db, 'settings', 'expense_categories'), { data: newArray });
      
      setIsAddOpen(false);
      notificationService.notify({
        title: isAr ? 'تم الإضافة' : 'Added',
        message: isAr ? 'تم إضافة فئة المصروف بنجاح وتشجيرها.' : 'Expense category added effectively.',
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
      notificationService.notify({ title: 'Error', message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    
    setIsLoading(true);
    try {
      const selectedAcc = accounts.find(a => a.id === formData.accountId || a.entityId === formData.accountId);
      const accCode = selectedAcc ? selectedAcc.accountCode : '';

      const newArray = categories.map(c => 
        c.id === editingCategory.id 
          ? { ...c, labelAr: formData.labelAr, labelEn: formData.labelEn, icon: formData.icon, accountId: formData.accountId, accountCode: accCode }
          : c
      );

      await setDoc(doc(db, 'settings', 'expense_categories'), { data: newArray });
      
      setIsEditOpen(false);
      setEditingCategory(null);
      notificationService.notify({
        title: isAr ? 'تم التحديث' : 'Updated',
        message: isAr ? 'تم تحديث البيانات والفهرسة المحاسبية.' : 'Category bookkeeping logic updated.',
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
      notificationService.notify({ title: 'Error', message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-start">
      <div className="flex justify-between items-center bg-[#121215] border border-slate-850 p-5 rounded-3xl">
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-widest">{isAr ? 'مدير فئات وشجرة المصروفات' : 'Expense Categories Ledger'}</h2>
          <p className="text-[10px] font-bold text-slate-500 mt-1">{isAr ? 'إدارة تصنيفات المصروفات وربطها التلقائي بحسابات الأستاذ العام.' : 'Manage expense labels and map them to standard chart of accounts.'}</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-[#d4af37] hover:bg-yellow-500 text-black px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-[#d4af37]/20 flex items-center gap-2 active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          {isAr ? 'فهرسة فئة جديدة' : 'Add New Category'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-black/40 border border-slate-850 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{cat.icon}</span>
                {cat.isSystem && (
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#d4af37] bg-[#d4af37]/10 px-2 py-0.5 rounded border border-[#d4af37]/20">
                    {isAr ? 'فئة نظامية' : 'System Label'}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{isAr ? cat.labelAr : cat.labelEn}</h3>
              <p className="text-[10px] font-mono text-slate-500 mb-4">{cat.id}</p>
              
              <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-850">
                <span className="text-[9px] font-black uppercase text-emerald-400 block mb-1">{isAr ? 'الحساب المالي المرتبط (Dr.)' : 'Mapped Account'}</span>
                <span className="font-mono text-[10px] text-white">
                  {cat.accountId ? `${cat.accountCode || '----'} (Linked)` : <span className="text-slate-500 italic">{isAr ? 'غير مرتبط بشجرة الحسابات...' : 'Unmapped...'}</span>}
                </span>
              </div>
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-850/60 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleOpenEdit(cat)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg py-1.5 text-[10px] font-bold flex items-center justify-center gap-1.5 border border-slate-700">
                <Edit2 className="w-3 h-3 text-[#d4af37]" />
                {isAr ? 'تعديل الفهرسة' : 'Modify Link'}
              </button>
              {!cat.isSystem && (
                <button onClick={() => handleDelete(cat)} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-lg px-3 py-1.5 flex items-center justify-center transition">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Category Modal */}
      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={isAddOpen ? handleSaveAdd : handleSaveEdit} className="bg-[#121215] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">
                {isAddOpen ? (isAr ? 'إضافة فئة وصنف جديد' : 'Map New Category') : (isAr ? 'تحديث وتغيير مسار الفئة' : 'Edit Mapping')}
              </h3>
              <button type="button" onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {isAddOpen && (
                <div>
                  <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">{isAr ? 'معرف الفئة (ID بالإنجليزية)' : 'Category ID (English/No Spaces)'}</label>
                  <input
                    type="text"
                    required
                    value={formData.id}
                    onChange={(e) => setFormData({...formData, id: e.target.value})}
                    className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 text-white text-xs font-mono outline-none focus:border-[#d4af37]"
                    placeholder="e.g. equipment"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">{isAr ? 'الاسم باللغة العربية' : 'Arabic Name'}</label>
                <input
                  type="text"
                  required
                  value={formData.labelAr}
                  onChange={(e) => setFormData({...formData, labelAr: e.target.value})}
                  className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">{isAr ? 'الاسم باللغة الإنجليزية' : 'English Name'}</label>
                <input
                  type="text"
                  required
                  value={formData.labelEn}
                  onChange={(e) => setFormData({...formData, labelEn: e.target.value})}
                  className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-[#d4af37]"
                  style={{ direction: 'ltr' }}
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">{isAr ? 'الرمز (إيموجي)' : 'Icon Emoji'}</label>
                <input
                  type="text"
                  required
                  value={formData.icon}
                  onChange={(e) => setFormData({...formData, icon: e.target.value})}
                  className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 text-white text-xl outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-emerald-500 font-black mb-1">{isAr ? 'حساب المصروفات في الدليل المالي (الطرف المدين المرتبط)' : 'Link to Master Chart Account (Dr.)'}</label>
                <select
                  value={formData.accountId}
                  onChange={(e) => setFormData({...formData, accountId: e.target.value})}
                  className="w-full bg-slate-900 border border-emerald-500/30 text-emerald-400 rounded-xl p-3 outline-none focus:border-emerald-500 text-xs font-bold font-mono"
                >
                  <option value="">{isAr ? '-- بدون ربط محاسبي أوتوماتيكي --' : '-- No Automatic Mapping --'}</option>
                  {accounts.filter(a => a.entityType === 'system' || a.accountType === 'expense').map(a => (
                    <option key={a.id} value={a.entityId || a.id}>
                      [{a.accountCode}] - {a.entityName}
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-500 mt-1 italic">
                  {isAr 
                    ? 'سيتم توليد القيود التلقائية لتسجيل المصروف في هذا الحساب كطرف مدين.' 
                    : 'System instances will auto-generate Debit ledger rows toward this selected account code.'}
                </p>
              </div>

            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} className="px-5 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button disabled={isLoading} type="submit" className="px-5 py-2 text-xs font-black text-black bg-[#d4af37] hover:bg-yellow-500 rounded-xl active:scale-95 transition-transform">
                {isLoading ? (isAr ? 'جاري...' : 'Saving...') : (isAr ? 'حفظ وتثبيت' : 'Save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
