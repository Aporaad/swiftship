/**
 * RoleFormModal.tsx
 * مودال إنشاء وتعديل الأدوار والصلاحيات
 * Modal form for creating and editing roles & permissions
 */

import React from 'react';
import { Shield, X, Search, CheckCircle2, ChevronDown } from 'lucide-react';

interface RoleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRole: any;
  roleFormData: { id: string; title: string; permissions: string[] };
  setRoleFormData: React.Dispatch<React.SetStateAction<{ id: string; title: string; permissions: string[] }>>;
  roleActiveTab: string;
  setRoleActiveTab: (tab: string) => void;
  permSearch: string;
  setPermSearch: (search: string) => void;
  expandedGroups: Record<string, boolean>;
  setExpandedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectAllInActiveTab: () => void;
  deselectAllInActiveTab: () => void;
  getFilteredPerms: () => any[];
  toggleGroup: (groupName: string, check: boolean) => void;
  togglePermission: (permId: string) => void;
  handleSaveRole: (e: React.FormEvent) => void;
  savingRole: boolean;
  isAr: boolean;
  allPermissionsCount: number;
  t: (ar: string, en: string) => string;
}

export const RoleFormModal: React.FC<RoleFormModalProps> = ({
  isOpen,
  onClose,
  selectedRole,
  roleFormData,
  setRoleFormData,
  roleActiveTab,
  setRoleActiveTab,
  permSearch,
  setPermSearch,
  expandedGroups,
  setExpandedGroups,
  selectAllInActiveTab,
  deselectAllInActiveTab,
  getFilteredPerms,
  toggleGroup,
  togglePermission,
  handleSaveRole,
  savingRole,
  isAr,
  allPermissionsCount,
  t
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/30 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex justify-between items-center bg-black/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/10 p-2.5 text-[#f4d870]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-base">
                {selectedRole ? t('تعديل صلاحيات الدور', 'Edit Role Permissions') : t('إنشاء دور مخصص جديد', 'Create Custom Role')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t('توزيع وتخصيص مستويات الوصول لجميع واجهات وعمليات النظام بالتبويبات', 'Configure granular access levels for all system modules using tabbed sections')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-900 border border-slate-800 p-2 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveRole} className="flex flex-col flex-1 overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
          <div className="p-5 space-y-4 overflow-y-auto flex-1">

            {/* Role Title and ID inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-slate-800 bg-black/40 p-4">
              <div>
                <label className="block text-xs font-black text-slate-300 mb-1.5">{t('اسم الدور (بالعربي)', 'Role Title')} *</label>
                <input required type="text" placeholder={t('مثل: مدير المالية والمحاسبة', 'e.g. Finance & Accounting Manager')} value={roleFormData.title} onChange={e => setRoleFormData({ ...roleFormData, title: e.target.value })} className="w-full border border-slate-800 rounded-xl p-3 bg-slate-950 text-white focus:border-[#d4af37]/60 outline-none text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-300 mb-1.5">{t('المعرّف (بالإنجليزي)', 'Role ID (English)')} *</label>
                <input required disabled={!!selectedRole} type="text" placeholder="Finance_Manager" value={roleFormData.id} onChange={e => setRoleFormData({ ...roleFormData, id: e.target.value })} className="w-full border border-slate-800 rounded-xl p-3 bg-slate-950 text-white focus:border-[#d4af37]/60 outline-none text-xs font-bold font-mono disabled:opacity-40 disabled:cursor-not-allowed" dir="ltr" />
              </div>
            </div>

            {/* Category Tabs Bar */}
            <div className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-2.5 pt-1 text-xs">
              {[
                { id: 'all', label: t('🌐 جميع الأقسام', '🌐 All Modules') },
                { id: 'entries', label: t('📖 القيود المحاسبية', '📖 Journal Entries') },
                { id: 'vouchers', label: t('🧾 سندات القبض والصرف', '🧾 Vouchers') },
                { id: 'finance_accounts', label: t('💰 المالية والحسابات', '💰 Finance & Accounts') },
                { id: 'general_orders', label: t('📦 عام والطلبات', '📦 General & Orders') },
                { id: 'people', label: t('👥 الأشخاص والمستخدمون', '👥 Users & People') },
                { id: 'settings', label: t('⚙️ الإعدادات والتلقائية', '⚙️ Settings & Rules') },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoleActiveTab(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 font-black transition ${roleActiveTab === tab.id
                    ? 'bg-[#d4af37] text-slate-950 shadow-md'
                    : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center flex-wrap gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
              <button type="button" onClick={selectAllInActiveTab}
                className="px-3 py-1.5 bg-[#d4af37]/15 text-[#f4d870] border border-[#d4af37]/30 rounded-lg text-xs font-black hover:bg-[#d4af37]/25 transition-all">
                {t('تحديد كل هذا القسم', 'Select Section')}
              </button>
              <button type="button" onClick={deselectAllInActiveTab}
                className="px-3 py-1.5 bg-slate-900 text-slate-400 border border-slate-800 rounded-lg text-xs font-black hover:bg-slate-800 transition-all">
                {t('إلغاء كل هذا القسم', 'Deselect Section')}
              </button>

              <div className="flex-1 relative min-w-[160px]">
                <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-500 w-3.5 h-3.5`} />
                <input type="text" placeholder={t('بحث سريع في الصلاحيات...', 'Filter permissions...')} value={permSearch} onChange={e => setPermSearch(e.target.value)}
                  className={`w-full ${isAr ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-1.5 bg-black/60 border border-slate-800 rounded-lg text-xs text-white font-bold outline-none focus:border-[#d4af37]/60`} />
              </div>

              <span className="text-xs font-mono font-black text-[#f4d870] bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                {roleFormData.permissions.length}/{allPermissionsCount} {t('محدد', 'selected')}
              </span>
            </div>

            {/* Permission Groups List */}
            <div className="space-y-3 max-h-[48vh] overflow-y-auto pr-1">
              {getFilteredPerms().map(group => {
                const groupPermsIds = group.perms.map((p: any) => p.id);
                const activePermissions = Array.isArray(roleFormData.permissions) ? roleFormData.permissions : [];
                const allChecked = groupPermsIds.every((id: string) => activePermissions.includes(id));
                const someChecked = groupPermsIds.some((id: string) => activePermissions.includes(id));
                const isExpanded = expandedGroups[group.group] !== false; // default expanded
                return (
                  <div key={group.group} className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-850 transition"
                      onClick={() => setExpandedGroups(prev => ({ ...prev, [group.group]: !isExpanded }))}>
                      <div className="flex items-center gap-3">
                        <div onClick={e => { e.stopPropagation(); toggleGroup(group.group, !allChecked); }}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${allChecked ? 'bg-[#d4af37] border-[#d4af37] text-slate-950' : someChecked ? 'bg-[#d4af37]/30 border-[#d4af37]/60' : 'border-slate-700'}`}>
                          {allChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {someChecked && !allChecked && <div className="w-2.5 h-1 bg-[#d4af37] rounded-sm"></div>}
                        </div>
                        <span className="text-xs font-black text-white">{group.group}</span>
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                          {group.perms.filter((p: any) => activePermissions.includes(p.id)).length} / {group.perms.length}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>

                    {isExpanded && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-800/40">
                        {group.perms.map((perm: any) => {
                          const isChecked = activePermissions.includes(perm.id);
                          return (
                            <label key={perm.id} onClick={() => togglePermission(perm.id)}
                              className={`flex items-center gap-3 p-3 cursor-pointer transition-all select-none ${isChecked ? 'bg-[#d4af37]/10' : 'bg-slate-950/70 hover:bg-slate-900'}`}>
                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${isChecked ? 'bg-[#d4af37] border-[#d4af37] text-slate-950 font-black' : 'border-slate-700 hover:border-slate-500'}`}>
                                {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white leading-snug">{perm.label}</div>
                                <div className="text-[9px] text-slate-500 font-mono mt-0.5 truncate">{perm.id}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {getFilteredPerms().length === 0 && (
                <div className="p-8 text-center text-xs font-bold text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800">
                  {t('لا توجد صلاحيات تطابق معايير البحث أو التبويب المحدد.', 'No permissions match your search or selected tab.')}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-slate-800 bg-black/60 flex items-center justify-between shrink-0">
            <span className="text-xs font-mono text-slate-400">
              {t('إجمالي الصلاحيات المختارة:', 'Selected:')} <span className="font-bold text-[#f4d870]">{roleFormData.permissions.length}</span>
            </span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs">{t('إلغاء', 'Cancel')}</button>
              <button type="submit" disabled={savingRole} className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl shadow-lg transition-all active:scale-[0.98] text-xs disabled:opacity-50">
                {savingRole ? t('جاري الحفظ...', 'Saving...') : t('حفظ الدور والصلاحيات', 'Save Role & Permissions')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoleFormModal;
