import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, doc, updateDoc, getDocs, where, increment, writeBatch } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useSettings } from '../context/SettingsContext';
import { useRole } from '../hooks/useRole';
import { notificationService } from '../services/notificationService';
import { activityLogService } from '../services/activityLogService';
import { financialAccountService } from '../services/financialAccountService';
import { Plus, Search, Wallet, DollarSign, Calendar, RefreshCw, Layers, CheckCircle2, AlertTriangle, User, FileText, ArrowUpRight, ArrowDownLeft, Crown, ShieldAlert, Coins, X, Printer, Activity, Edit2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { printContent } from '../lib/printUtils';
import { useLocation, useNavigate } from 'react-router-dom';
import FinanceReports from '../components/FinanceReports';
import ExpenseCategoriesManager from '../components/ExpenseCategoriesManager';
import { useExpenseCategories, DEFAULT_EXPENSE_CATEGORIES } from '../hooks/useExpenseCategories';
import { useExchangeRates } from '../hooks/useExchangeRates';

// Keep this export for backward compatibility for now if needed, but components should transition to the hook
export const EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORIES;

export default function Expenses() {
  const { settings, t } = useSettings();
  const { activeCurrencies, rates: dbRates } = useExchangeRates();
  const { role, hasPermission, profile, loading: roleLoading } = useRole();
  const canViewExpensesPage = role === 'Admin' || hasPermission('view_finance') || hasPermission('view_expenses') || hasPermission('view_custody');
  const canViewCustody = role === 'Admin' || hasPermission('view_custody');
  const canViewGeneralExpenses = role === 'Admin' || hasPermission('view_expenses');
  const canAddExpenses = role === 'Admin' || hasPermission('add_expenses');
  const canEditExpenses = role === 'Admin' || hasPermission('edit_expenses');
  const canViewReports = role === 'Admin' || hasPermission('view_reports');
  const canViewFinance = role === 'Admin' || hasPermission('view_finance');

  const [expenses, setExpenses] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [accountSearchQuery, setAccountSearchQuery] = useState(''); // NEW SEARCH STATE
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false); // NEW DROPDOWN STATE
  const [creditAccountSearchQuery, setCreditAccountSearchQuery] = useState(''); // FOR SOURCE/CREDIT ACCOUNT
  const [isCreditAccountDropdownOpen, setIsCreditAccountDropdownOpen] = useState(false); // FOR SOURCE/CREDIT ACCOUNT
  const [typeFilter, setTypeFilter] = useState('all');
  const isAr = settings.language === 'ar';

  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const activeTab = queryParams.get('tab') || 'expenses'; // 'expenses', 'reports', 'accounting', 'category_manager'
  const activeSubTab = queryParams.get('subtab') || undefined; // e.g. 'salary'
  const EXPENSE_CATEGORIES_DYNAMIC = useExpenseCategories();

  const handleTabChange = (tab: string) => {
    navigate(`/expenses?tab=${tab}`);
  };

  const navTabs = [
    { id: 'expenses', labelAr: 'سجل الخزينة والمصروفات', labelEn: 'Expenses Ledger', icon: Wallet, access: canViewGeneralExpenses || canViewCustody },
    { id: 'reports', labelAr: 'تقارير مالية', labelEn: 'Financial Reports', icon: Activity, access: canViewReports },
    { id: 'category_manager', labelAr: 'تهيئة الفئات', labelEn: 'Expense Categories', icon: Layers, access: canViewFinance }
  ];

  const renderNavTabs = () => (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6 hide-scrollbar border-b border-slate-800">
      {navTabs.filter(t => t.access).map(tab => (
        <button
          key={tab.id}
          onClick={() => handleTabChange(tab.id)}
          className={`px-4 py-3 text-xs font-black rounded-t-xl flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === tab.id 
              ? 'bg-[#d4af37]/10 text-[#d4af37] border-b-2 border-[#d4af37]' 
              : 'text-slate-400 hover:bg-slate-900 hover:text-white'
          }`}
        >
          <tab.icon className="w-4 h-4" />
          {isAr ? tab.labelAr : tab.labelEn}
        </button>
      ))}
    </div>
  );

  const [formData, setFormData] = useState({
    category: 'marketing',
    amount: '',
    currency: 'YER',
    recipientId: '',
    recipientName: '',
    notes: '', // البيان أو الشرح
    remarks: '', // ملاحظات
    factoryName: '',
    linkedAccountId: '',       // NEW: linked financial account ID (Debit Account)
    linkedAccountCode: '',     // NEW: linked financial account code
    linkedAccountEntityType: '' as '' | 'customer' | 'courier' | 'employee',
    salaryMonth: '',            // NEW: salary payment month YYYY-MM
    creditAccountId: '',       // NEW: source financial account ID (Credit Account)
    creditAccountCode: ''      // NEW: source financial account code
  });
  const [selectedDateTime, setSelectedDateTime] = useState('');

  // Editing state for expenses
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Settlement state
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleSubmitting, setSettleSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    category: 'marketing',
    amount: '',
    currency: 'YER',
    recipientName: '',
    notes: '',
    remarks: '',
    createdAt: ''
  });

  const handleRefreshStats = async () => {
    setIsRefreshing(true);
    try {
      const expensesRef = collection(db, 'expenses');
      const q = query(expensesRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const docsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(docsData);
      
      // Also fetch couriers to ensure they are in sync
      const couriersSnap = await getDocs(collection(db, 'couriers'));
      setCouriers(couriersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      notificationService.notify({
        title: isAr ? 'تم تحديث الإحصائيات المالية' : 'Financial Stats Synced',
        message: isAr 
          ? 'تم إعادة حساب إجمالي المصروفات والعهد العالقة مباشرة من الدفاتر الحية.' 
          : 'Total expenses and pending custody figures re-calculated directly from Firestore.',
        type: 'success',
        category: 'finance'
      });
    } catch (err: any) {
      console.error('Error refreshing ledger stats:', err);
      notificationService.notify({
        title: isAr ? 'فشل تحديث البيانات' : 'Sync Failed',
        message: err.message || 'Failed to fetch financial record balances.',
        type: 'error',
        category: 'finance'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (roleLoading) return;

    // Fetch expenses
    const unsubExp = onSnapshot(query(collection(db, 'expenses'), orderBy('createdAt', 'desc')), (snap) => {
      setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setExpensesLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });

    // Fetch couriers for custody recipient selection
    const unsubCouriers = onSnapshot(collection(db, 'couriers'), (snap) => {
      setCouriers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch orders
    const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snap) => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch customers
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch sources
    const unsubSources = onSnapshot(collection(db, 'sources'), (snap) => {
      setSources(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch users (non-couriers) for wages/salary category
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setSystemUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch financial accounts
    const unsubAccounts = onSnapshot(collection(db, 'accounts'), (snap) => {
      setFinancialAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubExp();
      unsubCouriers();
      unsubOrders();
      unsubCustomers();
      unsubSources();
      unsubUsers();
      unsubAccounts();
    };
  }, [roleLoading]);

  // Auto-populate credit account (Source) with General Cash Box when adding a new voucher/expense
  useEffect(() => {
    if (isAddOpen && !formData.creditAccountId && financialAccounts.length > 0) {
      const cashbox = financialAccounts.find(a => a.entityId === 'sys_cash_account' || a.accountCode === '1111-0');
      if (cashbox) {
        setFormData(prev => ({
          ...prev,
          creditAccountId: cashbox.id || '',
          creditAccountCode: cashbox.accountCode || cashbox.code || ''
        }));
      }
    }
  }, [isAddOpen, financialAccounts]);

  const generateExpenseNumber = async () => {
    try {
      const expensesRef = collection(db, 'expenses');
      const snap = await getDocs(expensesRef);
      const curCount = snap.size;
      return `EXP-${String(curCount + 1).padStart(4, '0')}`;
    } catch (err) {
      console.warn("Error generating sequential EXP number:", err);
      const prefix = `EXP-${String(new Date().getFullYear()).slice(-2)}`;
      return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addLoading) return;
    if (!canAddExpenses) {
      return notificationService.notify({
        title: isAr ? 'خطأ بالصلاحيات' : 'Permission Error',
        message: isAr ? 'ليس لديك صلاحية لإدارة المصروفات أو إضافة سندات جديدة' : 'You do not have permission to manage expenses or add new vouchers.',
        type: 'error',
        category: 'finance'
      });
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      return notificationService.notify({
        title: isAr ? 'خطأ مالي' : 'Valuation Error',
        message: isAr ? 'الرجاء إدخال مبلغ دفع صحيح' : 'Please enter a valid ledger amount',
        type: 'error',
        category: 'finance'
      });
    }

    setAddLoading(true);
    try {
      const expenseNumber = await generateExpenseNumber();
      
      let type = 'General';
      if (formData.category === 'custody') {
        type = 'Custody';
      } else if (formData.category === 'factory') {
        type = 'FactoryPayment';
      } else if (formData.category === 'salary') {
        type = 'Salary';
      }

      let recipientName = '';
      let recipientEntityId = '';
      let recipientEntityType: 'customer' | 'courier' | 'employee' | '' = '';
      let linkedAccountId = formData.linkedAccountId || '';
      let linkedAccountCode = formData.linkedAccountCode || '';

      if (type === 'Custody' && formData.recipientId) {
        const found = couriers.find(c => c.id === formData.recipientId);
        recipientName = found ? found.fullName : '';
        recipientEntityId = formData.recipientId;
        recipientEntityType = 'courier';
        // Get the courier's financial account code automatically
        if (!linkedAccountId && found?.financialAccountId) {
          linkedAccountId = found.financialAccountId;
          linkedAccountCode = found.financialAccountCode || '';
        }
      } else if ((formData.category === 'wages' || formData.category === 'salary') && formData.recipientId) {
        const found = systemUsers.find(u => u.id === formData.recipientId);
        recipientName = found ? (found.fullName || found.displayName || found.email) : '';
        recipientEntityId = formData.recipientId;
        recipientEntityType = 'employee';
        if (!linkedAccountId && found?.financialAccountId) {
          linkedAccountId = found.financialAccountId;
          linkedAccountCode = found.financialAccountCode || '';
        }
      } else if (type === 'FactoryPayment') {
        recipientName = formData.factoryName || 'الصين';
        if (linkedAccountId && formData.recipientId) {
          recipientEntityId = formData.recipientId;
          recipientEntityType = formData.linkedAccountEntityType as any;
          recipientName = formData.recipientName || recipientName;
        }
      } else {
        const catObj = EXPENSE_CATEGORIES_DYNAMIC.find(c => c.id === formData.category);
        recipientName = catObj ? (isAr ? catObj.labelAr : catObj.labelEn) : (isAr ? 'المكتب الرئيسي' : 'Head Office');
        if (linkedAccountId && formData.recipientId) {
          recipientEntityId = formData.recipientId;
          recipientEntityType = formData.linkedAccountEntityType as any;
          recipientName = formData.recipientName || recipientName;
        }
      }

      const parsedCreatedAt = selectedDateTime ? new Date(selectedDateTime).getTime() : Date.now();

      // Convert amount to default currency for financial account
      const rawAmount = parseFloat(formData.amount);
      const convertedAmount = financialAccountService.convertToDefaultCurrency(
        rawAmount,
        formData.currency,
        settings.currency || 'SAR',
        { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
      );

      const payload = {
        expenseNumber,
        category: formData.category,
        type,
        amount: rawAmount,
        currency: formData.currency,
        amountInDefaultCurrency: convertedAmount,
        recipientId: (type === 'Custody' || formData.category === 'wages' || formData.category === 'salary') ? formData.recipientId : null,
        recipientEntityId: recipientEntityId || null,
        recipientEntityType: recipientEntityType || null,
        recipientName,
        linkedAccountId: linkedAccountId || null,
        linkedAccountCode: linkedAccountCode || null,
        notes: formData.notes, // البيان أو الشرح
        remarks: formData.remarks, // ملاحظات
        status: type === 'Custody' ? 'Pending' : 'Completed', // Pending custody, Completed expense
        salaryMonth: formData.category === 'salary' ? formData.salaryMonth : null,
        createdByUid: auth.currentUser?.uid || 'system',
        createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
        createdByName: profile?.fullName || 'Root Admin',
        createdAt: parsedCreatedAt
      };

      await addDoc(expenseNumber, collection(db, 'expenses'), payload);

      // --- Financial Account Impact ---
      if (!linkedAccountId || !formData.creditAccountId) {
        throw new Error(isAr ? 'خطأ في تحديد الحسابات المزدوجة.' : 'Source and target accounts must be selected.');
      }

      // Record true standard double-entry transaction:
      // Debit targets/expenses (destination), Credit source (fund source/Cash)
      await financialAccountService.recordTransaction({
        date: parsedCreatedAt,
        description: formData.notes || (isAr ? `سند مصروف: ${expenseNumber}` : `Expense voucher: ${expenseNumber}`),
        module: type === 'Custody' ? 'custody' : (type === 'Salary' ? 'salary' : 'expense'),
        refNumber: expenseNumber,
        amount: rawAmount,
        currency: formData.currency,
        debitAccount: { id: linkedAccountId, code: linkedAccountCode },
        creditAccount: { id: formData.creditAccountId, code: '' },
        createdByUid: auth.currentUser?.uid || 'system',
        createdByName: profile?.fullName || 'Root Admin',
        notes: formData.notes
      });

      // Record in salary history if it is a salary payment (for reports and history tab)
      if (formData.category === 'salary' && recipientEntityId) {
        try {
          await financialAccountService.recordSalaryPayment({
            employeeId: recipientEntityId,
            employeeName: recipientName,
            accountId: linkedAccountId,
            accountCode: linkedAccountCode,
            amount: convertedAmount,
            currency: formData.currency,
            salaryMonth: formData.salaryMonth,
            notes: formData.notes || (isAr ? `صرف راتب شهر ${formData.salaryMonth}` : `Salary payment for ${formData.salaryMonth}`),
            createdByUid: auth.currentUser?.uid || 'system',
            createdByName: profile?.fullName || 'Root Admin'
          });
        } catch (txErr) {
          console.warn('[Expenses] Could not record salary payment history:', txErr);
        }
      }

      // Automatically settle pending custodies if this was a Credit on courier (meaning courier received cash/paying something)
      // or if custody is released, we handle it
      if (type !== 'Custody' && recipientEntityType === 'courier') {
        try {
          await financialAccountService.settlePendingCustodies(
            recipientEntityId,
            rawAmount,
            formData.currency
          );
        } catch (custErr) {
          console.warn('[Expenses] Settle pending custody error:', custErr);
        }
      }

      activityLogService.log('add_expense', expenseNumber, { ...payload });

      notificationService.notify({
        title: isAr ? 'تم تقييد السند بالخزينة بشكل مزدوج' : 'Double-Entry Voucher Logged',
        message: isAr 
          ? `تم صرف وتسجيل القيد في دفاتر الحسابات برقم: ${expenseNumber}` 
          : `Double-entry transaction recorded successfully: ${expenseNumber}`,
        type: 'success',
        category: 'finance'
      });

      setIsAddOpen(false);
      setFormData({
        category: 'marketing',
        amount: '',
        currency: 'YER',
        recipientId: '',
        recipientName: '',
        notes: '',
        remarks: '',
        factoryName: '',
        linkedAccountId: '',
        linkedAccountCode: '',
        linkedAccountEntityType: '',
        salaryMonth: '',
        creditAccountId: '',
        creditAccountCode: ''
      });
    } catch (err) {
      console.error(err);
      notificationService.notify({
        title: 'Error',
        message: 'Could not write transaction.',
        type: 'error',
        category: 'finance'
      });
    } finally {
      setAddLoading(false);
    }
  };

  const handleEditExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.amount || isNaN(parseFloat(editFormData.amount))) {
      return notificationService.notify({
        title: isAr ? 'قيمة المبلغ غير صالحة' : 'Invalid Amount',
        message: isAr ? 'يرجى كتابة مبلغ رقمي موافق للشروط.' : 'Please enter a valid numeric amount.',
        type: 'error'
      });
    }

    setEditLoading(true);
    try {
      const rawAmount = parseFloat(editFormData.amount);
      const exchangeRates = { 
        USD: settings.exchangeRateUSD || 535, 
        SAR: settings.exchangeRateSAR || 140,
        YER: 1
      };
      
      const convertedAmount = financialAccountService.convertToDefaultCurrency(
        rawAmount,
        editFormData.currency,
        settings.currency || 'YER',
        exchangeRates
      );
      
      const parsedCreatedAt = editFormData.createdAt ? new Date(editFormData.createdAt).getTime() : Date.now();

      const batch = writeBatch(db);

      // 1. Check if we have linked account transactions (by expenseNumber vs refNumber)
      if (selectedExpense.expenseNumber) {
        const txQuery = query(collection(db, 'account_transactions'), where('refNumber', '==', selectedExpense.expenseNumber));
        const txSnap = await getDocs(txQuery);

        txSnap.docs.forEach((txDoc) => {
          const txData = txDoc.data();
          
          // CRITICAL: Calculate new amount in the account's specific currency
          const legNewAmount = financialAccountService.convertToTargetCurrency(
            rawAmount,
            editFormData.currency,
            txData.currency || 'YER',
            exchangeRates
          );

          const diffVal = legNewAmount - (txData.amount || 0);
          const delta = txData.type === 'Debit' ? diffVal : -diffVal;

          batch.update(txDoc.ref, {
            amount: legNewAmount,
            amountOriginal: rawAmount,
            currencyOriginal: editFormData.currency,
            description: editFormData.notes || txData.description,
            createdAt: parsedCreatedAt,
            updatedAt: Date.now()
          });

          // Update Account Balance
          if (txData.accountId) {
            const accRef = doc(db, 'accounts', txData.accountId);
            batch.update(accRef, {
              balance: increment(delta),
              debitTotal: txData.type === 'Debit' ? increment(diffVal) : increment(0),
              creditTotal: txData.type === 'Credit' ? increment(diffVal) : increment(0),
              updatedAt: Date.now()
            });
          }

          // Update Entity Balance
          if (txData.entityType && txData.entityType !== 'system' && txData.entityId) {
            const entityCollection = financialAccountService.getEntityCollection(txData.entityType);
            const entityRef = doc(db, entityCollection, txData.entityId);
            batch.update(entityRef, {
              financialBalance: increment(delta),
              updatedAt: Date.now()
            });
          }
        });
      }

      // 2. Update the Expense document itself
      const expenseRef = doc(db, 'expenses', selectedExpense.id);
      batch.update(expenseRef, {
        category: editFormData.category,
        amount: rawAmount,
        currency: editFormData.currency,
        amountInDefaultCurrency: convertedAmount,
        recipientName: editFormData.recipientName,
        notes: editFormData.notes,
        remarks: editFormData.remarks,
        createdAt: parsedCreatedAt,
        updatedAt: Date.now()
      });

      await batch.commit();

      activityLogService.log('edit_expense' as any, selectedExpense.expenseNumber, {
        id: selectedExpense.id,
        category: editFormData.category,
        amount: rawAmount,
        currency: editFormData.currency
      });

      notificationService.notify({
        title: isAr ? 'تم تعديل السند بنجاح' : 'Voucher Updated',
        message: isAr ? 'تم حفظ التعديلات وإعادة مطابقة الدفاتر الحسابية بنجاح.' : 'Voucher changed & general ledger adjusted accordingly.',
        type: 'success',
        category: 'finance'
      });

      setIsEditOpen(false);
      setSelectedExpense(null);
    } catch (err: any) {
      console.error('[EditExpense] failed:', err);
      notificationService.notify({
        title: 'Error',
        message: err.message || 'Could not update voucher transaction.',
        type: 'error',
        category: 'finance'
      });
    } finally {
      setEditLoading(false);
    }
  };

  const openSettleModal = (exp: any) => {
    if (!canEditExpenses) {
      return notificationService.notify({
        title: isAr ? 'خطأ بالصلاحيات' : 'Permission Error',
        message: isAr ? 'ليس لديك صلاحية لتسوية العهد المالية.' : 'You do not have permission to settle financial custody.',
        type: 'error',
        category: 'finance'
      });
    }
    const remainingToSettle = (parseFloat(exp.amount) || 0) - (parseFloat(exp.remittedAmount) || 0);
    setSettleAmount(remainingToSettle.toString());
    setSelectedExpense(exp);
    setIsSettleModalOpen(true);
  };

  const handleConfirmSettleCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpense || !settleAmount || settleSubmitting) return;

    const amountToRemit = parseFloat(settleAmount);
    if (isNaN(amountToRemit) || amountToRemit <= 0) {
      return notificationService.notify({
        title: isAr ? 'مبلغ غير صالح' : 'Invalid Amount',
        message: isAr ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount',
        type: 'error'
      });
    }

    setSettleSubmitting(true);
    try {
      const exp = selectedExpense;
      const currentRemitted = parseFloat(exp.remittedAmount) || 0;
      const currentRemittedDefault = parseFloat(exp.remittedAmountInDefaultCurrency) || 0;
      const totalAmount = parseFloat(exp.amount) || 0;
      
      const newRemitted = currentRemitted + amountToRemit;
      const isFullySettled = newRemitted >= totalAmount;

      const settledAmountInDefaultCurrency = financialAccountService.convertToDefaultCurrency(
        amountToRemit,
        exp.currency || 'YER',
        settings.currency || 'SAR',
        { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
      );
      
      const newRemittedDefault = currentRemittedDefault + settledAmountInDefaultCurrency;

      await updateDoc(doc(db, 'expenses', exp.id), {
        status: isFullySettled ? 'Settled' : 'Pending',
        remittedAmount: newRemitted,
        remittedAmountInDefaultCurrency: newRemittedDefault,
        settledAt: isFullySettled ? Date.now() : exp.settledAt || null,
        settledByEmail: isFullySettled ? (auth.currentUser?.email || 'admin') : null,
        settledByName: isFullySettled ? (profile?.fullName || 'Root Admin') : null,
        updatedAt: Date.now()
      });

      // --- Financial Account Reversal: Debit on courier's account (returning the custody) ---
      if (exp.linkedAccountId && exp.recipientEntityId) {
        try {
          const systemAccs = await financialAccountService.ensureSystemAccounts('YER');

          await financialAccountService.recordTransaction({
            date: Date.now(),
            description: isAr ? `تسوية/سداد عهدة (${amountToRemit} ${exp.currency || ''}): ${exp.expenseNumber}` : `Custody settlement (${amountToRemit} ${exp.currency}): ${exp.expenseNumber}`,
            module: 'custody',
            refNumber: `${exp.expenseNumber}-SETTLE-${Math.floor(Math.random()*1000)}`,
            amount: amountToRemit,
            currency: exp.currency || 'YER',
            debitAccount: { id: systemAccs['sys_cash_account'], code: '1111-0' }, // Returned to cash box
            creditAccount: { id: exp.linkedAccountId, code: exp.linkedAccountCode || '2120' }, // Credited from courier
            createdByUid: auth.currentUser?.uid || 'system',
            createdByName: profile?.fullName || 'Root Admin'
          });
        } catch (txErr) {
          console.warn('[Expenses] Could not record settlement on financial account:', txErr);
        }
      }

      activityLogService.log('settle_custody', exp.recipientName || exp.recipientId, { id: exp.id, amount: amountToRemit, type: isFullySettled ? 'Full' : 'Partial' });
      notificationService.notify({
        title: isAr ? 'تم تسجيل السداد' : 'Remittance Logged',
        message: isFullySettled ? (isAr ? `تمت تسوية العهدة بالكامل للمندوب ${exp.recipientName}` : `Custody balance fully cleared for ${exp.recipientName}`) : (isAr ? `تم تسجيل تسوية جزئية ببلغ ${amountToRemit}` : `Partial settlement of ${amountToRemit} recorded`),
        type: 'success',
        category: 'finance'
      });
      
      setIsSettleModalOpen(false);
      setSelectedExpense(null);
      setSettleAmount('');
    } catch (err) {
      console.error(err);
      notificationService.notify({
        title: 'Error',
        message: 'Could not settle custody.',
        type: 'error',
        category: 'finance'
      });
    } finally {
      setSettleSubmitting(false);
    }
  };

  // Set default type on mount/open based on permissions
  useEffect(() => {
    if (isAddOpen) {
      // Setup current local time formatted for input type="datetime-local" (YYYY-MM-DDTHH:mm)
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
      setSelectedDateTime(localISOTime);

      if (canViewGeneralExpenses) {
        setFormData(prev => ({ ...prev, category: 'marketing' }));
      } else if (canViewCustody) {
        setFormData(prev => ({ ...prev, category: 'custody' }));
      }
    }
  }, [isAddOpen, canViewGeneralExpenses, canViewCustody]);

  // Allowed expenses based on user permissions
  const allowedExpenses = expenses.filter(exp => {
    if (exp.type === 'Custody' && !canViewCustody) return false;
    if ((exp.type === 'General' || exp.type === 'FactoryPayment' || exp.type === 'Salary') && !canViewGeneralExpenses) return false;
    // Strictly hide external general entries that are not mapped to an expense category
    if (!EXPENSE_CATEGORIES_DYNAMIC.some(c => c.id === exp.category)) return false;
    return true;
  });

  const convertToYER = (amount: number, currency: string) => {
    return financialAccountService.convertToDefaultCurrency(
      amount,
      currency,
      settings.currency || 'YER',
      dbRates
    );
  };

  const getCategoryDetails = (exp: any) => {
    let catId = exp.category;
    if (!catId) {
      if (exp.type === 'Custody') catId = 'custody';
      else if (exp.type === 'FactoryPayment') catId = 'factory';
      else catId = 'other';
    }
    return EXPENSE_CATEGORIES_DYNAMIC.find(c => c.id === catId) || EXPENSE_CATEGORIES_DYNAMIC[EXPENSE_CATEGORIES_DYNAMIC.length - 1];
  };

  // Calculations for stats using dynamic currency exchange rates
  const totalGeneralExpensesYER = allowedExpenses
    .filter(e => e.type === 'General' || e.type === 'FactoryPayment')
    .reduce((sum, e) => sum + convertToYER(e.amount || 0, e.currency), 0);

  const totalGeneralExpensesUSD = allowedExpenses
    .filter(e => e.category === 'factory')
    .reduce((sum, e) => {
      const amt = parseFloat(e.amount || '0');
      if (e.currency === 'USD') return sum + amt;
      if (e.currency === 'YER') {
        const rateUSD = parseFloat(settings.exchangeRateUSD as any || '535');
        return sum + (amt / rateUSD);
      }
      if (e.currency === 'SAR') {
        const rateSAR = parseFloat(settings.exchangeRateSAR as any || '140');
        const rateUSD = parseFloat(settings.exchangeRateUSD as any || '535');
        return sum + ((amt * rateSAR) / rateUSD);
      }
      return sum + amt;
    }, 0);

  const totalPendingCustodies = allowedExpenses
    .filter(e => e.type === 'Custody' && e.status === 'Pending')
    .reduce((sum, e) => sum + convertToYER(e.amount || 0, e.currency), 0);

  const totalSettledCustodies = allowedExpenses
    .filter(e => e.type === 'Custody' && e.status === 'Settled')
    .reduce((sum, e) => sum + convertToYER(e.amount || 0, e.currency), 0);

  const transliterateArabic = (text: string): string => {
    if (!text) return '';
    const mapping: Record<string, string> = {
      'أ': 'A', 'ا': 'A', 'ب': 'B', 'ت': 'T', 'ث': 'Th', 'ج': 'J', 'ح': 'H', 'خ': 'Kh',
      'د': 'D', 'ذ': 'Dh', 'ر': 'R', 'ز': 'Z', 'س': 'S', 'ش': 'Sh', 'ص': 'S', 'ض': 'D',
      'ط': 'T', 'ظ': 'Dh', 'ع': 'A', 'غ': 'Gh', 'ف': 'F', 'ق': 'Q', 'ك': 'K', 'ل': 'L',
      'م': 'M', 'ن': 'N', 'ه': 'H', 'و': 'W', 'ي': 'Y', 'ى': 'Y', 'ة': 'h', 'ئ': 'Y',
      'ؤ': 'W', ' ': ' ', 'ﻻ': 'La', 'لأ': 'La'
    };
    return text.split('').map(char => mapping[char] || char).join('');
  };

  const exportExpensesToPDF = () => {
    const reportTitle = isAr ? 'كشف المصروفات والعهد المالية' : 'Administrative Expenses Ledger';
    printContent(reportTitle, 'expenses-ledger-table', isAr);
    
    activityLogService.log('export_pdf', `Expenses list report`, {
      count: filteredExpenses.length
    });
  };

  const exportExpensesToCSV = () => {
    const headers = [
      isAr ? 'رقم السند' : 'ID Voucher',
      isAr ? 'اسم المستلم' : 'Recipient',
      isAr ? 'بند المصروف' : 'Category',
      isAr ? 'البيان أو الشرح' : 'Statement / Explanation',
      isAr ? 'المبلغ' : 'Amount',
      isAr ? 'العملة' : 'Currency',
      isAr ? 'بواسطة' : 'Created By',
      isAr ? 'ملاحظات' : 'Remarks',
      isAr ? 'الحالة' : 'Status'
    ];
    
    const csvLines = [headers.join(',')];
    
    filteredExpenses.forEach(exp => {
      const catObj = getCategoryDetails(exp);
      const catLabel = isAr ? catObj.labelAr : catObj.labelEn;
      const row = [
        `"${exp.expenseNumber || ''}"`,
        `"${(exp.recipientName || '').replace(/"/g, '""')}"`,
        `"${catLabel.replace(/"/g, '""')}"`,
        `"${(exp.notes || '').replace(/"/g, '""')}"`,
        exp.amount || 0,
        `"${exp.currency || ''}"`,
        `"${(exp.createdByEmail || '').replace(/"/g, '""')}"`,
        `"${(exp.remarks || '').replace(/"/g, '""')}"`,
        `"${exp.status || ''}"`
      ];
      csvLines.push(row.join(','));
    });
    
    const csvContent = "\uFEFF" + csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AlXpress_Expenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredExpenses = allowedExpenses.filter(exp => {
    const num = (exp.expenseNumber || '').toUpperCase();
    const recipient = (exp.recipientName || '').toLowerCase();
    const notes = (exp.notes || '').toLowerCase();
    const remarksVal = (exp.remarks || '').toLowerCase();
    const q = searchText.toLowerCase();

    const matchesSearch = num.includes(q.toUpperCase()) || recipient.includes(q) || notes.includes(q) || remarksVal.includes(q);
    const cat = getCategoryDetails(exp);
    const matchesType = typeFilter === 'all' || exp.type === typeFilter || cat.id === typeFilter;

    return matchesSearch && matchesType;
  }).sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  if (roleLoading || expensesLoading) {
    return (
      <div className="flex bg-[#0e0e11] text-white h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded border-2 border-[#d4af37]/25 border-t-[#d4af37]"></div>
      </div>
    );
  }

  if (!canViewExpensesPage) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-850 shadow-xl text-center select-none">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide text-center">{t('accessDenied')}</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">{isAr ? 'صفحة الخزينة والمصروفات والعهد مخصصة للمخولين مالياً فقط.' : 'This financial ledger console is restricted to authorized financial officers.'}</p>
      </div>
    );
  }

  if (activeTab === 'reports') {
    if (!canViewReports) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-850 shadow-xl text-center select-none">
          <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
          <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide text-center">{t('accessDenied')}</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">{isAr ? 'ليس لديك صلاحية لعرض مركز التقارير والتحليلات.' : 'You do not have permission to view the executive reports and analytics.'}</p>
        </div>
      );
    }
    return (
      <div className="space-y-6 pb-20 text-start font-sans">
        {renderNavTabs()}
        {/* Reports Header */}
        <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-2.5 rounded-2xl text-[#d4af37]">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white leading-none mb-1">
                {isAr ? 'مركز التقارير والتحليلات البيانية المتقدمة' : 'Executive Reports & Analytics Center'}
              </h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {isAr ? 'إحصاءات التدفق المالي الحي • كشاف الحسابات المجمع • مصادر الشحنات وعوائد المناديب' : 'Real-time financial flows • Shipped cargo yield • Custom PDF report compilation'}
              </p>
            </div>
          </div>
        </div>

        {/* Reports Component */}
        <FinanceReports 
          orders={orders}
          expenses={expenses}
          couriers={couriers}
          sources={sources}
          isAr={isAr}
          settings={settings}
        />
      </div>
    );
  }

  if (activeTab === 'category_manager') {
    if (!canViewFinance) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-850 shadow-xl text-center select-none">
          <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
          <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide text-center">{t('accessDenied')}</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">{isAr ? 'ليس لديك صلاحية لإدارة المحاسبة وشجرة الحسابات.' : 'You do not have permission to manage the system chart of accounts.'}</p>
        </div>
      );
    }
    return (
      <div className="space-y-6 pb-20 text-start font-sans">
        {renderNavTabs()}
        <ExpenseCategoriesManager isAr={isAr} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-start transition-colors font-sans selection:bg-[#d4af37]/30">
      {renderNavTabs()}
      {/* Upper header */}
      <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg shadow-black/3c">
        <div className="flex items-center gap-3">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-2.5 rounded-2xl text-[#d4af37]">
            <Wallet className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-none mb-1">
              {isAr ? 'الخزينة العامة والمصروفات والعهد' : 'Expenses & Custody Ledger'}
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {isAr ? 'تقييد الفواتير التشغيلية • العهد العالقة للمناديب • توازن كتل الصندوق' : 'Corporate cash • Courier custody settlements • Profit / Loss Ledger'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button 
            type="button"
            onClick={handleRefreshStats}
            disabled={isRefreshing}
            className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-350 hover:text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs transition active:scale-95 shadow-md cursor-pointer disabled:opacity-50 select-none animate-fade-in"
          >
            <RefreshCw className={`w-4 h-4 text-[#d4af37] ${isRefreshing ? 'animate-spin' : ''}`} />
            {isAr ? 'تحديث الحسابات والعهد' : 'Refresh Financial Stats'}
          </button>

          <button 
            onClick={exportExpensesToPDF}
            className="bg-slate-950 hover:bg-slate-900 border border-[#d4af37]/25 text-[#d4af37] px-4 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs transition active:scale-95 shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4" /> {isAr ? 'طباعة تقرير PDF' : 'PDF Report'}
          </button>
          
          <button 
            onClick={exportExpensesToCSV}
            className="bg-slate-950 hover:bg-slate-905 border border-emerald-900 text-emerald-400 px-4 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs transition active:scale-95 shadow-md cursor-pointer"
          >
            <Activity className="w-4 h-4" /> {isAr ? 'تصدير CSV' : 'Export CSV'}
          </button>

          {canAddExpenses && (
            <button 
              onClick={() => setIsAddOpen(true)}
              className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black px-5 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs transition transform active:scale-95 shadow-md shadow-yellow-950/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> {isAr ? 'سند جديد' : 'New Voucher'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className={`grid grid-cols-1 ${
        canViewGeneralExpenses && canViewCustody 
          ? 'md:grid-cols-4' 
          : (canViewGeneralExpenses || canViewCustody ? 'md:grid-cols-2' : 'hidden')
      } gap-4`}>
        
        {/* KPI 1 */}
        {canViewGeneralExpenses && (
          <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 p-4 rounded-2xl relative overflow-hidden shadow">
            <span className="text-[9px] text-slate-500 font-black uppercase block tracking-wider mb-2">
              {isAr ? `المصروفات العامة والتشغيلية (${settings.currency || 'YER'})` : `General Expenses (${settings.currency || 'YER'})`}
            </span>
            <span className="text-lg font-mono font-black text-[#d4af37]">{totalGeneralExpensesYER.toLocaleString()} {settings.currency || 'YER'}</span>
            <div className="absolute top-2.5 right-2.5 p-1 text-rose-500 bg-rose-950/20 rounded-lg border border-rose-900/30">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
        )}

        {/* KPI 2 */}
        {canViewGeneralExpenses && (
          <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 p-4 rounded-2xl relative overflow-hidden shadow">
            <span className="text-[9px] text-slate-500 font-black uppercase block tracking-wider mb-2">
              {isAr ? 'سداد تكاليف طلبات وشحن (USD)' : 'Paying Order & Shipping Costs (USD)'}
            </span>
            <span className="text-lg font-mono font-black text-emerald-400">
              ${totalGeneralExpensesUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </span>
            <div className="absolute top-2.5 right-2.5 p-1 text-emerald-400 bg-emerald-950/20 rounded-lg border border-emerald-900/30">
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>
        )}

        {/* KPI 3 */}
        {canViewCustody && (
          <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 p-4 rounded-2xl relative overflow-hidden shadow">
            <span className="text-[9px] text-slate-500 font-black uppercase block tracking-wider mb-2">
              {isAr ? 'العهد المستلمة للمناديب العالقة' : 'Active Custody in Hand'}
            </span>
            <span className="text-lg font-mono font-black text-amber-500">{totalPendingCustodies.toLocaleString()} {settings.currency || 'YER'}</span>
            <div className="absolute top-2.5 right-2.5 p-1 text-[#d4af37] bg-yellow-950/20 rounded-lg border border-yellow-900/30">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
        )}

        {/* KPI 4 */}
        {canViewCustody && (
          <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 p-4 rounded-2xl relative overflow-hidden shadow">
            <span className="text-[9px] text-slate-500 font-black uppercase block tracking-wider mb-2">
              {isAr ? 'العهد المالية التي تمت تصفيتها' : 'Gross Settled Custodies'}
            </span>
            <span className="text-lg font-mono font-black text-emerald-400">{totalSettledCustodies.toLocaleString()} {settings.currency || 'YER'}</span>
            <div className="absolute top-2.5 right-2.5 p-1 text-emerald-400 bg-emerald-950/20 rounded-lg border border-emerald-900/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
        )}

      </div>

      {/* Main Filter Section */}
      <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
        
        {/* Filter belt */}
        <div className="p-4 border-b border-slate-850 bg-black/30 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-550 w-4 h-4" />
            <input 
              type="text" 
              placeholder={isAr ? "بحث بالرقم المرجعي للسند أو غرض المصروف أو المستلم..." : "Search ledger entries..."}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pr-10 pl-4 py-2 bg-black/50 border border-slate-850 text-white rounded-xl focus:border-[#d4af37]/60 outline-none text-xs text-start font-bold"
            />
          </div>

          <select 
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value)} 
            className="bg-black/50 border border-slate-850 text-slate-300 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50 cursor-pointer"
          >
            <option value="all">{isAr ? 'جميع المعاملات المالية' : 'All Transactions'}</option>
            {canViewGeneralExpenses && (
              <>
                <option value="General">{isAr ? 'مصروفات تشغيلية عامة' : 'General Office Expenses'}</option>
                <option value="FactoryPayment">{isAr ? 'الحوالات وسداد المصانع' : 'Manufacturer Payments'}</option>
              </>
            )}
            {canViewCustody && (
              <option value="Custody">{isAr ? 'سندات عهد المناديب' : 'Courier Custody Slips'}</option>
            )}
            <option disabled>── {isAr ? 'الفئات التفصيلية' : 'Detailed Categories'} ──</option>
            {EXPENSE_CATEGORIES_DYNAMIC.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {isAr ? cat.labelAr : cat.labelEn}</option>
            ))}
          </select>
        </div>

        {/* Table logs */}
        <div className="overflow-x-auto" id="expenses-ledger-table">
          <table className="w-full text-start">
            <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-850">
              <tr>
                <th className="p-4">{isAr ? 'رقم السند المرجعي' : 'Voucher ID'}</th>
                <th className="p-4">{isAr ? 'بند المصروف وقسمه' : 'Expense Category'}</th>
                <th className="p-4">{isAr ? 'قيمة المبلغ والعملة' : 'Logged Amount'}</th>
                <th className="p-4">{isAr ? 'الجهة المستلمة' : 'Discharge Recipient'}</th>
                <th className="p-4">{isAr ? 'البيان وشرح المصروف' : 'Statement & Remarks'}</th>
                <th className="p-4">{isAr ? 'حالة التقييد' : 'Status'}</th>
                <th className="p-4 text-left">{isAr ? 'التحكيم والتسوية' : 'Reconciliation'}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-850 bg-black/10">
              {filteredExpenses.map((exp, idx) => {
                const isSettleBtnVisible = exp.type === 'Custody' && exp.status === 'Pending' && canEditExpenses;
                const formattedDate = new Date(exp.createdAt || Date.now()).toLocaleString(isAr ? 'ar-YE' : 'en-US', { dateStyle: 'short', timeStyle: 'short' });
                return (
                  <tr key={`${exp.id}-${idx}`} className="hover:bg-slate-950/40 transition-colors">
                    <td className="p-4 font-mono font-black text-slate-400">
                      <div className="flex flex-col gap-1 text-start">
                        <span className="bg-slate-900 border border-slate-800 text-[#d4af37] px-2.5 py-0.5 rounded text-[10px] font-black w-max">
                          {exp.expenseNumber}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold block mt-1">
                          {formattedDate}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-start">
                      {(() => {
                        const cat = getCategoryDetails(exp);
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-slate-850 bg-slate-900 text-[11px] font-black text-slate-300">
                            <span>{cat.icon}</span>
                            <span>{isAr ? cat.labelAr : cat.labelEn}</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-4 font-mono font-black text-white text-start">
                      {exp.amount?.toLocaleString()} <span className="text-[10px] text-slate-500 font-sans">{exp.currency}</span>
                    </td>
                    <td className="p-4 font-bold text-slate-300 text-start">
                      <div className="flex flex-col text-start">
                        <span 
                          onClick={() => {
                            if (exp.recipientEntityId && (exp.recipientEntityType === 'customer' || exp.recipientEntityType === 'courier')) {
                              window.dispatchEvent(new CustomEvent('open-entity-ledger', { 
                                detail: { entityId: exp.recipientEntityId, entityType: exp.recipientEntityType } 
                              }));
                            }
                          }}
                          className={
                            exp.recipientEntityId && (exp.recipientEntityType === 'customer' || exp.recipientEntityType === 'courier')
                              ? 'hover:text-[#d4af37] cursor-pointer underline decoration-dotted decoration-[#d4af37]/40 transition-colors'
                              : ''
                          }
                        >
                          {exp.recipientName || '—'}
                        </span>
                        {exp.linkedAccountCode && (
                          <span className="font-mono font-black text-[#d4af37] text-[9.5px] mt-1 bg-[#d4af37]/10 border border-[#d4af37]/20 px-1.5 py-0.5 rounded w-max">
                            {exp.linkedAccountCode}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-slate-300 text-[11px] max-w-sm truncate text-start">
                      <span className="font-bold text-slate-200 block">{exp.notes || '—'}</span>
                      {exp.remarks && (
                        <span className="text-[10px] text-slate-500 block italic mt-1 font-sans">
                          💡 {isAr ? 'ملاحظة: ' : 'Note: '}{exp.remarks}
                        </span>
                      )}
                      <span className="text-[9px] text-slate-550 block font-normal mt-1">بواسطة: {exp.createdByName || 'مجهول'}</span>
                    </td>
                    <td className="p-4 text-start">
                      {exp.status === 'Completed' && (
                        <span className="bg-emerald-950/25 text-emerald-400 border border-emerald-950/50 text-[9px] font-black px-2 py-0.5 rounded">
                          {isAr ? 'مقبول ومعتمد' : 'APPROVED'}
                        </span>
                      )}
                      {exp.status === 'Pending' && (
                        <span className="bg-amber-950/25 text-amber-500 border border-amber-950/50 text-[9px] font-black px-2 py-0.5 rounded animate-pulse">
                          {isAr ? 'عهدة معلقة' : 'HELD CUSTODY'}
                        </span>
                      )}
                      {exp.status === 'Settled' && (
                        <span className="bg-emerald-900/10 text-emerald-400 border border-emerald-900/30 text-[9px] font-black px-2 py-0.5 rounded">
                          {isAr ? 'تمت تصفيتها' : 'SETTLED & DISCHARGED'}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-left">
                      <div className="flex items-center justify-end gap-2 shrink-0">
                        {isSettleBtnVisible && (
                          <button 
                            onClick={() => openSettleModal(exp)}
                            className="bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-black hover:border-transparent px-3 py-1.5 rounded-xl font-black text-[10px] transition-all cursor-pointer"
                          >
                            {isAr ? 'تأكيد التصفية والتسليم' : 'Discharge Vault'}
                          </button>
                        )}
                        {canEditExpenses && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedExpense(exp);
                              setEditFormData({
                                category: exp.category || 'marketing',
                                amount: exp.amount?.toString() || '',
                                currency: exp.currency || 'YER',
                                recipientName: exp.recipientName || '',
                                notes: exp.notes || '',
                                remarks: exp.remarks || '',
                                createdAt: new Date(exp.createdAt || Date.now()).toISOString().substring(0, 16)
                              });
                              setIsEditOpen(true);
                            }}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer"
                            title={isAr ? 'تعديل السند المالي' : 'Edit Voucher Details'}
                          >
                            <Edit2 className="w-3.5 h-3.5 text-[#d4af37]" />
                            {isAr ? 'تعديل' : 'Edit'}
                          </button>
                        )}
                        {!isSettleBtnVisible && !canEditExpenses && (
                          <span className="text-[9px] text-slate-600 font-bold font-mono uppercase">
                            {exp.status === 'Settled' ? (isAr ? 'مغلق ومسوى' : 'RECONCILED') : (isAr ? 'مثبت' : 'LOCKED')}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-16 text-center text-slate-500 font-bold font-mono text-[10px] uppercase select-none">
                    [ no_ledger_vouchers_recorded ]
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settle Custody Modal overlay */}
      {isSettleModalOpen && selectedExpense && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleConfirmSettleCustody} className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden font-sans">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'تأكيد التسوية والتصفية للعهدة' : 'Settle Custody'}
              </h3>
              <button 
                type="button" 
                onClick={() => { setIsSettleModalOpen(false); setSelectedExpense(null); setSettleAmount(''); }} 
                className="text-slate-500 hover:text-white p-1 bg-slate-900 border border-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                <div className="text-[10px] text-slate-500 font-bold mb-1">{isAr ? 'العهدة المالية المستلمة:' : 'Custody Amount:'}</div>
                <div className="font-mono font-black text-emerald-400 text-lg">
                  {parseFloat(selectedExpense.amount || 0).toLocaleString()} {selectedExpense.currency || 'YER'}
                </div>
                {parseFloat(selectedExpense.remittedAmount || 0) > 0 && (
                  <div className="text-[10px] text-slate-400 font-bold mt-1">
                    {isAr ? 'المبلغ المسدد مسبقاً:' : 'Already Remitted:'} <span className="font-mono text-white">{parseFloat(selectedExpense.remittedAmount).toLocaleString()} {selectedExpense.currency || 'YER'}</span>
                  </div>
                )}
                {selectedExpense.recipientName && (
                  <div className="text-[10px] text-slate-400 font-bold mt-1">
                    {isAr ? 'المندوب:' : 'Courier:'} <span className="text-white">{selectedExpense.recipientName}</span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase">{isAr ? 'المبلغ المراد تسويته (تصفية)' : 'Amount to Remit/Settle'}</label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-black text-[10px] select-none pointer-events-none">
                    {selectedExpense.currency || 'YER'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-[#d4af37]/30 rounded-xl p-3 outline-none focus:border-[#d4af37] text-white text-sm font-mono font-bold transition-all pr-12 focus:shadow-[0_0_15px_rgba(212,175,55,0.15)] shadow-inner placeholder:text-slate-700"
                    placeholder={isAr ? 'أدخل المبلغ المسدد فعلياً...' : 'Enter remitted amount...'}
                  />
                </div>
                <p className="text-[9px] text-slate-500 font-bold">{isAr ? 'سيتم توليد قيد مالي بالقيمة المدخلة وإضافته كرصيد دائن للمندوب.' : 'A credit transaction will be logged for the entered amount.'}</p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-850 flex justify-end gap-3 shrink-0">
              <button 
                type="button" 
                disabled={settleSubmitting}
                onClick={() => { setIsSettleModalOpen(false); setSelectedExpense(null); setSettleAmount(''); }} 
                className="px-5 py-2.5 text-slate-400 hover:bg-slate-800 rounded-xl transition-all font-bold text-[10px] disabled:opacity-50"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                type="submit" 
                disabled={settleSubmitting}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-black rounded-xl transition-all text-xs flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {settleSubmitting ? (isAr ? 'جاري الترحيل...' : 'Processing...') : (isAr ? 'تأكيد التسوية والترحيل' : 'Confirm Settlement')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Expenses Modal overlay */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddExpense} className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden font-sans">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'تسجيل وتقييد مصروف أو عهدة مالية' : 'Issue Strategic Settlement Voucher'}
              </h3>
              <button 
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-start">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'التاريخ والوقت تلقائي' : 'Date and Time'}</label>
                  <input 
                    type="datetime-local" 
                    value={selectedDateTime} 
                    onChange={(e) => setSelectedDateTime(e.target.value)}
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'العملة المساندة' : 'Trade Currency'}</label>
                  <select 
                    value={formData.currency}
                    onChange={(e) => setFormData({...formData, currency: e.target.value})}
                    className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer"
                  >
                    {(activeCurrencies.length > 0 ? activeCurrencies : [{ code: 'YER', main_nameAR: 'ريال يمني' }, { code: 'SAR', main_nameAR: 'ريال سعودي' }, { code: 'USD', main_nameAR: 'دولار أمريكي' }]).map(c => (
                      <option key={c.code} value={c.code}>{c.code} — {(c as any).main_nameAR || c.code}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider">{isAr ? 'بند المصروف' : 'Expense Category'}</label>
                <div className="grid grid-cols-2 gap-2">
                  {EXPENSE_CATEGORIES_DYNAMIC.map(cat => {
                    if (cat.id === 'custody' && !canViewCustody) return null;
                    if (cat.id !== 'custody' && !canViewGeneralExpenses) return null;
                    const isActive = formData.category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          const resolvedAcc = financialAccounts.find(a => 
                            a.id === cat.accountId || 
                            a.entityId === cat.accountId || 
                            (a.accountCode && a.accountCode === cat.accountId) ||
                            (a.code && a.code === cat.accountId)
                          );
                          setFormData({
                            ...formData, 
                            category: cat.id, 
                            linkedAccountId: resolvedAcc ? resolvedAcc.id : (cat.accountId || formData.linkedAccountId),
                            linkedAccountCode: resolvedAcc ? (resolvedAcc.accountCode || resolvedAcc.code) : (cat.accountCode || formData.linkedAccountCode)
                          });
                        }}
                        className={`p-2 rounded-xl border text-start flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                          isActive 
                            ? 'bg-[#d4af37]/15 border-[#d4af37] text-white font-black' 
                            : 'bg-black/40 border-slate-850 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <span className="text-sm">{cat.icon}</span>
                        <span className="text-[11px] leading-tight">{isAr ? cat.labelAr : cat.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'قيمة الدفعة بالأرقام' : 'Denom Amount'}</label>
                <input 
                  required 
                  type="number" 
                  min="1" 
                  value={formData.amount} 
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  placeholder="25000"
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start"
                />
              </div>

              {/* SOURCE/CREDIT LEDGER SELECTION */}
              <div className="relative">
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">
                  {isAr ? 'حساب الدفع المصدر (الخزينة/البنك - دائن) *' : 'Source Payment Account (Cash/Bank - Credit) *'}
                </label>
                
                {/* Account Selection Trigger */}
                <div 
                  onClick={() => setIsCreditAccountDropdownOpen(!isCreditAccountDropdownOpen)}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer flex justify-between items-center"
                >
                  <span className="truncate">
                    {formData.creditAccountId ? (
                      (() => {
                        const acc = financialAccounts.find(a => 
                          a.id === formData.creditAccountId || 
                          a.entityId === formData.creditAccountId ||
                          (a.accountCode && a.accountCode === formData.creditAccountId) ||
                          (a.code && a.code === formData.creditAccountId)
                        );
                        if (!acc) return isAr ? '-- اختر حساب النقدية/البنك --' : '-- Choose Cash/Bank Account --';
                        return `[${acc.code || acc.accountCode || 'Sys'}] - ${isAr ? acc.nameAr || acc.entityName : acc.nameEn || acc.entityName} ${acc.balance !== undefined ? `(${acc.balance.toLocaleString()} YER)` : ''}`;
                      })()
                    ) : (
                      <span className="text-slate-500">{isAr ? '-- اختر حساب النقدية/البنك --' : '-- Choose Cash/Bank Account --'}</span>
                    )}
                  </span>
                  <svg className={`w-4 h-4 text-slate-500 transition-transform ${isCreditAccountDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
                
                {formData.creditAccountCode && (
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {(() => {
                        const targetAcc = financialAccounts.find(a => a.id === formData.creditAccountId);
                        const expAmt = parseFloat(formData.amount) || 0;
                        if (targetAcc && typeof targetAcc.balance === 'number' && expAmt > 0) {
                           // Convert transaction amount to account currency
                           const convertedExpAmt = financialAccountService.convertToTargetCurrency(
                             expAmt,
                             formData.currency,
                             targetAcc.currency || settings.currency || 'SAR',
                             { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
                           );

                           // Credit Account is being CREDITED
                           const firstChar = (targetAcc.accountCode || targetAcc.code || '1').trim().charAt(0);
                           const isDebitNormal = firstChar === '1' || firstChar === '5';
                           
                           // If it's a Debit-Normal account (Asset/Expense), Crediting reduces balance
                           if (isDebitNormal && targetAcc.balance - convertedExpAmt < 0) {
                              return (
                                <div className="w-full mt-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] p-2 rounded-lg flex items-start gap-1.5 animate-pulse font-bold">
                                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                  <span>{isAr ? 'تنبيه: رصيد حساب الدفع المختار غير كافي وسيصبح بالسالب.' : 'Alert: Selected source account balance is insufficient.'}</span>
                                </div>
                              );
                           }
                        }
                        return null;
                    })()}
                  </div>
                )}
                
                {/* Custom Dropdown Content */}
                {isCreditAccountDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-[#121215] border border-slate-850 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-64">
                    {/* Account Search Input */}
                    <div className="p-2 border-b border-slate-850 bg-black/40 sticky top-0">
                      <input
                        type="text"
                        placeholder={isAr ? "🔎 ابحث بالاسم أو الكود..." : "🔎 Search by name or code..."}
                        value={creditAccountSearchQuery}
                        onChange={(e) => setCreditAccountSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-black/50 border border-slate-800 text-white rounded-lg p-2 outline-none text-xs font-bold focus:border-[#d4af37]/50"
                        autoFocus
                      />
                    </div>
                    
                    <div className="overflow-y-auto p-1 custom-scrollbar">
                      {(() => {
                        const filteredAccounts = financialAccounts.filter(acc => {
                          const q = creditAccountSearchQuery.toLowerCase().trim();
                          if (!q) {
                            // Suggest safe boxes / bank accounts by default
                            return acc.accountCode?.startsWith('111') || acc.accountCode?.startsWith('112') || acc.entityId === 'sys_cash_account';
                          }
                          return (
                            (acc.accountCode && String(acc.accountCode).toLowerCase().includes(q)) ||
                            (acc.code && String(acc.code).toLowerCase().includes(q)) ||
                            (acc.nameAr && String(acc.nameAr).toLowerCase().includes(q)) ||
                            (acc.nameEn && String(acc.nameEn).toLowerCase().includes(q)) ||
                            (acc.entityName && String(acc.entityName).toLowerCase().includes(q))
                          );
                        });

                        const grouped: Record<string, any[]> = {};
                        filteredAccounts.forEach(acc => {
                          const type = acc.type || 'Other';
                          if (!grouped[type]) grouped[type] = [];
                          grouped[type].push(acc);
                        });
                        
                        if (Object.keys(grouped).length === 0) {
                          return <div className="p-4 text-center text-slate-500 text-xs font-bold">{isAr ? 'لا توجد نتائج' : 'No results found'}</div>;
                        }

                        return Object.entries(grouped).map(([type, accs]) => (
                          <div key={type} className="mb-2">
                            <span className="text-[10px] font-black text-slate-400 px-2 py-1 uppercase">{type}</span>
                            {accs.map(a => (
                              <div 
                                key={a.id} 
                                onClick={() => {
                                  setFormData({
                                    ...formData, 
                                    creditAccountId: a.id,
                                    creditAccountCode: a.accountCode || a.code || ''
                                  });
                                  setIsCreditAccountDropdownOpen(false);
                                  setCreditAccountSearchQuery('');
                                }}
                                className={`px-3 py-2 hover:bg-white/5 cursor-pointer rounded-lg flex justify-between items-center ${formData.creditAccountId === a.id ? 'bg-[#d4af37]/10' : ''}`}
                              >
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-200">
                                    {isAr ? a.nameAr || a.entityName : a.nameEn || a.entityName}
                                  </span>
                                  <span className="font-mono text-[9px] text-slate-500">{a.accountCode || a.code || 'Sys'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* UNIFIED LEDGER SELECTION FOR ALL EXPENSE CATEGORIES */}
              <div className="relative">
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">
                  {isAr ? 'الحساب المالي المستهدف (شجرة الحسابات) *' : 'Target Ledger Account *'}
                </label>
                
                {/* Account Selection Trigger */}
                <div 
                  onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer flex justify-between items-center"
                >
                  <span className="truncate">
                    {formData.linkedAccountId ? (
                      (() => {
                        const acc = financialAccounts.find(a => 
                          a.id === formData.linkedAccountId || 
                          a.entityId === formData.linkedAccountId ||
                          (a.accountCode && a.accountCode === formData.linkedAccountId) ||
                          (a.code && a.code === formData.linkedAccountId)
                        );
                        if (!acc) return isAr ? '-- اختر حساب التوجيه المحاسبي --' : '-- Choose Ledger Account --';
                        return `[${acc.code || acc.accountCode || 'Sys'}] - ${isAr ? acc.nameAr || acc.entityName : acc.nameEn || acc.entityName} ${acc.balance !== undefined ? `(${acc.balance.toLocaleString()} YER)` : ''}`;
                      })()
                    ) : (
                      <span className="text-slate-500">{isAr ? '-- اختر حساب التوجيه المحاسبي --' : '-- Choose Ledger Account --'}</span>
                    )}
                  </span>
                  <svg className={`w-4 h-4 text-slate-500 transition-transform ${isAccountDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
                
                {/* Custom Dropdown Content */}
                {isAccountDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-[#121215] border border-slate-850 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-64">
                    {/* Account Search Input */}
                    <div className="p-2 border-b border-slate-850 bg-black/40 sticky top-0">
                      <input
                        type="text"
                        placeholder={isAr ? "🔎 ابحث بالاسم أو الكود..." : "🔎 Search by name or code..."}
                        value={accountSearchQuery}
                        onChange={(e) => setAccountSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-black/50 border border-slate-800 text-white rounded-lg p-2 outline-none text-xs font-bold focus:border-[#d4af37]/50"
                        autoFocus
                      />
                    </div>
                    
                    <div className="overflow-y-auto p-1 custom-scrollbar">
                      {(() => {
                        const filteredAccounts = financialAccounts.filter(acc => {
                          const q = accountSearchQuery.toLowerCase().trim();
                          if (!q) {
                            if (formData.category === 'salary' || formData.category === 'wages') return acc.entityType === 'employee';
                            if (formData.category === 'custody') return acc.entityType === 'courier';
                            return true;
                          }
                          return (
                            (acc.accountCode && String(acc.accountCode).toLowerCase().includes(q)) ||
                            (acc.code && String(acc.code).toLowerCase().includes(q)) ||
                            (acc.nameAr && String(acc.nameAr).toLowerCase().includes(q)) ||
                            (acc.nameEn && String(acc.nameEn).toLowerCase().includes(q)) ||
                            (acc.entityName && String(acc.entityName).toLowerCase().includes(q))
                          );
                        });

                        const grouped: Record<string, any[]> = {};
                        filteredAccounts.forEach(acc => {
                          const type = acc.type || 'Other';
                          const entityType = acc.entityType || 'system';
                          let groupKey = type;
                          if (entityType === 'customer') groupKey = 'Customer (عملاء)';
                          else if (entityType === 'courier') groupKey = 'Courier (مناديب)';
                          else if (entityType === 'employee') groupKey = 'Employee (موظفين)';
                          if (!grouped[groupKey]) grouped[groupKey] = [];
                          grouped[groupKey].push(acc);
                        });
                        
                        if (Object.keys(grouped).length === 0) {
                          return <div className="p-4 text-center text-slate-500 text-xs font-bold">{isAr ? 'لا توجد نتائج' : 'No results found'}</div>;
                        }

                        return Object.entries(grouped).map(([type, accs]) => {
                           let iconColor = 'text-slate-400 font-black';
                           let iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>;
                           
                           if (type.includes('Asset')) {
                              iconColor = 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
                              iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
                           } else if (type.includes('Liability')) {
                              iconColor = 'text-rose-400 bg-rose-500/10 border border-rose-500/20';
                              iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
                           } else if (type.includes('Equity')) {
                              iconColor = 'text-purple-400 bg-purple-500/10 border border-purple-500/20';
                              iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>;
                           } else if (type.includes('Revenue')) {
                              iconColor = 'text-blue-400 bg-blue-500/10 border border-blue-500/20';
                              iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
                           } else if (type.includes('Expense')) {
                              iconColor = 'text-orange-400 bg-orange-500/10 border border-orange-500/20';
                              iconSvg = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>;
                           }

                           let label = type === 'Asset' ? (isAr ? 'أصول (Asset)' : 'Asset') :
                                       type === 'Liability' ? (isAr ? 'خصوم (Liability)' : 'Liability') :
                                       type === 'Equity' ? (isAr ? 'حقوق ملكية (Equity)' : 'Equity') :
                                       type === 'Revenue' ? (isAr ? 'إيرادات (Revenue)' : 'Revenue') :
                                       type === 'Expense' ? (isAr ? 'مصروفات (Expense)' : 'Expense') : type;
                           
                           return (
                             <div key={type} className="mb-2">
                               <div className="px-2 py-1.5 flex items-center gap-1.5">
                                 <div className={`p-1 rounded-md ${iconColor}`}>
                                   {iconSvg}
                                 </div>
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</span>
                               </div>
                               {accs.sort((a,b) => (a.code || a.accountCode || '').localeCompare(b.code || b.accountCode || '')).map(a => (
                                 <div 
                                   key={a.id} 
                                   onClick={() => {
                                      let updatedAmount = formData.amount;
                                      if (formData.category === 'salary' && a.entityType === 'employee') {
                                        const user = systemUsers.find(u => u.id === a.entityId);
                                        if (user?.monthlySalary) updatedAmount = String(user.monthlySalary);
                                      }
                                      setFormData({
                                        ...formData, 
                                        linkedAccountId: a.id,
                                        linkedAccountCode: a.accountCode || a.code || '',
                                        linkedAccountEntityType: a.entityType || 'system',
                                        recipientId: a.entityId || a.id,
                                        recipientName: a.nameAr || a.entityName || '',
                                        amount: updatedAmount
                                      });
                                      setIsAccountDropdownOpen(false);
                                      setAccountSearchQuery('');
                                   }}
                                   className={`px-3 py-2.5 mx-1 mb-0.5 mt-0 hover:bg-white/5 cursor-pointer rounded-lg flex justify-between items-center transition-colors ${formData.linkedAccountId === a.id ? 'bg-[#d4af37]/10 border border-[#d4af37]/30' : ''}`}
                                 >
                                   <div className="flex flex-col gap-0.5">
                                     <span className={`text-xs font-bold ${formData.linkedAccountId === a.id ? 'text-[#d4af37]' : 'text-slate-200'}`}>
                                       {isAr ? a.nameAr || a.entityName : a.nameEn || a.entityName}
                                     </span>
                                     <span className="font-mono text-[9px] text-slate-500">{a.code || a.accountCode || 'Sys'}</span>
                                   </div>
                                   {a.balance !== undefined && (
                                     <span className="font-mono text-[10px] font-black tracking-tighter text-slate-400 bg-black/40 px-1.5 py-0.5 rounded border border-slate-800">
                                       {a.balance.toLocaleString()}
                                     </span>
                                   )}
                                 </div>
                               ))}
                             </div>
                           );
                        });
                      })()}
                    </div>
                  </div>
                )}
                
                {formData.linkedAccountCode && (
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-black text-slate-500">{isAr ? 'سيتم التقييد على حساب:' : 'Will record on account:'}</span>
                    <span className="font-mono font-black text-[#d4af37] text-[10px] bg-[#d4af37]/10 border border-[#d4af37]/20 px-2 py-0.5 rounded">{formData.linkedAccountCode}</span>
                    
                    {(() => {
                        const targetAcc = financialAccounts.find(a => 
                          a.id === formData.linkedAccountId || 
                          a.entityId === formData.linkedAccountId ||
                          (a.accountCode && a.accountCode === formData.linkedAccountId) ||
                          (a.code && a.code === formData.linkedAccountId)
                        );
                        const expAmt = parseFloat(formData.amount) || 0;
                        if (targetAcc && typeof targetAcc.balance === 'number' && expAmt > 0) {
                           // Convert transaction amount to account currency for accurate comparison
                           const convertedExpAmt = financialAccountService.convertToTargetCurrency(
                             expAmt,
                             formData.currency,
                             targetAcc.currency || settings.currency || 'SAR',
                             { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
                           );

                           // Linked Account is being DEBITED
                           const firstChar = (targetAcc.accountCode || targetAcc.code || '1').trim().charAt(0);
                           const isCreditNormal = firstChar === '2' || firstChar === '3' || firstChar === '4';
                           
                           // If it's a Credit-Normal account (Liability/Equity/Revenue), Debiting reduces balance
                           if (isCreditNormal && targetAcc.balance - convertedExpAmt < 0) {
                              return (
                                <div className="w-full mt-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] p-2 rounded-lg flex items-start gap-1.5 animate-pulse">
                                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                  <span>{isAr ? 'تنبيه: هذا القيد سيؤدي لتجاوز الرصيد الحالي للحساب وسيصبح بالسالب.' : 'Alert: This entry will exceed the current balance causing it to go negative.'}</span>
                                </div>
                              );
                           }
                        }
                        return null;
                    })()}
                  </div>
                )}
              </div>

              {formData.category === 'salary' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الشهر المستحق للراتب *' : 'Salary Month *'}</label>
                  <input 
                    required
                    type="month"
                    value={formData.salaryMonth}
                    onChange={(e) => setFormData({...formData, salaryMonth: e.target.value})}
                    className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold font-mono text-center"
                  />
                </div>
              )}

              {formData.category === 'factory' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'اسم المصنع بالصين المستفيد' : 'Beneficiary China Factory Name'}</label>
                  <input 
                    required 
                    type="text" 
                    value={formData.factoryName} 
                    onChange={(e) => setFormData({...formData, factoryName: e.target.value})}
                    placeholder="Guangzhou Tech Group" 
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'البيان أو الشرح' : 'Statement / Explanation'}</label>
                <input 
                  required 
                  type="text"
                  value={formData.notes} 
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  placeholder={isAr ? "مثال: إعلانات سناب شات لشهر يونيو، شراء كرتون تغليف..." : "Snapchat June ads, packaging boxes..."}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'ملاحظات إضافية' : 'Remarks / Notes'}</label>
                <textarea 
                  value={formData.remarks} 
                  onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none h-16 text-start"
                  placeholder={isAr ? "ملاحظات إدارية أو توجيهات الصندوق..." : "Administrative remarks..."}
                ></textarea>
              </div>
            </div>

            <div className="p-4 border-t border-slate-850 bg-[#07070a]/40 flex justify-end gap-3 shrink-0">
              <button 
                type="button" 
                onClick={() => setIsAddOpen(false)} 
                className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                type="submit" 
                disabled={addLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                {addLoading ? (isAr ? 'جاري التسجيل...' : 'Recording...') : (isAr ? 'اعتماد وصرف السند' : 'Approve & File Ledger')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Expenses Modal overlay */}
      {isEditOpen && selectedExpense && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleEditExpense} className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden font-sans text-start">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'تعديل السند المالي أو المصروف' : 'Modify Financial Voucher Document'}
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setIsEditOpen(false);
                  setSelectedExpense(null);
                }}
                className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-start font-sans">
              <div className="bg-[#d4af37]/5 border border-[#d4af37]/15 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">{isAr ? 'الرقم المرجعي للسند' : 'Voucher Serial ID'}</span>
                <span className="text-xs font-mono font-black text-[#d4af37]">{selectedExpense.expenseNumber}</span>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'فئة وبند المصروف' : 'Expense Category'}</label>
                <select 
                  required 
                  value={editFormData.category} 
                  onChange={(e) => setEditFormData({...editFormData, category: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer text-start bg-[#121215]"
                >
                  {EXPENSE_CATEGORIES_DYNAMIC.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {isAr ? cat.labelAr : cat.labelEn}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2 text-start">
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'المبلغ' : 'Amount'}</label>
                  <input 
                    required 
                    type="number" 
                    min="1" 
                    value={editFormData.amount} 
                    onChange={(e) => setEditFormData({...editFormData, amount: e.target.value})}
                    placeholder="25000"
                    className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start"
                  />
                </div>
                <div className="text-start">
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'العملة' : 'Currency'}</label>
                  <select 
                    value={editFormData.currency} 
                    onChange={(e) => setEditFormData({...editFormData, currency: e.target.value})}
                    className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer font-mono bg-[#121215]"
                  >
                    {(activeCurrencies.length > 0 ? activeCurrencies : [{ code: 'YER', main_nameAR: 'ريال يمني' }, { code: 'SAR', main_nameAR: 'ريال سعودي' }, { code: 'USD', main_nameAR: 'دولار أمريكي' }]).map(c => (
                      <option key={c.code} value={c.code}>{c.code} — {(c as any).main_nameAR || c.code}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-start">
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'تاريخ ووقت تقييد السند' : 'Voucher Created At'}</label>
                <input 
                  type="datetime-local" 
                  value={editFormData.createdAt} 
                  onChange={(e) => setEditFormData({...editFormData, createdAt: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold font-mono text-center"
                />
              </div>

              <div className="text-start">
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'المرسل إليه / المستلم' : 'Recipient'}</label>
                <input 
                  type="text" 
                  value={editFormData.recipientName} 
                  onChange={(e) => setEditFormData({...editFormData, recipientName: e.target.value})}
                  placeholder="John Doe"
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                />
              </div>

              <div className="text-start">
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'البيان أو الشرح' : 'Statement / Explanation'}</label>
                <input 
                  required 
                  type="text"
                  value={editFormData.notes} 
                  onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                  className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  placeholder={isAr ? "البيان لتعديل السند..." : "Description..."}
                />
              </div>

              <div className="text-start">
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'ملاحظات إضافية' : 'Remarks / Notes'}</label>
                <textarea 
                  value={editFormData.remarks} 
                  onChange={(e) => setEditFormData({...editFormData, remarks: e.target.value})}
                  className="w-full bg-[#121215] border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none h-16 text-start"
                  placeholder={isAr ? "ملاحظات إدارية..." : "Remarks..."}
                ></textarea>
              </div>
            </div>

            <div className="p-4 border-t border-slate-850 bg-[#07070a]/40 flex justify-end gap-3 shrink-0">
              <button 
                type="button" 
                onClick={() => {
                  setIsEditOpen(false);
                  setSelectedExpense(null);
                }} 
                className="px-5 py-2.5 text-slate-400 font-bold bg-slate-900 border border-slate-850 hover:bg-slate-850 rounded-xl text-xs transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                type="submit" 
                disabled={editLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                {editLoading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'اعتماد وحفظ السند' : 'Save Changes')}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
