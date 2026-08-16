import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  db,
  handleSupabaseError,
  OperationType,
  auth
} from '../lib/supabase-firebase-adapter';
import {
  Search,
  Edit2,
  X,
  Plus,
  UserX,
  UserCheck,
  Trash2,
  Briefcase,
  ShieldAlert,
  FileText,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  Coins,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useSettings } from '../context/SettingsContext';
import { notificationService } from '../services/notificationService';
import ConfirmModal from '../components/ConfirmModal';
import ConfirmDeletePinModal from '../components/ConfirmDeletePinModal';
import { financialAccountService } from '../services/financialAccountService';
import { activityLogService } from '../services/activityLogService';
import { useAccountBalances } from '../hooks/useAccountBalances';

export default function Employees() {
  const { settings, t } = useSettings();
  const { role, hasPermission, loading: roleLoading } = useRole();
  const isAr = settings.language === 'ar';
  const liveBalances = useAccountBalances();

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // Statement of Account Modal
  const [statementModal, setStatementModal] = useState<{
    isOpen: boolean;
    employee: any;
    transactions: any[];
    loading: boolean;
  }>({
    isOpen: false,
    employee: null,
    transactions: [],
    loading: false
  });

  // Confirm modals
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

  // Form States
  const [addFormData, setAddFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    jobsType: 'إداري',
    monthlySalary: 0,
    currency: 'YER',
    commissionRate: 0,
    notes: ''
  });

  const [editFormData, setEditFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    jobsType: 'إداري',
    monthlySalary: 0,
    currency: 'YER',
    commissionRate: 0,
    disabled: false,
    notes: ''
  });

  // Subscribe to employees
  useEffect(() => {
    if (roleLoading) return;
    const unsub = onSnapshot(
      collection(db, 'employees'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setEmployees(list);
        setLoading(false);
      },
      (err) => {
        handleSupabaseError(err, OperationType.LIST, 'employees');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [roleLoading]);

  // Open Edit Modal
  const handleOpenEdit = (emp: any) => {
    setSelectedEmployee(emp);
    setEditFormData({
      fullName: emp.fullName || '',
      phone: emp.phone || '',
      email: emp.email || '',
      address: emp.address || '',
      jobsType: emp.jobsType || 'إداري',
      monthlySalary: emp.monthlySalary || 0,
      currency: emp.currency || 'YER',
      commissionRate: emp.commissionRate || 0,
      disabled: emp.disabled || false,
      notes: emp.notes || ''
    });
    setIsEditModalOpen(true);
  };

  // Add Employee Function
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addLoading) return;
    if (!addFormData.fullName.trim()) {
      return notificationService.notify({
        title: isAr ? 'خطأ' : 'Validation Error',
        message: isAr ? 'يرجى كتابة اسم الموظف الكامل' : 'Full name is required',
        type: 'error'
      });
    }

    setAddLoading(true);
    try {
      const newId = 'emp_' + Math.random().toString(36).substring(2, 11);
      const now = Date.now();

      // 1. Create employee document in `employees` collection
      const empData = {
        fullName: addFormData.fullName.trim(),
        phone: addFormData.phone.trim(),
        email: addFormData.email.trim(),
        address: addFormData.address.trim(),
        jobsType: addFormData.jobsType,
        monthlySalary: Number(addFormData.monthlySalary) || 0,
        currency: addFormData.currency,
        commissionRate: Number(addFormData.commissionRate) || 0,
        notes: addFormData.notes.trim(),
        disabled: false,
        createdAt: now,
        createdBy: auth.currentUser?.displayName || 'Admin'
      };

      await setDoc(doc(db, 'employees', newId), empData);

      // 2. Automatically provision financial account (2130-xxxx) for employee
      try {
        await financialAccountService.createAccountForEntity(
          'employee',
          newId,
          addFormData.fullName.trim(),
          addFormData.currency,
          Number(addFormData.monthlySalary) || 0
        );
      } catch (accErr) {
        console.warn('[Employees] Financial account creation error:', accErr);
      }

      await activityLogService.log('add_user', addFormData.fullName, { employeeId: newId });

      notificationService.notify({
        title: isAr ? 'تم إضافة الموظف' : 'Employee Enrolled',
        message: isAr
          ? `تم إضافة الموظف ${addFormData.fullName} وإنشاء حسابه المالي بنجاح`
          : `Employee ${addFormData.fullName} created with financial ledger account`,
        type: 'success'
      });

      setIsAddModalOpen(false);
      setAddFormData({
        fullName: '',
        phone: '',
        email: '',
        address: '',
        jobsType: 'إداري',
        monthlySalary: 0,
        currency: 'YER',
        commissionRate: 0,
        notes: ''
      });
    } catch (err: any) {
      notificationService.notify({
        title: isAr ? 'خطأ في الإنشاء' : 'Creation Failed',
        message: err.message,
        type: 'error'
      });
    } finally {
      setAddLoading(false);
    }
  };

  // Update Employee Function
  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editLoading || !selectedEmployee) return;

    setEditLoading(true);
    try {
      const now = Date.now();
      await updateDoc(doc(db, 'employees', selectedEmployee.id), {
        fullName: editFormData.fullName.trim(),
        phone: editFormData.phone.trim(),
        email: editFormData.email.trim(),
        address: editFormData.address.trim(),
        jobsType: editFormData.jobsType,
        monthlySalary: Number(editFormData.monthlySalary) || 0,
        currency: editFormData.currency,
        commissionRate: Number(editFormData.commissionRate) || 0,
        disabled: editFormData.disabled,
        notes: editFormData.notes.trim(),
        updatedAt: now
      });

      // Sync financial account name and salary if changed
      if (selectedEmployee.financialAccountId || selectedEmployee.accountId) {
        const accId = selectedEmployee.financialAccountId || selectedEmployee.accountId;
        if (editFormData.fullName !== selectedEmployee.fullName) {
          await financialAccountService.updateAccountEntityName(selectedEmployee.id, editFormData.fullName.trim());
        }
        if (editFormData.monthlySalary !== selectedEmployee.monthlySalary) {
          await financialAccountService.updateMonthlySalary(selectedEmployee.id, Number(editFormData.monthlySalary) || 0);
        }
      }

      await activityLogService.log('edit_user', editFormData.fullName, { employeeId: selectedEmployee.id });

      notificationService.notify({
        title: isAr ? 'تم تحديث البيانات' : 'Employee Updated',
        message: isAr ? `تم تحديث ملف الموظف ${editFormData.fullName} بنجاح` : `Updated ${editFormData.fullName}`,
        type: 'info'
      });

      setIsEditModalOpen(false);
      setSelectedEmployee(null);
    } catch (err: any) {
      notificationService.notify({
        title: isAr ? 'خطأ في التعديل' : 'Update Failed',
        message: err.message,
        type: 'error'
      });
    } finally {
      setEditLoading(false);
    }
  };

  // Toggle Employee Status
  const handleToggleStatus = (emp: any) => {
    const actionText = emp.disabled ? (isAr ? 'تفعيل' : 'Activate') : (isAr ? 'تعطيل' : 'Disable');
    setConfirmConfig({
      isOpen: true,
      title: `${actionText} حساب الموظف`,
      message: isAr ? `هل أنت متأكد من ${actionText} الموظف ${emp.fullName}؟` : `Are you sure you want to ${actionText.toLowerCase()} ${emp.fullName}?`,
      type: emp.disabled ? 'info' : 'warning',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'employees', emp.id), {
            disabled: !emp.disabled,
            updatedAt: Date.now()
          });
          notificationService.notify({
            title: isAr ? 'تم تغيير الحالة' : 'Status Updated',
            message: `${emp.fullName} ${emp.disabled ? (isAr ? 'مُفعَّل الآن' : 'enabled') : (isAr ? 'مُعطَّل الآن' : 'disabled')}`,
            type: emp.disabled ? 'success' : 'warning'
          });
        } catch (err: any) {
          handleSupabaseError(err, OperationType.UPDATE, 'employees');
        }
      }
    });
  };

  // Open Statement of Account Modal
  const handleOpenStatement = async (emp: any) => {
    const accId = emp.financialAccountId || emp.accountId;
    if (!accId) {
      return notificationService.notify({
        title: isAr ? 'تنبيه' : 'Notice',
        message: isAr ? 'لا يوجد حساب مالي مرتب في الدليل المحاسبي لهذا الموظف' : 'No linked financial account found',
        type: 'warning'
      });
    }

    setStatementModal({ isOpen: true, employee: emp, transactions: [], loading: true });
    try {
      const q = query(
        collection(db, 'account_transactions'),
        where('accountId', '==', accId)
      );
      const snap = await getDocs(q);
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      txs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setStatementModal({ isOpen: true, employee: emp, transactions: txs, loading: false });
    } catch (err) {
      console.error('Error loading statement of account:', err);
      setStatementModal({ isOpen: true, employee: emp, transactions: [], loading: false });
    }
  };

  // Check permission
  if (roleLoading) {
    return (
      <div className="flex bg-[#0e0e11] text-white h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded border-2 border-[#d4af37]/25 border-t-[#d4af37]"></div>
      </div>
    );
  }

  if (role !== 'Admin' && !hasPermission('view_employees') && !hasPermission('view_users')) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-850 shadow-xl text-center select-none">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide text-center">{t('accessDenied')}</h2>
        <p className="text-slate-400 max-w-md mb-6">{isAr ? 'عذراً، لا تملك الصلاحية الكافية للوصول لإدارة الموظفين.' : 'Permission denied to view employees management.'}</p>
      </div>
    );
  }

  // Filtered employees
  const filteredEmployees = employees.filter((emp) => {
    const matchSearch =
      (emp.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
      (emp.phone || '').toLowerCase().includes(search.toLowerCase()) ||
      (emp.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (emp.jobsType || '').toLowerCase().includes(search.toLowerCase());
    const matchJob = jobFilter === 'all' || emp.jobsType === jobFilter;
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !emp.disabled) ||
      (statusFilter === 'disabled' && emp.disabled);
    return matchSearch && matchJob && matchStatus;
  });

  const jobTypes = Array.from(new Set(employees.map(e => e.jobsType).filter(Boolean)));
  if (!jobTypes.includes('إداري')) jobTypes.push('إداري');
  if (!jobTypes.includes('محاسب')) jobTypes.push('محاسب');
  if (!jobTypes.includes('سائق')) jobTypes.push('سائق');

  return (
    <div className="space-y-6 pb-20 text-start font-sans selection:bg-[#d4af37]/30">
      
      {/* Title Header */}
      <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-2.5 rounded-2xl text-[#d4af37]">
            <Briefcase className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-none mb-1">{isAr ? 'سجل وإدارة الموظفين' : 'Employees Ledger Management'}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isAr ? 'إدارة الكادر البشري • مسير الرواتب • كشوفات الحسابات المحاسبية' : 'Manage employee profiles, monthly salaries, and financial ledger accounts'}</p>
          </div>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black px-6 py-2.5 rounded-xl flex items-center gap-2 font-black text-sm transition transform active:scale-95 shadow-md shadow-yellow-950/20"
        >
          <Plus className="w-4 h-4" /> {isAr ? 'تسجيل موظف جديد' : 'Enroll New Employee'}
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        
        {/* Filters bar */}
        <div className="p-4 border-b border-slate-850 bg-black/30 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input
              type="text"
              placeholder={isAr ? 'البحث باسم الموظف، الهاتف، البريد أو الوظيفة...' : 'Filter employees...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2 bg-black/50 border border-slate-850 rounded-xl focus:border-[#d4af37]/60 outline-none text-xs text-white placeholder:text-slate-500 font-bold"
            />
          </div>

          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="bg-black/50 border border-slate-850 text-slate-300 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50"
          >
            <option value="all">{isAr ? 'جميع الوظائف' : 'All Job Titles'}</option>
            {jobTypes.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-black/50 border border-slate-850 text-slate-300 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50"
          >
            <option value="all">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
            <option value="active">{isAr ? 'النشطون فقط' : 'Active Only'}</option>
            <option value="disabled">{isAr ? 'الموقوفون فقط' : 'Disabled Only'}</option>
          </select>
        </div>

        {/* Employees Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-850">
              <tr>
                <th className="p-4">{isAr ? 'الموظف' : 'Employee'}</th>
                <th className="p-4">{isAr ? 'الوظيفة' : 'Job Title'}</th>
                <th className="p-4">{isAr ? 'التواصل' : 'Contact'}</th>
                <th className="p-4 text-center">{isAr ? 'الراتب الشهري' : 'Monthly Salary'}</th>
                <th className="p-4 text-center">{isAr ? 'الحساب المالي' : 'Financial Ledger'}</th>
                <th className="p-4 text-center">{isAr ? 'الرصيد المالي' : 'Ledger Balance'}</th>
                <th className="p-4 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="p-4 text-left">{isAr ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-850 bg-black/10">
              {filteredEmployees.map((emp) => {
                const accId = emp.financialAccountId || emp.accountId;
                const liveBal = accId && liveBalances[accId] !== undefined ? liveBalances[accId] : (emp.financialBalance || 0);

                return (
                  <tr key={emp.id} className={`hover:bg-slate-950/40 transition-colors ${emp.disabled ? 'opacity-65' : ''}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3 text-start">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-800 text-[#d4af37] flex items-center justify-center font-black text-xs shrink-0">
                          {emp.fullName?.substring(0, 2) || 'م'}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-extrabold text-white">{emp.fullName}</span>
                          <span className="text-[9px] text-slate-500 font-mono">{emp.address || (isAr ? 'بدون عنوان' : 'No address')}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 font-bold text-slate-300">
                      <span className="bg-slate-900 border border-slate-800 text-amber-400/90 px-3 py-1 rounded-xl text-[10px] font-black">
                        {emp.jobsType || (isAr ? 'إداري' : 'Staff')}
                      </span>
                    </td>

                    <td className="p-4 font-mono text-slate-400 font-bold">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white flex items-center gap-1"><Phone className="w-3 h-3 text-slate-500" />{emp.phone || '—'}</span>
                        {emp.email && <span className="text-[10px] text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3 text-slate-600" />{emp.email}</span>}
                      </div>
                    </td>

                    <td className="p-4 text-center font-mono text-white font-black">
                      {(emp.monthlySalary || 0).toLocaleString()} {emp.currency || 'YER'}
                    </td>

                    <td className="p-4 text-center font-mono text-slate-400 font-bold">
                      {emp.financialAccountCode || accId || '—'}
                    </td>

                    <td className="p-4 text-center font-mono font-black">
                      <span className={liveBal > 0 ? 'text-emerald-400' : liveBal < 0 ? 'text-rose-400' : 'text-slate-400'}>
                        {liveBal.toLocaleString()} {emp.currency || 'YER'}
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      {emp.disabled ? (
                        <span className="bg-rose-950/30 text-rose-400 border border-rose-900/30 px-2.5 py-1 rounded text-[9px] font-black">
                          {isAr ? 'موقوف' : 'Disabled'}
                        </span>
                      ) : (
                        <span className="bg-emerald-950/30 text-emerald-400 border border-emerald-900/30 px-2.5 py-1 rounded text-[9px] font-black">
                          {isAr ? 'نشط' : 'Active'}
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-left flex justify-end gap-2">
                      {/* Statement of Account button */}
                      <button
                        onClick={() => handleOpenStatement(emp)}
                        title={isAr ? 'كشف الحساب المالي' : 'Statement of Account'}
                        className="bg-amber-950/20 text-[#d4af37] hover:bg-amber-950/40 border border-[#d4af37]/30 p-2 rounded-xl transition-all"
                      >
                        <FileText className="w-4 h-4" />
                      </button>

                      {/* Toggle status */}
                      <button
                        onClick={() => handleToggleStatus(emp)}
                        title={emp.disabled ? (isAr ? 'تفعيل' : 'Enable') : (isAr ? 'تعطيل' : 'Disable')}
                        className={`p-2 rounded-xl border transition-all ${
                          emp.disabled
                            ? 'text-emerald-400 bg-emerald-950/10 border-emerald-950/30'
                            : 'text-rose-450 bg-rose-950/10 border-rose-950/40'
                        }`}
                      >
                        {emp.disabled ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                      </button>

                      {/* Edit button */}
                      <button
                        onClick={() => handleOpenEdit(emp)}
                        className="text-white hover:text-[#d4af37] bg-slate-900 border border-slate-800 p-2 rounded-xl transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => setDeletePinConfig({ isOpen: true, entityId: emp.id, entityName: emp.fullName })}
                        className="text-rose-500 hover:bg-rose-950/20 bg-rose-950/10 border border-rose-950/45 p-2 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-16 text-center text-slate-600 font-bold uppercase tracking-widest font-mono text-[10px]">
                    [ no_employee_records_found ]
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden font-sans flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'تسجيل موظف جديد وإنشاء حسابه المالي' : 'Enroll New Employee & Provision Ledger'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-500 hover:text-white bg-slate-900 border border-slate-850 p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="p-6 space-y-4 text-start overflow-y-auto flex-1">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الاسم الكامل للموظف *' : 'Full Name *'}</label>
                <input
                  required
                  type="text"
                  placeholder="مثال: أحمد محمد طاهر"
                  value={addFormData.fullName}
                  onChange={(e) => setAddFormData({ ...addFormData, fullName: e.target.value })}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'المسمى / الموديل الوظيفي' : 'Job Title / Category'}</label>
                  <input
                    type="text"
                    placeholder="إداري / محاسب / سائق..."
                    value={addFormData.jobsType}
                    onChange={(e) => setAddFormData({ ...addFormData, jobsType: e.target.value })}
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'رقم الهاتف' : 'Phone Number'}</label>
                  <input
                    type="text"
                    placeholder="770000000"
                    value={addFormData.phone}
                    onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الراتب الشهري المقرر' : 'Monthly Salary'}</label>
                  <input
                    type="number"
                    min="0"
                    value={addFormData.monthlySalary}
                    onChange={(e) => setAddFormData({ ...addFormData, monthlySalary: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'عملة الراتب' : 'Currency'}</label>
                  <select
                    value={addFormData.currency}
                    onChange={(e) => setAddFormData({ ...addFormData, currency: e.target.value })}
                    className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer"
                  >
                    <option value="YER">YER (ريال يمني)</option>
                    <option value="SAR">SAR (ريال سعودي)</option>
                    <option value="USD">USD (دولار أمريكي)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'البريد الإلكتروني (اختياري)' : 'Email (Optional)'}</label>
                <input
                  type="email"
                  placeholder="employee@swiftship.system"
                  value={addFormData.email}
                  onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'العنوان والمكان' : 'Address'}</label>
                <input
                  type="text"
                  placeholder="صنعاء - الأصبحي"
                  value={addFormData.address}
                  onChange={(e) => setAddFormData({ ...addFormData, address: e.target.value })}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'ملاحظات إضافية' : 'Notes'}</label>
                <textarea
                  rows={2}
                  value={addFormData.notes}
                  onChange={(e) => setAddFormData({ ...addFormData, notes: e.target.value })}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                />
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
                  className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] disabled:opacity-50 text-black font-black text-xs rounded-xl shadow-md transition-all"
                >
                  {addLoading ? (isAr ? 'جاري الإنشاء...' : 'Creating...') : (isAr ? 'إضافة موظف وإنشاء حساب' : 'Enroll Employee')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {isEditModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden font-sans flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <h3 className="font-black text-white text-xs uppercase tracking-widest">{isAr ? 'تعديل بيانات الموظف' : 'Edit Employee Dossier'}</h3>
              <button
                onClick={() => { setIsEditModalOpen(false); setSelectedEmployee(null); }}
                className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="p-6 space-y-4 text-start overflow-y-auto flex-1">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الاسم الكامل للموظف' : 'Full Name'}</label>
                <input
                  required
                  type="text"
                  value={editFormData.fullName}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'المسمى الوظيفي' : 'Job Category'}</label>
                  <input
                    type="text"
                    value={editFormData.jobsType}
                    onChange={(e) => setEditFormData({ ...editFormData, jobsType: e.target.value })}
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'رقم الهاتف' : 'Phone Number'}</label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الراتب الشهري' : 'Monthly Salary'}</label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.monthlySalary}
                    onChange={(e) => setEditFormData({ ...editFormData, monthlySalary: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'عملة الراتب' : 'Currency'}</label>
                  <select
                    value={editFormData.currency}
                    onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value })}
                    className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer"
                  >
                    <option value="YER">YER (ريال يمني)</option>
                    <option value="SAR">SAR (ريال سعودي)</option>
                    <option value="USD">USD (دولار أمريكي)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl py-3 px-4 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'العنوان' : 'Address'}</label>
                <input
                  type="text"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                />
              </div>

              <div className="bg-black/40 border border-slate-850 p-4 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.disabled}
                    onChange={(e) => setEditFormData({ ...editFormData, disabled: e.target.checked })}
                    className="w-4 h-4 text-rose-500 focus:ring-rose-500 bg-black/50 border-slate-850 rounded"
                  />
                  <div className="flex-1 text-start">
                    <span className="block text-xs font-black text-rose-500 uppercase tracking-tighter">{isAr ? 'إيقاف/تعطيل الموظف' : 'Suspend Employee Account'}</span>
                    <span className="block text-[9px] text-slate-500 mt-0.5">{isAr ? 'يمنع إدراج الموظف في العمليات المالية وتنزيل الرواتب' : 'Prevents posting salary entries or transactions'}</span>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setSelectedEmployee(null); }}
                  className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs transition-colors"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] disabled:opacity-50 text-black font-black text-xs rounded-xl shadow-md transition-all"
                >
                  {editLoading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التعديلات' : 'Update Profile')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Statement of Account Modal */}
      {statementModal.isOpen && statementModal.employee && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/30 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden font-sans flex flex-col max-h-[90vh]">
            
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/60 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#d4af37]" />
                <h3 className="font-black text-white text-xs uppercase tracking-widest">
                  {isAr ? `كشف الحساب المالي — ${statementModal.employee.fullName}` : `Statement of Account — ${statementModal.employee.fullName}`}
                </h3>
              </div>
              <button
                onClick={() => setStatementModal({ isOpen: false, employee: null, transactions: [], loading: false })}
                className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Employee Summary header */}
              <div className="grid grid-cols-3 gap-4 bg-black/40 border border-slate-850 p-4 rounded-2xl">
                <div>
                  <span className="block text-[9px] font-black text-slate-500 uppercase">{isAr ? 'الحساب المحاسبي' : 'Account Code'}</span>
                  <span className="block text-xs font-mono font-bold text-white mt-1">{statementModal.employee.financialAccountCode || statementModal.employee.accountId || '—'}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-black text-slate-500 uppercase">{isAr ? 'الراتب الشهر' : 'Monthly Salary'}</span>
                  <span className="block text-xs font-mono font-bold text-amber-400 mt-1">{(statementModal.employee.monthlySalary || 0).toLocaleString()} {statementModal.employee.currency || 'YER'}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-black text-slate-500 uppercase">{isAr ? 'الرصيد المحاسبي المتبقي' : 'Running Balance'}</span>
                  <span className="block text-xs font-mono font-bold text-emerald-400 mt-1">
                    {(liveBalances[statementModal.employee.financialAccountId || statementModal.employee.accountId] || statementModal.employee.financialBalance || 0).toLocaleString()} {statementModal.employee.currency || 'YER'}
                  </span>
                </div>
              </div>

              {/* Transactions Table */}
              {statementModal.loading ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                  <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent animate-spin rounded-full mb-3" />
                  <span className="text-xs font-bold">{isAr ? 'جاري قراءة الحركات المحاسبية...' : 'Fetching ledger transactions...'}</span>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-850 rounded-2xl">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#0a0a0d] text-slate-500 text-[9px] font-black uppercase tracking-wider border-b border-slate-850">
                      <tr>
                        <th className="p-3">{isAr ? 'التاريخ' : 'Date'}</th>
                        <th className="p-3">{isAr ? 'رقم السند/المرجع' : 'Ref #'}</th>
                        <th className="p-3">{isAr ? 'البيان' : 'Description'}</th>
                        <th className="p-3 text-center">{isAr ? 'مدين (Debit)' : 'Debit'}</th>
                        <th className="p-3 text-center">{isAr ? 'دائن (Credit)' : 'Credit'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 bg-black/20 font-mono">
                      {statementModal.transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-900/40">
                          <td className="p-3 text-slate-400 text-[10px]">
                            {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="p-3 font-bold text-amber-400">{tx.refNumber || tx.journalEntryNumber || '—'}</td>
                          <td className="p-3 text-white font-sans font-medium">{tx.description || '—'}</td>
                          <td className="p-3 text-center font-bold text-emerald-400">
                            {tx.type === 'Debit' ? tx.amount?.toLocaleString() : '—'}
                          </td>
                          <td className="p-3 text-center font-bold text-rose-400">
                            {tx.type === 'Credit' ? tx.amount?.toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                      {statementModal.transactions.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-600 font-bold font-mono text-[10px]">
                            [ no_ledger_transactions_recorded ]
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
      />

      {/* Delete PIN Modal */}
      <ConfirmDeletePinModal
        isOpen={deletePinConfig.isOpen}
        onClose={() => setDeletePinConfig({ ...deletePinConfig, isOpen: false })}
        title={isAr ? 'حذف ملف الموظف وحسابه المالي' : 'Purge Employee Record'}
        message={isAr
          ? `هل أنت متأكد من رغبتك في حذف الموظف ${deletePinConfig.entityName}؟ سيتم حذف بياناته وسجله المالي نهائياً.`
          : `Permanently delete employee ${deletePinConfig.entityName} and linked financial records?`}
        isAr={isAr}
        onConfirm={async () => {
          await financialAccountService.purgeEntityAndFinancialFootprint('employee', deletePinConfig.entityId);
          await activityLogService.log('delete_user', deletePinConfig.entityName, { employeeId: deletePinConfig.entityId });
          notificationService.notify({
            title: isAr ? 'تم الحذف' : 'Employee Purged',
            message: isAr ? `تم حذف الموظف ${deletePinConfig.entityName} وسجله بنجاح` : `Deleted ${deletePinConfig.entityName}`,
            type: 'warning'
          });
        }}
      />
    </div>
  );
}
