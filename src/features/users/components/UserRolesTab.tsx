import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { ALL_PERMISSIONS } from '../constants/permissionGroups';

// واجهة props لمكوّن تبويب الأدوار والصلاحيات
// Props interface for the UserRolesTab component
interface UserRolesTabProps {
  isAr: boolean;
  t: (ar: string, en: string) => string;
  roles: any[];
  users: any[];
  role: string;
  hasPermission: (perm: string) => boolean;
  canManage: boolean;
  handleOpenRoleModal: (role?: any) => void;
  handleDeleteRole: (roleId: string) => void;
}

export const UserRolesTab: React.FC<UserRolesTabProps> = ({
  isAr,
  t,
  roles,
  users,
  role,
  hasPermission,
  handleOpenRoleModal,
  handleDeleteRole,
}) => {
  const allPerms = ALL_PERMISSIONS(isAr);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {roles.map(r => {
        // عدد المستخدمين في هذا الدور / Count of users in this role
        const usersInRole = users.filter(u => u.role === r.id).length;
        const hasAll = r.permissions?.includes('*');
        return (
          <div
            key={r.id}
            className="bg-gradient-to-b from-[#121215] to-[#0a0a0d] border border-slate-800/50 rounded-2xl overflow-hidden hover:border-[#d4af37]/25 transition-all flex flex-col shadow-lg"
          >
            {/* رأس الدور / Role header */}
            <div className="p-4 border-b border-slate-800/40 flex justify-between items-start bg-black/20">
              <div>
                <h3 className="font-extrabold text-[#d4af37] text-sm mb-0.5">{r.title || r.id}</h3>
                <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest" dir="ltr">{r.id}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] text-slate-500 font-bold">{usersInRole} {t('مستخدم', 'users')}</span>
                  {hasAll && (
                    <span className="bg-amber-950/20 text-[#d4af37] border border-[#d4af37]/20 px-1.5 py-0.5 rounded text-[8px] font-black">
                      {t('صلاحيات كاملة ★', 'FULL ACCESS ★')}
                    </span>
                  )}
                </div>
              </div>
              {/* أزرار التعديل والحذف / Edit and delete buttons */}
              <div className="flex gap-1">
                {(role === 'Admin' || hasPermission('edit_roles')) && (
                  <button
                    onClick={() => handleOpenRoleModal(r)}
                    className="p-1.5 text-slate-400 border border-slate-800 bg-slate-950 hover:text-[#d4af37] hover:border-[#d4af37]/30 rounded-lg transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {r.id !== 'Admin' && (role === 'Admin' || hasPermission('delete_roles')) && (
                  <button
                    onClick={() => handleDeleteRole(r.id)}
                    className="p-1.5 text-rose-400 border border-slate-800 bg-slate-950 hover:bg-rose-950/20 hover:border-rose-500/30 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* قائمة الصلاحيات / Permissions list */}
            <div className="p-4 flex-1">
              <div className="text-[9px] font-black text-slate-600 mb-2 uppercase tracking-wider">
                {t('الصلاحيات الممنوحة:', 'Granted Permissions:')}
              </div>
              {hasAll ? (
                <div className="text-[9px] text-[#d4af37] font-bold bg-[#d4af37]/5 border border-[#d4af37]/10 rounded-lg p-2 text-center">
                  ★ {t('جميع صلاحيات النظام', 'All System Permissions')} ({allPerms.length} {t('صلاحية', 'permissions')})
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {(() => {
                    const permsArr = Array.isArray(r.permissions) ? r.permissions : [];
                    return (
                      <>
                        {permsArr.slice(0, 8).map((pId: string) => {
                          const perm = allPerms.find(ap => ap.id === pId);
                          return (
                            <span key={pId} className="bg-slate-900/80 text-slate-300 border border-slate-800/60 px-1.5 py-0.5 rounded text-[8px] font-bold">
                              {perm?.label || pId}
                            </span>
                          );
                        })}
                        {permsArr.length > 8 && (
                          <span className="bg-slate-900 text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded text-[8px] font-bold">
                            +{permsArr.length - 8} {t('أخرى', 'more')}
                          </span>
                        )}
                        {permsArr.length === 0 && (
                          <span className="text-slate-600 text-[10px] italic">
                            {t('لا توجد صلاحيات', 'No permissions assigned')}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UserRolesTab;
