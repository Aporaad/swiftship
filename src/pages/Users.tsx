import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { Search, Edit2, X, Plus, UserX, UserCheck, Trash2, Users as UsersIcon, Shield, Lock, Eye, EyeOff, Crown, ShieldAlert, Coins } from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useSettings } from '../context/SettingsContext';
import { notificationService } from '../services/notificationService';
import ConfirmModal from '../components/ConfirmModal';
import ConfirmDeletePinModal from '../components/ConfirmDeletePinModal';
import { financialAccountService } from '../services/financialAccountService';
import { activityLogService } from '../services/activityLogService';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

export default function Users() {
  const { settings, t } = useSettings();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const { role, hasPermission, profile: currentUserDoc, loading: roleLoading } = useRole();
  const [showPassword, setShowPassword] = useState(false);
  const isAr = settings.language === 'ar';

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });

  const [deletePinConfig, setDeletePinConfig] = useState({
    isOpen: false,
    entityId: '',
    entityName: ''
  });

  useEffect(() => {
    if (roleLoading) return;
    const unsubRoles = onSnapshot(collection(db, 'roles'), (snap) => {
      const allRoles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const staffRoles = allRoles.filter(r => r.id !== 'courier' && r.id !== 'Courier');
      setRoles(staffRoles);
    });
    return () => unsubRoles();
  }, [roleLoading]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    role: '',
    disabled: false,
    commissionRate: 0,
    username: '',
    systemPin: ''
  });

  const [addFormData, setAddFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    systemPin: '',
    role: 'Employee',
    commissionRate: 0
  });

  const [addLoading, setAddLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const addBlockRef = React.useRef(false);
  const editBlockRef = React.useRef(false);

  useEffect(() => {
    if (roleLoading) return;
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const staffOnly = allUsers.filter((u: any) => u.role !== 'Courier' && u.roleId !== 'courier' && u.role !== 'courier');
      setUsers(staffOnly);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return unsub;
  }, [roleLoading]);

  const handleOpenEdit = (user: any) => {
    setSelectedUser(user);
    setEditFormData({
      fullName: user.fullName || '',
      username: user.username || '',
      role: user.role || 'Employee',
      disabled: user.disabled || false,
      commissionRate: user.commissionRate || 0,
      systemPin: user.systemPin || ''
    });
    setIsEditModalOpen(true);
  };

  const ROOT_EMAILS = [
    'alsrhyarslan5@gmail.com', 
    'arslan.alshamari@gmail.com', 
    'engaporaad1@gmail.com', 
    'admin@swiftship.system',
    'apo.1.read@gmail.com'
  ];

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editLoading || editBlockRef.current) return;
    if (!selectedUser) return;
    
    editBlockRef.current = true;
    setEditLoading(true);
    
    // Check if username is taken if changed
    if (editFormData.username && editFormData.username !== selectedUser.username) {
      const q = query(collection(db, 'users'), where('username', '==', editFormData.username));
      const snap = await getDocs(q);
      if (!snap.empty && snap.docs[0].id !== selectedUser.id) {
        setEditLoading(false);
        editBlockRef.current = false;
        return notificationService.notify({
          title: isAr ? 'خطأ بالتحقق' : 'Unique ID Conflict',
          message: isAr ? 'اسم المستخدم هذا مستخدم ومقيد مسبقاً' : 'This ID/Username is already taken globally',
          type: 'error'
        });
      }
    }

    // Prevent changing root user role
    const isRoot = ROOT_EMAILS.includes(selectedUser.email) || selectedUser.isRoot;
    const finalRole = isRoot ? 'Admin' : editFormData.role;
    const finalDisabled = isRoot ? false : editFormData.disabled;

    try {
      await updateDoc(doc(db, 'users', selectedUser.id), {
        fullName: editFormData.fullName,
        username: editFormData.username,
        role: finalRole,
        disabled: finalDisabled,
        commissionRate: editFormData.commissionRate,
        systemPin: editFormData.systemPin,
        updatedAt: Date.now()
      });
      notificationService.notify({
        title: isAr ? 'تم تحديث بيانات المستخدم' : 'Staff parameters saved',
        message: isAr ? `تم تحديث ملف الموظف ${editFormData.fullName} بنجاح` : `User settings synchronized for ${editFormData.fullName}`,
        type: 'info'
      });
      setIsEditModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    } finally {
      setEditLoading(false);
      editBlockRef.current = false;
    }
  };

  const handleToggleStatus = async (user: any) => {
    const isRootTarget = ROOT_EMAILS.includes(user.email) || user.isRoot;
    if (isRootTarget) {
      return notificationService.notify({
        title: isAr ? 'فشل الحماية' : 'Security breach',
        message: isAr ? 'لا يمكن تعطيل أو فك حساب مدير النظام الأساسي' : 'Cannot freeze principal executive parameters',
        type: 'error'
      });
    }
    const action = user.disabled ? (isAr ? 'تفعيل' : 'Activate') : (isAr ? 'تعطيل ومصادرة' : 'Disable');
    
    setConfirmConfig({
      isOpen: true,
      title: isAr ? `${action} حساب مستخدم` : `Toggle status`,
      message: isAr ? `هل أنت متأكد من ${action} حساب الموظف ${user.fullName}؟` : `Are you sure you want to deactivate ${user.fullName}?`,
      type: user.disabled ? 'success' : 'warning' as any,
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'users', user.id), {
            disabled: !user.disabled,
            updatedAt: Date.now()
          });
          notificationService.notify({
            title: isAr ? 'تم تحديث وضعية الحساب' : 'Security profile updated',
            message: isAr ? `وضع الحساب للموظف ${user.fullName} تم تعديله` : `Status applied to ${user.fullName}`,
            type: user.disabled ? 'success' : 'warning'
          });
        } catch(err) {
          handleFirestoreError(err, OperationType.UPDATE, 'users');
        }
      }
    });
  };

  const handleDeleteUser = async (id: string, name: string) => {
    const targetUser = users.find(u => u.id === id);
    const isRootTarget = targetUser && (ROOT_EMAILS.includes(targetUser.email) || targetUser.isRoot);
    if (isRootTarget) {
      return notificationService.notify({
        title: isAr ? 'فشل تدمير مصفوفة النظام' : 'Breach Blocked',
        message: isAr ? 'لا يمكن حذف حساب المسؤول الرئيسي' : 'Cannot delete principle system admin',
        type: 'error'
      });
    }
    setDeletePinConfig({
      isOpen: true,
      entityId: id,
      entityName: name
    });
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addLoading || addBlockRef.current) return;
    addBlockRef.current = true;
    setAddLoading(true);
    let secondaryApp;
    try {
      // Check if email or username already exists in Firestore
      const emailQuery = query(collection(db, 'users'), where('email', '==', addFormData.email.toLowerCase()));
      const emailSnap = await getDocs(emailQuery);
      if (!emailSnap.empty) throw new Error(isAr ? 'البريد الإلكتروني مشحون ومستخدم مسبقاً' : 'Email is already registered under this gateway');

      if (addFormData.username) {
        const usernameQuery = query(collection(db, 'users'), where('username', '==', addFormData.username));
        const usernameSnap = await getDocs(usernameQuery);
        if (!usernameSnap.empty) throw new Error(isAr ? 'اسم المستخدم هذا مستخدم من كادر آخر' : 'Corporate ID already claimed');
      }

      // 1. Create a secondary Firebase App to create the user in Auth without signing out the admin
      const secondaryAppName = `Secondary-${Date.now()}`;
      secondaryApp = initializeApp({}, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Create the user in Firebase Authentication with a constant system auth password
      const SHARED_SYSTEM_AUTH_PASSWORD = 'swiftship@system_pw_2026';
      const authResult = await createUserWithEmailAndPassword(
        secondaryAuth, 
        addFormData.email.toLowerCase(), 
        SHARED_SYSTEM_AUTH_PASSWORD
      );
      
      const newUid = authResult.user.uid;

      // 3. Create the user document in Firestore using the new UID
      await setDoc(doc(db, 'users', newUid), {
        fullName: addFormData.fullName,
        email: addFormData.email.toLowerCase(),
        username: addFormData.username,
        systemPin: addFormData.systemPin,
        role: addFormData.role,
        commissionRate: addFormData.commissionRate,
        password: addFormData.password,
        disabled: false,
        createdAt: Date.now()
      });

      notificationService.notify({
        title: isAr ? 'تم تقييد مستشار جديد' : 'Credentials Provisioned',
        message: isAr ? `تم دمج الموظف ${addFormData.fullName} وتوزيع ترخيصه كـ ${addFormData.role}` : `Credentials built for ${addFormData.fullName}`,
        type: 'success'
      });
      
      setIsAddModalOpen(false);
      setAddFormData({ fullName: '', username: '', email: '', password: '', systemPin: '', role: 'Employee', commissionRate: 0 });
    } catch(err: any) {
      console.error("Error adding user:", err);
      let message = err.message;
      if (err.code === 'auth/email-already-in-use') {
        message = isAr ? 'هذا البريد مسجل مسبقاً بحيازة نظام الحسابات' : 'This email is already registered in the auth system';
      } else if (err.code === 'auth/weak-password') {
        message = isAr ? 'كلمة المرور ضعيفة جداً' : 'Auth profile requires at least 6 characters strength';
      }
      notificationService.notify({
        title: isAr ? 'خطأ في الربط والإنشاء' : 'Provisioning Failure',
        message,
        type: 'error'
      });
    } finally {
      setAddLoading(false);
      addBlockRef.current = false;
      if (secondaryApp) {
        await deleteApp(secondaryApp);
      }
    }
  };

  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'Admin':
        return <span className="bg-amber-950/20 text-[#d4af37] border border-[#d4af37]/30 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider">{t('admin')}</span>;
      case 'Employee':
        return <span className="bg-purple-950/20 text-purple-400 border border-purple-900/30 px-3 py-1 rounded-xl text-[10px] font-black">{t('user')}</span>;
      case 'Courier':
        return <span className="bg-cyan-950/20 text-cyan-405 border border-cyan-900/30 px-3 py-1 rounded-xl text-[10px] font-black">{t('courier')}</span>;
      case 'Accountant':
        return <span className="bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 px-3 py-1 rounded-xl text-[10px] font-black">{isAr ? 'محاسب مالي' : 'Accountant'}</span>;
      default:
        return <span className="bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-xl text-[10px] font-black">{role || '...'}</span>;
    }
  };

  if (roleLoading) {
    return (
      <div className="flex bg-[#0e0e11] text-white h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded border-2 border-[#d4af37]/25 border-t-[#d4af37]"></div>
      </div>
    );
  }

  if (role !== 'Admin' && !hasPermission('manage_users')) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-850 shadow-xl text-center select-none">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide text-center">{t('accessDenied')}</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">{isAr ? 'هذه اللوحة الأمنية مخصصة للمدير الرئيسي للشركة فقط.' : 'Role management is strictly restricted to senior cloud security officers.'}</p>
      </div>
    );
  }

  // Filter users
  const filteredUsers = users
    .filter(u => {
      const matchSearch = (u.fullName || '').toLowerCase().includes(search.toLowerCase()) || 
                          (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
                          (u.username || '').toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' && !u.disabled) || (statusFilter === 'disabled' && u.disabled);
      return matchSearch && matchRole && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortBy === 'name-asc') return (a.fullName || '').localeCompare(b.fullName || '');
      return 0;
    });

  return (
    <div className="space-y-6 pb-20 text-start font-sans selection:bg-[#d4af37]/30">
      
      {/* Title block */}
      <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-2.5 rounded-2xl text-[#d4af37]">
            <UsersIcon className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-none mb-1">{isAr ? 'إدارة الموظفين والفرع والوصول' : 'Cloud Security & Staff Gateway'}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isAr ? 'التحري عن الكوادر اللوجستية • توزيع الرخص والصلاحيات وتتبع الدخول' : 'Configure login configurations • Set Commission multipliers & pin numbers'}</p>
          </div>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black px-6 py-2.5 rounded-xl flex items-center gap-2 font-black text-sm transition transform active:scale-95 shadow-md shadow-yellow-950/20"
        >
          <Plus className="w-4 h-4" /> {isAr ? 'تسجيل وإعتماد موظف جديد' : 'Provision Staff Member'}
        </button>
      </div>

      {/* Main filter container */}
      <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        
        {/* Belt filter options */}
        <div className="p-4 border-b border-slate-850 bg-black/30 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder={isAr ? 'البحث عن الموظف بالاسم أو المعرف الرقمي أو البريد...' : 'Filter profiles...'} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2 bg-black/50 border border-slate-850 rounded-xl focus:border-[#d4af37]/60 outline-none text-xs text-white placeholder:text-slate-500 font-bold"
            />
          </div>

          <select 
            value={roleFilter} 
            onChange={e => setRoleFilter(e.target.value)} 
            className="bg-black/50 border border-slate-850 text-slate-300 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50"
          >
            <option value="all">{isAr ? 'جميع الرتب الوظيفية' : 'All Roles'}</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.title || r.id}</option>
            ))}
          </select>

          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)} 
            className="bg-black/50 border border-slate-850 text-slate-300 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50"
          >
            <option value="all">{isAr ? 'جميع الحالات التشغيلية' : 'All States'}</option>
            <option value="active">{isAr ? 'النشطون بقنوات الاتصال' : 'Active Only'}</option>
            <option value="disabled">{isAr ? 'المجمدون والمحجوبون' : 'Suspended Only'}</option>
          </select>
        </div>

        {/* Cloud user grid table lists */}
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-850">
              <tr>
                <th className="p-4">{isAr ? 'الموظف والمعرف' : 'Staff Member Name'}</th>
                <th className="p-4">{isAr ? 'البريد المؤسسي' : 'Secure Inbox'}</th>
                <th className="p-4">{isAr ? 'الرتبة والدور' : 'Assigned Role'}</th>
                <th className="p-4 text-center">{isAr ? 'عمولة التوزيع (%)' : 'Split Commission'}</th>
                <th className="p-4 text-center">{isAr ? 'الرمز التعريفي PIN' : 'Security PIN Code'}</th>
                <th className="p-4 text-center">{isAr ? 'الحالة التشغيلية' : 'Activity Status'}</th>
                <th className="p-4 text-left">{isAr ? 'الإجراءات الأمنية' : 'Enforcements'}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-850 bg-black/10">
              {filteredUsers.map(user => {
                const isRootTarget = ROOT_EMAILS.includes(user.email) || user.isRoot;
                return (
                  <tr key={user.id} className={`hover:bg-slate-950/40 transition-colors ${user.disabled ? 'opacity-70' : ''}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3 text-start">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-800 text-[#d4af37] flex items-center justify-center font-black text-xs shrink-0 relative">
                          {user.fullName?.substring(0,2)}
                          {isRootTarget && <Crown className="w-3.5 h-3.5 text-yellow-500 absolute -top-1.5 -right-1.5 animate-bounce" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-extrabold text-white">{user.fullName}</span>
                          <span className="text-[9px] font-mono text-slate-505 font-bold mt-0.5">@{user.username || 'not_set'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-start font-mono text-slate-400 font-bold" dir="ltr">
                      {user.email}
                    </td>
                    <td className="p-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="p-4 text-center font-mono text-slate-300 font-black">
                      {user.commissionRate || 0}%
                    </td>
                    <td className="p-4 text-center font-mono text-slate-400 font-semibold">
                      {user.systemPin || '—'}
                    </td>
                    <td className="p-4 text-center">
                      {user.disabled ? (
                        <span className="bg-rose-950/30 text-rose-400 border border-rose-900/30 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-tighter">
                          {isAr ? 'مجمد / موقوف' : 'SUSPENDED'}
                        </span>
                      ) : (
                        <span className="bg-emerald-950/30 text-emerald-400 border border-emerald-900/30 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-tighter">
                          {isAr ? 'مصادق وفعال' : 'ACTIVE_LOGGED'}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-left flex justify-end gap-2">
                      <button 
                        onClick={() => handleToggleStatus(user)} 
                        title={user.disabled ? (isAr ? 'تفعيل الحساب' : 'Unfreeze') : (isAr ? 'تجميد وحظر الوصول' : 'Freeze Access')}
                        className={`p-2 rounded-xl border transition-all ${user.disabled ? 'text-emerald-400 bg-emerald-950/10 border-emerald-950/30' : 'text-rose-450 bg-rose-950/10 border-rose-950/40'}`}
                      >
                        {user.disabled ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                      </button>
                      
                      <button 
                        onClick={() => handleOpenEdit(user)} 
                        className="text-white hover:text-[#d4af37] bg-slate-900 border border-slate-800 p-2 rounded-xl transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {!isRootTarget && (
                        <button 
                          onClick={() => handleDeleteUser(user.id, user.fullName)} 
                          className="text-rose-500 hover:bg-rose-950/20 bg-rose-950/10 border border-rose-950/45 p-2 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-16 text-center text-slate-600 font-bold uppercase tracking-widest font-mono text-[10px]">
                    [ no_linked_staff_profiles_matched ]
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden font-sans flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'تفويض حساب موظف جديد' : 'Provision Staff Member Account'}
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleAddUser} className="p-6 space-y-4 text-start overflow-y-auto flex-1">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الاسم الكامل الثلاثي' : 'Employee Full Name'}</label>
                <input 
                  required 
                  type="text" 
                  value={addFormData.fullName} 
                  onChange={(e) => setAddFormData({...addFormData, fullName: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'اسم مستخدم الولوجID' : 'Username ID Mapping'}</label>
                  <input 
                    required 
                    placeholder="arslan_ops" 
                    type="text" 
                    value={addFormData.username} 
                    onChange={(e) => setAddFormData({...addFormData, username: e.target.value})}
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'رمز PIN السند المالي' : 'Security PIN'}</label>
                  <input 
                    required 
                    placeholder="1234" 
                    type="text" 
                    maxLength={4} 
                    value={addFormData.systemPin} 
                    onChange={(e) => setAddFormData({...addFormData, systemPin: e.target.value})}
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs text-center font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono tracking-widest"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'البريد الإلكتروني للوج' : 'Work Inbox Email Address'}</label>
                <input 
                  required 
                  type="email" 
                  placeholder="name@swiftship.system" 
                  value={addFormData.email} 
                  onChange={(e) => setAddFormData({...addFormData, email: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'كلمة المرور المشفرة' : 'Login Secure Password'}</label>
                <div className="relative">
                  <input 
                    required 
                    type={showPassword ? 'text' : 'password'} 
                    value={addFormData.password} 
                    onChange={(e) => setAddFormData({...addFormData, password: e.target.value})}
                    className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 pr-4 pl-10 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start"
                    placeholder="••••••••"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الرتبة والدور الأساسي' : 'Assigned Role'}</label>
                  <select 
                    value={addFormData.role} 
                    onChange={(e) => setAddFormData({...addFormData, role: e.target.value})}
                    className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer"
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.title || r.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'نسبة عمولة التوزيع' : 'Commission rate %'}</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    step="0.1" 
                    value={addFormData.commissionRate} 
                    onChange={(e) => setAddFormData({...addFormData, commissionRate: parseFloat(e.target.value) || 0})}
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-850">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs transition-colors"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  disabled={addLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] disabled:from-slate-800 disabled:to-slate-900 text-black font-black text-xs rounded-xl shadow-md transition-all h-max"
                >
                  {addLoading ? (isAr ? 'جاري الدمج والتأسيس...' : 'Deploying keys...') : (isAr ? 'تأسيس المعرف وتقييده' : 'Provision User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden font-sans flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <h3 className="font-black text-white text-xs uppercase tracking-widest">{isAr ? 'تعديل ملف موظف' : 'Configure Staff Parameters'}</h3>
              <button 
                onClick={() => { setIsEditModalOpen(false); setSelectedUser(null); }}
                className="text-slate-500 hover:text-white bg-slate-900 p-1.5 border border-slate-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4 text-start overflow-y-auto flex-1">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الاسم الكامل الموثق' : 'Employee Full Name'}</label>
                <input 
                  required 
                  type="text" 
                  value={editFormData.fullName} 
                  onChange={(e) => setEditFormData({...editFormData, fullName: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'المعرف الفريد @id' : 'Unique ID map'}</label>
                  <input 
                    required 
                    type="text" 
                    value={editFormData.username} 
                    onChange={(e) => setEditFormData({...editFormData, username: e.target.value})}
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'رمز الكود البريدي PIN' : 'Security PIN mapping'}</label>
                  <input 
                    required 
                    type="text" 
                    maxLength={4} 
                    value={editFormData.systemPin} 
                    onChange={(e) => setEditFormData({...editFormData, systemPin: e.target.value})}
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs text-center font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono tracking-widest"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'دور الموظف ورخصته' : 'Designated Role'}</label>
                  <select 
                    disabled={ROOT_EMAILS.includes(selectedUser.email) || selectedUser.isRoot}
                    value={editFormData.role} 
                    onChange={(e) => setEditFormData({...editFormData, role: e.target.value})}
                    className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.title || r.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'عمولة المبيعات والتوزيع (%)' : 'Split Commission %'}</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    step="0.1" 
                    value={editFormData.commissionRate} 
                    onChange={(e) => setEditFormData({...editFormData, commissionRate: parseFloat(e.target.value) || 0})}
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start"
                  />
                </div>
              </div>

              {!ROOT_EMAILS.includes(selectedUser.email) && !selectedUser.isRoot && (
                <div className="bg-black/40 border border-slate-850 p-4 rounded-xl">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={editFormData.disabled} 
                      onChange={(e) => setEditFormData({...editFormData, disabled: e.target.checked})}
                      className="w-4 h-4 text-rose-500 focus:ring-rose-500 bg-black/50 border-slate-850 rounded" 
                    />
                    <div className="flex-1 text-start">
                      <span className="block text-xs font-black text-rose-500 uppercase tracking-tighter">{isAr ? 'تجميد حساب الموظف وسحب الرخص' : 'Freeze staff account'}</span>
                      <span className="block text-[9px] text-slate-500 mt-0.5">{isAr ? 'سيتم منعه تلقائياً من تسجيل الدخول وإصدار الفواتير' : 'Instantly deny dashboard login and billing entries'}</span>
                    </div>
                  </label>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-850">
                <button 
                  type="button" 
                  onClick={() => { setIsEditModalOpen(false); setSelectedUser(null); }} 
                  className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs transition-colors"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  disabled={editLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] disabled:opacity-50 text-black font-black text-xs rounded-xl shadow-md transition-all h-max"
                >
                  {editLoading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ الحماية والتأمين' : 'Update settings')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
      />

      <ConfirmDeletePinModal
        isOpen={deletePinConfig.isOpen}
        onClose={() => setDeletePinConfig({ ...deletePinConfig, isOpen: false })}
        title={isAr ? 'حذف ملف موظف نهائياً' : 'Expel User Permanently'}
        message={isAr 
          ? `هل أنت متأكد من طرد وحذف المستخدم ${deletePinConfig.entityName}؟ هذا الإجراء سيقوم بحذف حسابه المالي وكافة قيوده المزدوجة والمصروفات المرتبطة به نهائياً.`
          : `Are you sure you want to permanently delete user ${deletePinConfig.entityName}? This will purge their financial account, journal transactions, and associated expenses from the database.`}
        isAr={isAr}
        onConfirm={async () => {
          await financialAccountService.purgeEntityAndFinancialFootprint('user', deletePinConfig.entityId);
          await activityLogService.log('delete_user', deletePinConfig.entityName, { id: deletePinConfig.entityId });
          notificationService.notify({
            title: isAr ? 'تم الحذف' : 'User Purged',
            message: isAr ? `تم حذف الموظف ${deletePinConfig.entityName} وسجلاته المالية بنجاح` : `User ${deletePinConfig.entityName} purged successfully`,
            type: 'warning'
          });
        }}
      />
    </div>
  );
}
