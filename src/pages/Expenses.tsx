import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, doc, updateDoc, getDocs, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useSettings } from '../context/SettingsContext';
import { useRole } from '../hooks/useRole';
import { notificationService } from '../services/notificationService';
import { activityLogService } from '../services/activityLogService';
import { financialAccountService } from '../services/financialAccountService';
import { Plus, Search, Wallet, DollarSign, Calendar, RefreshCw, Layers, CheckCircle2, AlertTriangle, User, FileText, ArrowUpRight, ArrowDownLeft, Crown, ShieldAlert, Coins, X, Printer, Activity } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useLocation } from 'react-router-dom';
import FinanceReports from '../components/FinanceReports';
import FinanceAccounting from '../components/FinanceAccounting';

export const EXPENSE_CATEGORIES = [
  { id: 'marketing', labelAr: 'إعلانات وتسويق', labelEn: 'Advertising & Marketing', icon: '📣' },
  { id: 'packaging', labelAr: 'تغليف وكرتون', labelEn: 'Packaging & Cardboard', icon: '📦' },
  { id: 'telecom', labelAr: 'اتصالات وإنترنت', labelEn: 'Communications & Internet', icon: '🌐' },
  { id: 'custody', labelAr: 'عهد مالية لمندوب', labelEn: 'Courier Custody', icon: '🔑' },
  { id: 'wages', labelAr: 'أجور ومكافآت', labelEn: 'Wages & Bonuses', icon: '💵' },
  { id: 'factory', labelAr: 'سداد مصنع الصين', labelEn: 'Offshore Factory Trade', icon: '🏭' },
  { id: 'other', labelAr: 'مصروفات أخرى', labelEn: 'Other Expenses', icon: '📝' }
];

