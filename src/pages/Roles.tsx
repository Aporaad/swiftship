import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Search, Edit2, X, Plus, Trash2, Shield, CheckCircle2, RefreshCw } from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useSettings } from '../context/SettingsContext';
import { notificationService } from '../services/notificationService';

import { ALL_PERMISSIONS, PERMISSION_CATEGORIES } from '../lib/permissions';

const AVAILABLE_PERMISSIONS = (t: any, lang: string) =>
  ALL_PERMISSIONS.map(p => ({
    id: p.id,
    label: lang === 'ar' ? p.labelAr : p.labelEn,
    group: lang === 'ar'
      ? (PERMISSION_CATEGORIES[p.category as keyof typeof PERMISSION_CATEGORIES]?.ar || p.category)
      : (PERMISSION_CATEGORIES[p.category as keyof typeof PERMISSION_CATEGORIES]?.en || p.category)
  }));

export default function Roles() {
  const { role: currentUserRole, hasPermission, loading: roleLoading } = useRole();
  const { settings, t } = useSettings();
  const currentPermissions = AVAILABLE_PERMISSIONS(t, settings.language);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    permissions: [] as string[]
  });
  const [saving, setSaving] = useState(false);
  const saveBlockRef = React.useRef(false);

  useEffect(() => {
    if (roleLoading) return;
    const unsub = onSnapshot(collection(db, 'roles'), (snap) => {
      const fetchedRoles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRoles(fetchedRoles);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'roles');
    });
    return unsub;
  }, [roleLoading]);

  // Auto-initialize default roles (runs separately to avoid remote snapshot loop)
  useEffect(() => {
    if (roleLoading) return;
    const initRoles = async () => {
      try {
        const snap = await getDocs(collection(db, 'roles'));
        const fetchedRoles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const defaultRoles = [
          { id: 'Admin', title: settings.language === 'ar' ? 'مدير النظام' : 'System Admin', permissions: ['*'] },
          { id: 'Employee', title: settings.language === 'ar' ? 'موظف' : 'Employee', permissions: ['view_dashboard', 'view_orders', 'add_orders', 'edit_orders', 'update_order_status', 'print_orders', 'view_customers', 'add_customers', 'edit_customers', 'view_couriers', 'add_couriers', 'edit_couriers', 'view_sources', 'add_sources', 'edit_sources', 'view_notifications', 'notify_orders', 'notify_system'] },
          { id: 'Courier', title: settings.language === 'ar' ? 'مندوب' : 'Courier', permissions: ['view_orders', 'update_order_status'] },
          { id: 'Accountant', title: settings.language === 'ar' ? 'محاسب' : 'Accountant', permissions: ['view_dashboard', 'view_orders', 'view_finance', 'add_finance', 'edit_finance', 'view_expenses', 'add_expenses', 'edit_expenses', 'view_custody', 'view_reports', 'view_sources', 'add_sources', 'edit_sources', 'view_notifications', 'notify_finance', 'notify_system'] }
        ];

        for (const dr of defaultRoles) {
          if (!fetchedRoles.find(r => r.id === dr.id)) {
            try {
              await setDoc(doc(db, 'roles', dr.id), {
                title: dr.title,
                permissions: dr.permissions,
                createdAt: Date.now(),
                isDefault: true
              }, { merge: true });
            } catch (err) {
              console.warn(`[Roles.tsx] Failed to auto-initialize role ${dr.id}:`, err);
            }
          }
        }
      } catch (err) {
        console.warn("[Roles.tsx] Failed to fetch roles for initialization:", err);
      }
    };
    initRoles();
  }, [roleLoading, settings.language]);

  const handleOpenAdd = () => {
    setSelectedRole(null);
    setFormData({ id: '', title: '', permissions: [] });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (role: any) => {
    setSelectedRole(role);
    setFormData({
      id: role.id,
      title: role.title || role.id,
      permissions: Array.isArray(role.permissions) ? role.permissions : []
    });
    setIsModalOpen(true);
  };

  const togglePermission = (permId: string) => {
    setFormData(prev => {
      const activePerms = Array.isArray(prev.permissions) ? prev.permissions : [];
      return {
        ...prev,
        permissions: activePerms.includes(permId)
          ? activePerms.filter(p => p !== permId)
          : [...activePerms, permId]
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || saveBlockRef.current) return;
    if (!formData.id) {
      notificationService.notify({
        title: settings.language === 'ar' ? 'خطأ بالبيانات' : 'Data Error',
        message: settings.language === 'ar' ? 'يرجى إدخال معرف الدور' : 'Please enter role ID',
        type: 'error'
      });
      return;
    }
    
    saveBlockRef.current = true;
    setSaving(true);
    try {
      await setDoc(doc(db, 'roles', formData.id), {
        title: formData.title,
        permissions: formData.permissions,
        updatedAt: Date.now()
      });
      notificationService.notify({
        title: settings.language === 'ar' ? 'تم الحفظ' : 'Saved Successfully',
        message: settings.language === 'ar' ? `تم حفظ دور ${formData.title} بنجاح` : `Role ${formData.title} has been successfully updated.`,
        type: 'success'
      });
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'roles');
    } finally {
      setSaving(false);
      saveBlockRef.current = false;
    }
  };

  const handleDelete = async (id: string) => {
    if (id === 'Admin') {
      return alert(settings.language === 'ar' ? 'لا يمكن حذف دور مدير النظام مطلقا' : 'Cannot delete Admin role');
    }
    if (!window.confirm(settings.language === 'ar' ? `هل أنت متأكد من حذف دور ${id}؟` : `Are you sure you want to delete role ${id}?`)) return;
    try {
      await deleteDoc(doc(db, 'roles', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'roles');
    }
  };

  if (loading || roleLoading) return <div className="p-20 text-center text-slate-500 font-bold">{settings.language === 'ar' ? 'جاري تحميل الأدوار...' : 'Loading roles...'}</div>;

  if (currentUserRole !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-b from-[#121215] to-[#08080a] rounded-3xl border border-[#d4af37]/20 shadow-xl max-w-xl mx-auto text-center" dir={settings.language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="bg-[#d4af37]/10 p-5 rounded-2xl border border-[#d4af37]/25 mb-6 text-[#d4af37] shadow-[0_0_15px_rgba(212,175,55,0.1)]">
          <X className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-extrabold text-[#d4af37] mb-2 tracking-wide text-center uppercase">{t('accessDenied')}</h2>
        <p className="text-slate-400 text-xs text-center leading-relaxed">
          {settings.language === 'ar' ? 'إدارة الأدوار مخصصة لمدير النظام فقط.' : 'Role management is restricted to system administrators.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-start transition-colors">
      
      {/* Title block */}
      <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg shadow-black/35">
        <div className="flex items-center gap-3">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-2.5 rounded-2xl text-[#d4af37]">
            <Shield className="w-6 h-6 animate-pulse" />
          </div>
          <div className="text-start">
            <h1 className="text-xl font-black text-white leading-none mb-1">{settings.language === 'ar' ? 'الأدوار والصلاحيات' : 'Roles & Permissions'}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {settings.language === 'ar' ? 'تخصيص مستويات وصول الموظفين وتوزيع أدوار النظام' : 'Configure user access levels and authorization policies'}
            </p>
          </div>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black px-6 py-2.5 rounded-xl flex items-center gap-2 font-black text-sm transition transform active:scale-95 shadow-md shadow-yellow-950/20"
        >
          <Plus className="w-4 h-4" /> {settings.language === 'ar' ? 'إنشاء دور جديد' : 'Create New Role'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map(r => (
          <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col transition-all hover:border-[#d4af37]/30 shadow-lg shadow-black/30">
            <div className="p-5 border-b border-slate-800 bg-slate-950/45 flex justify-between items-center text-start">
              <div>
                <h3 className="font-extrabold text-[#d4af37] text-md leading-none mb-1">{r.title || r.id}</h3>
                <span className="text-[10px] text-slate-500 font-mono font-black uppercase tracking-widest" dir="ltr">{r.id}</span>
              </div>
              <div className="flex gap-1.5">
                <button 
                  onClick={() => handleOpenEdit(r)}
                  className="p-2 text-slate-400 border border-slate-800 bg-slate-950 hover:text-[#d4af37] hover:border-[#d4af37] rounded-xl transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {!['Admin'].includes(r.id) && (
                  <button 
                    onClick={() => handleDelete(r.id)}
                    className="p-2 text-rose-400 border border-slate-800 bg-slate-950 hover:bg-rose-950/20 hover:border-rose-500 rounded-xl transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="p-5 flex-1 text-start">
              <div className="text-[9px] font-black text-slate-500 mb-3 uppercase tracking-wider leading-none">
                {settings.language === 'ar' ? 'الصلاحيات الممنوحة:' : 'Assigned Permissions:'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Array.isArray(r.permissions) ? r.permissions : []).map((pId: string) => {
                  const perm = currentPermissions.find(ap => ap.id === pId);
                  return (
                    <span 
                      key={pId} 
                      className="bg-slate-950 text-slate-300 px-2.5 py-1 rounded-lg text-[9px] font-bold border border-slate-800/80 transition-colors"
                    >
                      {perm?.label || pId}
                    </span>
                  );
                })}
                {(!Array.isArray(r.permissions) || r.permissions.length === 0) && (
                  <span className="text-slate-500 text-[10px] italic">{settings.language === 'ar' ? 'لا توجد صلاحيات محددة' : 'No permissions assigned'}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-b from-[#121215] to-[#08080a] p-1 rounded-2xl border border-[#d4af37]/20 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-850 flex justify-between items-center bg-black/40">
              <h3 className="font-extrabold text-[#d4af37] text-md uppercase">{selectedRole ? (settings.language === 'ar' ? 'تعديل صلاحيات الدور' : 'Edit Role Access Rules') : (settings.language === 'ar' ? 'إنشاء دور مخصص جديد' : 'Create Custom Role')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 overflow-y-auto flex-1 space-y-5 text-xs font-bold text-slate-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-start">
                <div>
                  <label className="block text-slate-500 mb-1">اسم الدور (بالعربي)</label>
                  <input required placeholder="مثل: مشرف مستودع" type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full border border-slate-850 rounded-xl p-3 bg-slate-950 text-white focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/50 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">المعرف (انجليزي)</label>
                  <input required disabled={!!selectedRole} placeholder="مثال: Warehouse_Supervisor" type="text" value={formData.id} onChange={(e) => setFormData({...formData, id: e.target.value})} className="w-full border border-slate-850 rounded-xl p-3 bg-slate-950 text-white focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/50 outline-none font-mono disabled:opacity-45 disabled:cursor-not-allowed text-start" dir="ltr" />
                </div>
              </div>

              <div className="text-start">
                <label className="block text-slate-500 mb-3">تخصيص مستويات الوصول</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[45vh] overflow-y-auto pr-1">
                  {currentPermissions.map(perm => (
                    <label key={perm.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-850 bg-slate-950/40 hover:bg-slate-900 cursor-pointer transition-colors text-start">
                      <div 
                        onClick={() => togglePermission(perm.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${(Array.isArray(formData.permissions) && formData.permissions.includes(perm.id)) ? 'bg-[#d4af37] border-[#d4af37] text-black font-black' : 'border-slate-800'}`}
                      >
                        {(Array.isArray(formData.permissions) && formData.permissions.includes(perm.id)) && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-white">{perm.label}</div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider">{perm.group}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </form>

            <div className="p-5 border-t border-slate-850 bg-black/40 flex justify-end gap-3 shrink-0">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-5 py-2.5 text-slate-400 font-bold hover:bg-slate-850/40 rounded-xl transition-colors active:scale-95 text-xs border border-slate-800"
              >
                {settings.language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center gap-1.5 disabled:opacity-50 text-xs"
              >
                {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {settings.language === 'ar' ? 'حفظ وتحميل الدور' : 'Save configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