export default function Expenses() {
  const { settings, t } = useSettings();
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
  const [typeFilter, setTypeFilter] = useState('all');
  const isAr = settings.language === 'ar';

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const activeTab = queryParams.get('tab') || 'expenses'; // 'expenses', 'reports', 'accounting'

  const [formData, setFormData] = useState({
    category: 'marketing',
    amount: '',
    currency: 'YER',
    recipientId: '',
    recipientName: '',
    notes: '', // البيان أو الشرح
    remarks: '', // ملاحظات
    factoryName: '',
    linkedAccountId: '',       // NEW: linked financial account ID
    linkedAccountCode: '',     // NEW: linked financial account code
    linkedAccountEntityType: '' as '' | 'customer' | 'courier' | 'employee'
  });
  const [selectedDateTime, setSelectedDateTime] = useState('');

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
    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('isActive', '!=', false)),
      (snap) => {
        setSystemUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

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
      } else if (formData.category === 'wages' && formData.recipientId) {
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
        const catObj = EXPENSE_CATEGORIES.find(c => c.id === formData.category);
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
        recipientId: (type === 'Custody' || formData.category === 'wages') ? formData.recipientId : null,
        recipientEntityId: recipientEntityId || null,
        recipientEntityType: recipientEntityType || null,
        recipientName,
        linkedAccountId: linkedAccountId || null,
        linkedAccountCode: linkedAccountCode || null,
        notes: formData.notes, // البيان أو الشرح
        remarks: formData.remarks, // ملاحظات
        status: type === 'Custody' ? 'Pending' : 'Completed', // Pending custody, Completed expense
        createdByUid: auth.currentUser?.uid || 'system',
        createdByEmail: auth.currentUser?.email || 'admin@swiftship.system',
        createdByName: profile?.fullName || 'Root Admin',
        createdAt: parsedCreatedAt
      };

      await addDoc(collection(db, 'expenses'), payload);

      // --- Financial Account Impact ---
      // If linked to a financial account, record the transaction as a Credit (money going out to recipient)
      if (linkedAccountId && recipientEntityId && recipientEntityType) {
        try {
          await financialAccountService.recordTransaction(linkedAccountId, {
            accountId: linkedAccountId,
            accountCode: linkedAccountCode,
            entityType: recipientEntityType,
            entityId: recipientEntityId,
            entityName: recipientName,
            type: 'Credit', // Money out from company, charged to entity's account
            amount: convertedAmount,
            amountOriginal: rawAmount,
            currencyOriginal: formData.currency,
            description: formData.notes || (isAr ? `سند مصروف: ${expenseNumber}` : `Expense voucher: ${expenseNumber}`),
            refNumber: expenseNumber,
            module: type === 'Custody' ? 'custody' : 'expense',
            createdByUid: auth.currentUser?.uid || 'system',
            createdByName: profile?.fullName || 'Root Admin',
            createdAt: parsedCreatedAt
          });
        } catch (txErr) {
          console.warn('[Expenses] Could not record financial account transaction:', txErr);
        }
      }

      activityLogService.log('add_expense', expenseNumber, { ...payload });

      notificationService.notify({
        title: isAr ? 'تم تقييد السند بالخزينة' : 'Voucher Logged',
        message: isAr 
          ? `تم تسجيل السند برقم: ${expenseNumber}${linkedAccountCode ? ` (مرتبط بحساب ${linkedAccountCode})` : ''}` 
          : `Transaction recorded: ${expenseNumber}${linkedAccountCode ? ` (linked to account ${linkedAccountCode})` : ''}`,
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
        linkedAccountEntityType: ''
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

  const handleSettleCustody = async (exp: any) => {
    if (!canEditExpenses) {
      return notificationService.notify({
        title: isAr ? 'خطأ بالصلاحيات' : 'Permission Error',
        message: isAr ? 'ليس لديك صلاحية لتسوية العهد المالية.' : 'You do not have permission to settle financial custody.',
        type: 'error',
        category: 'finance'
      });
    }
    try {
      await updateDoc(doc(db, 'expenses', exp.id), {
        status: 'Settled',
        settledAt: Date.now(),
        settledByEmail: auth.currentUser?.email || 'admin',
        settledByName: profile?.fullName || 'Root Admin'
      });

      // --- Financial Account Reversal: Debit on courier's account (returning the custody) ---
      if (exp.linkedAccountId && exp.recipientEntityId) {
        try {
          const settledAmount = financialAccountService.convertToDefaultCurrency(
            parseFloat(exp.amount || 0),
            exp.currency || 'YER',
            settings.currency || 'SAR',
            { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
          );
          await financialAccountService.recordTransaction(exp.linkedAccountId, {
            accountId: exp.linkedAccountId,
            accountCode: exp.linkedAccountCode || '',
            entityType: 'courier',
            entityId: exp.recipientEntityId,
            entityName: exp.recipientName,
            type: 'Debit', // Reversal: money returned / settled
            amount: settledAmount,
            amountOriginal: parseFloat(exp.amount || 0),
            currencyOriginal: exp.currency || 'YER',
            description: isAr ? `تسوية عهدة: ${exp.expenseNumber}` : `Custody settlement: ${exp.expenseNumber}`,
            refNumber: `${exp.expenseNumber}-SETTLE`,
            module: 'custody',
            createdByUid: auth.currentUser?.uid || 'system',
            createdByName: profile?.fullName || 'Root Admin',
            createdAt: Date.now()
          });
        } catch (txErr) {
          console.warn('[Expenses] Could not record settlement on financial account:', txErr);
        }
      }

      activityLogService.log('settle_custody', exp.recipientName || exp.recipientId, { id: exp.id, amount: exp.amount });
      notificationService.notify({
        title: isAr ? 'تم تسوية العهدة بنجاح' : 'Custody Discharged',
        message: isAr ? `تمت تسوية وتصفير عهدة المندوب ${exp.recipientName}` : `Custody balance for ${exp.recipientName} cleared`,
        type: 'success',
        category: 'finance'
      });
    } catch (err) {
      console.error(err);
      notificationService.notify({
        title: 'Error',
        message: 'Could not settle custody.',
        type: 'error',
        category: 'finance'
      });
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
    if ((exp.type === 'General' || exp.type === 'FactoryPayment') && !canViewGeneralExpenses) return false;
    return true;
  });

  const convertToYER = (amount: number, currency: string) => {
    const amt = parseFloat(String(amount || 0));
    if (currency === 'USD') return amt * (settings.exchangeRateUSD || 535);
    if (currency === 'SAR') return amt * (settings.exchangeRateSAR || 140);
    return amt;
  };

  const getCategoryDetails = (exp: any) => {
    let catId = exp.category;
    if (!catId) {
      if (exp.type === 'Custody') catId = 'custody';
      else if (exp.type === 'FactoryPayment') catId = 'factory';
      else catId = 'other';
    }
    return EXPENSE_CATEGORIES.find(c => c.id === catId) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
  };

  // Calculations for stats using dynamic currency exchange rates
  const totalGeneralExpensesYER = allowedExpenses
    .filter(e => e.type === 'General' || e.type === 'FactoryPayment')
    .reduce((sum, e) => sum + convertToYER(e.amount || 0, e.currency), 0);

  const totalGeneralExpensesUSD = allowedExpenses
    .filter(e => e.type === 'General' || e.type === 'FactoryPayment')
    .reduce((sum, e) => sum + (e.currency === 'USD' ? (e.amount || 0) : convertToYER(e.amount || 0, e.currency) / (settings.exchangeRateUSD || 535)), 0);

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
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Top banner block (luxury charcoal gray)
    doc.setFillColor(15, 15, 18);
    doc.rect(0, 0, 210, 36, 'F');
    
    // Gold separator strip
    doc.setFillColor(212, 175, 55);
    doc.rect(0, 36, 210, 2, 'F');
    
    // Header texts
    doc.setTextColor(212, 175, 55);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('AL-XPRESS EXPENSES & CUSTODIES', 15, 16);
    
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'normal');
    doc.text('ADMINISTRATIVE EXPENSE DEK & DISBURSEMENTS', 15, 23);
    
    doc.setTextColor(130, 130, 130);
    doc.setFontSize(7);
    doc.text(`Generated: ${new Date().toLocaleString()} | User: ${profile?.fullName || profile?.email || 'Administrator'}`, 15, 29);
    
    // Quick statistics summary block
    doc.setFillColor(245, 245, 247);
    doc.roundedRect(12, 44, 186, 22, 3, 3, 'F');
    
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(120, 120, 120);
    doc.text('GENERAL EXPENSES (YER)', 20, 51);
    doc.text('CUSTODIES PENDING', 90, 51);
    doc.text('CUSTODIES SETTLED', 145, 51);
    
    doc.setFontSize(11);
    doc.setTextColor(15, 15, 18);
    doc.text(`${totalGeneralExpensesYER.toLocaleString()} YER`, 20, 59);
    doc.text(`${totalPendingCustodies.toLocaleString()} YER`, 90, 59);
    doc.text(`${totalSettledCustodies.toLocaleString()} YER`, 145, 59);
    
    // Headers of main data grid
    doc.setFillColor(24, 24, 27);
    doc.rect(12, 72, 186, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.text('VOUCHER #', 15, 77);
    doc.text('CATEGORY', 43, 77);
    doc.text('STATEMENT / NOTES', 85, 77);
    doc.text('AMOUNT', 145, 77);
    doc.text('STATUS', 178, 77);
    
    let yIdx = 87;
    // Walk through sorted & filtered list
    filteredExpenses.forEach((exp, index) => {
      // PDF line limit per page
      if (yIdx > 275) {
        doc.addPage();
        
        // Dynamic continued header
        doc.setFillColor(15, 15, 18);
        doc.rect(0, 0, 210, 18, 'F');
        doc.setFillColor(212, 175, 55);
        doc.rect(0, 18, 210, 1.5, 'F');
        doc.setTextColor(212, 175, 55);
        doc.setFontSize(10);
        doc.setFont('Helvetica', 'bold');
        doc.text('AL-XPRESS EXPENSES (CONTINUED)', 15, 11);
        
        doc.setFillColor(24, 24, 27);
        doc.rect(12, 24, 186, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text('VOUCHER #', 15, 29);
        doc.text('CATEGORY', 43, 29);
        doc.text('STATEMENT / NOTES', 85, 29);
        doc.text('AMOUNT', 145, 29);
        doc.text('STATUS', 178, 29);
        
        yIdx = 39;
      }
      
      // Zebra alternate background striping
      if (index % 2 === 0) {
        doc.setFillColor(248, 249, 250);
        doc.rect(12, yIdx - 4.5, 186, 8, 'F');
      }
      
      doc.setTextColor(40, 40, 43);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      
      // Voucher ID
      doc.setFont('Helvetica', 'bold');
      doc.text(exp.expenseNumber || 'EXP-PENDING', 15, yIdx);
      doc.setFont('Helvetica', 'normal');
      
      // Category Text
      const catObj = getCategoryDetails(exp);
      const categoryText = catObj.labelEn;
      doc.text(categoryText, 43, yIdx);
      
      // Statement / Notes
      const stmtText = transliterateArabic(exp.notes || '').slice(0, 32);
      doc.text(stmtText, 85, yIdx);
      
      // Cost
      const amtRaw = parseFloat(exp.amount || 0);
      const currencyLabel = exp.currency || 'YER';
      doc.text(`${amtRaw.toLocaleString()} ${currencyLabel}`, 145, yIdx);
      
      // Status
      const statusLabel = exp.status === 'Settled' ? 'SETTLED' : (exp.status === 'Pending' ? 'PENDING' : 'RELEASED');
      if (statusLabel === 'PENDING') {
        doc.setTextColor(190, 40, 40);
        doc.setFont('Helvetica', 'bold');
        doc.text(statusLabel, 178, yIdx);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(40, 40, 43);
      } else {
        doc.setTextColor(16, 124, 65);
        doc.text(statusLabel, 178, yIdx);
        doc.setTextColor(40, 40, 43);
      }
      
      // Grid bottom indicator divider
      doc.setDrawColor(235, 235, 240);
      doc.setLineWidth(0.15);
      doc.line(12, yIdx + 3.5, 198, yIdx + 3.5);
      
      yIdx += 8.5;
    });
    
    // Page footer indicator block
    doc.setTextColor(140, 140, 140);
    doc.setFontSize(6.5);
    doc.setFont('Helvetica', 'normal');
    doc.text('System generated administrative expense ledger. Designed for Al-Xpress Corporate ledger integration.', 15, 288);
    doc.text(`Doc Ref: ALX-${new Date().getFullYear()}/EXP`, 175, 288);
    
    doc.save(`AlXpress_Expenses_${new Date().toISOString().split('T')[0]}.pdf`);
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

  if (activeTab === 'accounting') {
    if (!canViewFinance) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-850 shadow-xl text-center select-none">
          <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
          <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide text-center">{t('accessDenied')}</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">{isAr ? 'ليس لديك صلاحية لعرض مطابقة الحسابات والقيود المحاسبية.' : 'You do not have permission to view the accounting ledger and double-entry adjustments.'}</p>
        </div>
      );
    }
    return (
      <div className="space-y-6 pb-20 text-start font-sans">
        {/* Accounting Header */}
        <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-2.5 rounded-2xl text-[#d4af37]">
              <FileText className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white leading-none mb-1">
                {isAr ? 'القيود المحاسبية ومطابقة الحسابات' : 'Double-Entry Ledger & Adjustments'}
              </h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {isAr ? 'كشوف حسابات العملاء • تسوية العهد • توازن قبوضات الصندوق' : 'Ledger audits • Courier liability accounts • Balancing sheets'}
              </p>
            </div>
          </div>
        </div>

        {/* Accounting Component */}
        <FinanceAccounting 
          orders={orders}
          expenses={expenses}
          couriers={couriers}
          customers={customers}
          isAr={isAr}
          settings={settings}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-start transition-colors font-sans selection:bg-[#d4af37]/30">
      
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
              {isAr ? 'المصروفات العامة والتشغيلية (YER)' : 'General Expenses (YER)'}
            </span>
            <span className="text-lg font-mono font-black text-[#d4af37]">{totalGeneralExpensesYER.toLocaleString()} YER</span>
            <div className="absolute top-2.5 right-2.5 p-1 text-rose-500 bg-rose-950/20 rounded-lg border border-rose-900/30">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
        )}

        {/* KPI 2 */}
        {canViewGeneralExpenses && (
          <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 p-4 rounded-2xl relative overflow-hidden shadow">
            <span className="text-[9px] text-slate-500 font-black uppercase block tracking-wider mb-2">
              {isAr ? 'سداد فواتير الصين وحجم العمل (USD)' : 'Offshore Expenses (USD)'}
            </span>
            <span className="text-lg font-mono font-black text-emerald-400">${totalGeneralExpensesUSD.toLocaleString()} USD</span>
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
            <span className="text-lg font-mono font-black text-amber-500">{totalPendingCustodies.toLocaleString()} YER</span>
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
            <span className="text-lg font-mono font-black text-emerald-400">{totalSettledCustodies.toLocaleString()} YER</span>
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
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {isAr ? cat.labelAr : cat.labelEn}</option>
            ))}
          </select>
        </div>

        {/* Table logs */}
        <div className="overflow-x-auto">
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
              {filteredExpenses.map((exp) => {
                const isSettleBtnVisible = exp.type === 'Custody' && exp.status === 'Pending' && canEditExpenses;
                const formattedDate = new Date(exp.createdAt || Date.now()).toLocaleString(isAr ? 'ar-YE' : 'en-US', { dateStyle: 'short', timeStyle: 'short' });
                return (
                  <tr key={exp.id} className="hover:bg-slate-950/40 transition-colors">
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
                        <span>{exp.recipientName || '—'}</span>
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
                      {isSettleBtnVisible && (
                        <button 
                          onClick={() => handleSettleCustody(exp)}
                          className="bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-black hover:border-transparent px-3 py-1.5 rounded-xl font-black text-[10px] transition-all"
                        >
                          {isAr ? 'تأكيد التصفية والتسليم' : 'Discharge Vault'}
                        </button>
                      )}
                      {!isSettleBtnVisible && (
                        <span className="text-[9px] text-slate-600 font-bold font-mono uppercase">
                          {exp.status === 'Settled' ? (isAr ? 'مغلق ومسوى' : 'RECONCILED') : (isAr ? 'مثبت' : 'LOCKED')}
                        </span>
                      )}
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

      {/* Add Expenses Modal overlay */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden font-sans">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'تسجيل وتقييد مصروف أو عهدة مالية' : 'Issue Strategic Settlement Voucher'}
              </h3>
              <button 
                onClick={() => setIsAddOpen(false)}
                className="text-slate-500 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleAddExpense} className="p-6 space-y-4 text-start">
              
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
                    <option value="YER">{isAr ? 'ريال يمني YER' : 'YER'}</option>
                    <option value="USD">{isAr ? 'دولار أمريكي USD' : 'USD'}</option>
                    <option value="SAR">{isAr ? 'ريال سعودي SAR' : 'SAR'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider">{isAr ? 'بند المصروف' : 'Expense Category'}</label>
                <div className="grid grid-cols-2 gap-2">
                  {EXPENSE_CATEGORIES.map(cat => {
                    if (cat.id === 'custody' && !canViewCustody) return null;
                    if (cat.id !== 'custody' && !canViewGeneralExpenses) return null;
                    const isActive = formData.category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFormData({...formData, category: cat.id})}
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

              {formData.category === 'custody' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'المندوب كفيل العهدة' : 'Select Liable Courier'}</label>
                  <select 
                    required 
                    value={formData.recipientId} 
                    onChange={(e) => {
                      const courier = couriers.find(c => c.id === e.target.value);
                      setFormData({
                        ...formData, 
                        recipientId: e.target.value,
                        linkedAccountId: courier?.financialAccountId || '',
                        linkedAccountCode: courier?.financialAccountCode || '',
                        linkedAccountEntityType: 'courier'
                      });
                    }}
                    className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer"
                  >
                    <option value="">{isAr ? '-- اختر المندوب من الكشف --' : '-- Choose Courier --'}</option>
                    {couriers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.courierCustomId}){c.financialAccountCode ? ` — ${c.financialAccountCode}` : ''}
                      </option>
                    ))}
                  </select>
                  {formData.linkedAccountCode && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[9px] font-black text-slate-500">{isAr ? 'سيتم الخصم من حساب:' : 'Will charge account:'}</span>
                      <span className="font-mono font-black text-[#d4af37] text-[10px] bg-[#d4af37]/10 border border-[#d4af37]/20 px-2 py-0.5 rounded">{formData.linkedAccountCode}</span>
                    </div>
                  )}
                </div>
              )}

              {formData.category === 'wages' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الموظف أو مستحق الراتب' : 'Employee / Salary Recipient'}</label>
                  <select 
                    value={formData.recipientId} 
                    onChange={(e) => {
                      const user = systemUsers.find(u => u.id === e.target.value);
                      setFormData({
                        ...formData, 
                        recipientId: e.target.value,
                        amount: user?.salary ? String(user.salary) : formData.amount,
                        linkedAccountId: user?.financialAccountId || '',
                        linkedAccountCode: user?.financialAccountCode || '',
                        linkedAccountEntityType: 'employee'
                      });
                    }}
                    className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer"
                  >
                    <option value="">{isAr ? '-- اختر الموظف (اختياري) --' : '-- Select Employee (Optional) --'}</option>
                    {systemUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName || u.displayName || u.email}{u.financialAccountCode ? ` — ${u.financialAccountCode}` : ''}
                      </option>
                    ))}
                  </select>
                  {formData.linkedAccountCode && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black text-slate-500">{isAr ? 'حساب الموظف:' : 'Employee Account:'}</span>
                        <span className="font-mono font-black text-[#d4af37] text-[10px] bg-[#d4af37]/10 border border-[#d4af37]/20 px-2 py-0.5 rounded">{formData.linkedAccountCode}</span>
                      </div>
                      {(() => {
                        const user = systemUsers.find(u => u.id === formData.recipientId);
                        if (user?.salary) {
                          return (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black text-slate-500">{isAr ? 'الراتب المسجل:' : 'Default Salary:'}</span>
                              <span className="font-mono font-black text-emerald-400 text-[10px] bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded">{user.salary.toLocaleString()} YER</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
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

              {formData.category !== 'custody' && formData.category !== 'wages' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">
                    {isAr ? 'ربط بحساب مالي مخصص (اختياري)' : 'Link to Custom Account (Optional)'}
                  </label>
                  <select 
                    value={formData.linkedAccountId} 
                    onChange={(e) => {
                      const acc = financialAccounts.find(a => a.id === e.target.value);
                      if (acc) {
                        setFormData({
                          ...formData, 
                          linkedAccountId: acc.id,
                          linkedAccountCode: acc.accountCode || '',
                          linkedAccountEntityType: acc.entityType || '',
                          recipientId: acc.entityId || '',
                          recipientName: acc.entityName || ''
                        });
                      } else {
                        setFormData({
                          ...formData,
                          linkedAccountId: '',
                          linkedAccountCode: '',
                          linkedAccountEntityType: '',
                          recipientId: '',
                          recipientName: ''
                        });
                      }
                    }}
                    className="w-full bg-black/50 border border-slate-850 text-white rounded-xl p-3 focus:border-[#d4af37]/60 outline-none text-xs font-bold cursor-pointer"
                  >
                    <option value="">{isAr ? '-- لا يوجد ربط (صرف عام) --' : '-- No Custom Link (General Outflow) --'}</option>
                    {financialAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        [{a.accountCode}] {a.entityName} ({isAr ? (a.entityType === 'customer' ? 'عميل' : a.entityType === 'courier' ? 'مندوب' : 'موظف') : a.entityType})
                      </option>
                    ))}
                  </select>
                  {formData.linkedAccountCode && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[9px] font-black text-slate-550">{isAr ? 'سيتم الربط بالحساب المالي:' : 'Will link to financial account:'}</span>
                      <span className="font-mono font-black text-[#d4af37] text-[10px] bg-[#d4af37]/10 border border-[#d4af37]/20 px-2 py-0.5 rounded">{formData.linkedAccountCode}</span>
                    </div>
                  )}
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

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-850">
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
                  className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow-md transition-all h-max cursor-pointer border-none"
                >
                  {addLoading ? (isAr ? 'جاري التسجيل...' : 'Recording...') : (isAr ? 'اعتماد وصرف السند' : 'Approve & File Ledger')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
