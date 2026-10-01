type AdapterDocument = { id: string; data: () => Record<string, unknown> };
import React, { useState, useEffect } from 'react';
import { asyncState, runMutation, type AsyncState } from '../../../shared/contracts/ui.contracts';
import { collection, onSnapshot, doc, updateDoc, addDoc, setDoc, deleteDoc, query, where, orderBy, or } from '../../../lib/supabase-adapter';
import { db, auth } from '../../../lib/supabase-adapter';
import { handlePostgreSQLError, OperationType } from '../../../lib/supabase-adapter';
import {
  Search,
  Edit2,
  X,
  Plus,
  UserX,
  UserCheck,
  Trash2,
  Truck,
  DollarSign,
  Receipt,
  Briefcase,
  History,
  MapPin,
  Package,
  CheckCircle,
  Clock,
  User,
  Crown,
  Printer,
  ShieldAlert,
  Coins,
  Activity,
  AlertTriangle,
  Wallet,
  ArrowDownRight,
  ArrowUpLeft
} from 'lucide-react';
import { printContent } from '../../../lib/printUtils';
import { jsPDF } from 'jspdf';
import { useRole } from '../../../hooks/useRole';
import { useSettings } from '../../../context/SettingsContext';
import { notificationService } from '../../../services/notificationService';
import { activityLogService } from '../../../services/activityLogService';
import { financialAccountService } from '../../../services/financialAccountService';
import { useAccountBalances } from '../../../hooks/useAccountBalances';
import ConfirmModal from '../../../components/ConfirmModal';
import ConfirmDeletePinModal from '../../../components/ConfirmDeletePinModal';
import { useExchangeRates } from '../../../hooks/useExchangeRates';
import type { CourierEditFormValues, CourierFormValues, CourierSystemUserFormValues } from '../types';
import { AddCourierModal } from '../components/AddCourierModal';
import { EditCourierModal } from '../components/EditCourierModal';
import { CourierDetailsModal } from '../components/CourierDetailsModal';

export default function CouriersPage() {
  const { settings, t } = useSettings();
  const { rates: dbRates } = useExchangeRates();
  const [couriers, setCouriers] = useState<any[]>([]);
  const { role, hasPermission, profile, loading: roleLoading } = useRole();
  const [queryState, setQueryState] = useState<AsyncState<unknown[]>>(asyncState.loading());
  const loading = queryState.status === 'loading';
  const setLoading = (value: boolean) => setQueryState(value ? asyncState.loading() : asyncState.idle());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const isAr = settings.language === 'ar';

  // ── Live transaction-based balances (real-time from account_trans) ────
  const liveBalances = useAccountBalances();

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
    onConfirm: () => { },
    type: 'danger'
  });

  const [deletePinConfig, setDeletePinConfig] = useState({
    isOpen: false,
    entityId: '',
    entityName: ''
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState<any>(null);
  const [courierOrders, setCourierOrders] = useState<any[]>([]);
  const [courierExpenses, setCourierExpenses] = useState<any[]>([]);
  const [ordersState, setOrdersState] = useState<AsyncState<unknown[]>>(asyncState.idle());
  const ordersLoading = ordersState.status === 'loading';
  const setOrdersLoading = (value: boolean) => setOrdersState(value ? asyncState.loading() : asyncState.idle());
  const [detailsUnsubs, setDetailsUnsubs] = useState<(() => void)[]>([]);

  const [detailTab, setDetailTab] = useState<'logistics' | 'financial'>('logistics');
  const [courierTransactions, setCourierTransactions] = useState<any[]>([]);
  const [finSearch, setFinSearch] = useState('');
  const [finModuleFilter, setFinModuleFilter] = useState<'all' | 'order' | 'expense' | 'payment' | 'custody'>('all');

  useEffect(() => {
    if (!selectedCourier || !isDetailsModalOpen) {
      setCourierTransactions([]);
      return;
    }

    const qTx = query(
      collection(db, 'account_trans'),
      where('entity_id', '==', selectedCourier.id)
    );
    const unsubTx = onSnapshot(qTx, (snap) => {
      setCourierTransactions(snap.docs.map((d: AdapterDocument) => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Error fetching transactions for courier:", err);
    });

    return () => unsubTx();
  }, [selectedCourier, isDetailsModalOpen]);

  // Global collections for smart calculations
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  const [editFormData, setEditFormData] = useState<CourierEditFormValues>({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    gpsLocation: '',
    disabled: false,
    commissionRate: 0,
    notes: '',
    courierType: 'local' as 'sourcing' | 'local'
  });

  const [addFormData, setAddFormData] = useState<CourierFormValues>({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    gpsLocation: '',
    commissionRate: 0,
    notes: '',
    courierType: 'local' as 'sourcing' | 'local'
  });

  const [addMutationState, setAddMutationState] = useState<AsyncState<void>>(asyncState.idle());
  const [editMutationState, setEditMutationState] = useState<AsyncState<void>>(asyncState.idle());
  const addLoading = addMutationState.status === 'submitting';
  const editLoading = editMutationState.status === 'submitting';

  // System User Provisioning State
  const [createSystemUser, setCreateSystemUser] = useState(false);
  const [systemUserFormData, setSystemUserFormData] = useState<CourierSystemUserFormValues>({
    username: '',
    email: '',
    password: '',
    systemPin: '',
    role: 'Courier'
  });

  // Smart Custody Calculator Helper
  const getCourierCustodyStats = (courierId: string) => {
    const cour = couriers.find(c => c.id === courierId);
    const targetCurrency = cour?.courierType === 'sourcing' ? 'SAR' : 'YER';
    const rates = dbRates;

    const convertToCourierCurrency = (amount: number, fromCurrency?: string) => {
      return financialAccountService.convertToDefaultCurrency(
        amount,
        fromCurrency || 'YER',
        targetCurrency,
        rates
      );
    };

    // Shipments associated with courier (as shipping or delivery courier)
    const cOrders = allOrders.filter(o => o.deliveryCourierId === courierId || o.shippingCourierId === courierId);

    // Expenses/custodies associated with courier
    const cExpenses = allExpenses.filter(e => e.recipientId === courierId);

    // 1. Mabaligh Received (المبالغ التي استلمها المندوب)
    // - All custody slips issued to them (automatic from delivered orders + manually established)
    // - Any approved advances
    const totalCustodyIssued = cExpenses
      .filter(e => e.type === 'Custody')
      .reduce((sum, e) => sum + convertToCourierCurrency(e.amount, e.currency), 0);

    const totalAdvancesReceived = cExpenses
      .filter(e => e.type === 'Advance' && e.status === 'Approved')
      .reduce((sum, e) => sum + convertToCourierCurrency(e.amount, e.currency), 0);

    const totalReceived = totalCustodyIssued + totalAdvancesReceived;

    // 2. Mabaligh Remitted/Settled (المبالغ التي قام بتوريدها للصندوق)
    const totalCustodySettled = cExpenses
      .filter(e => e.type === 'Custody')
      .reduce((sum, e) => {
        if (e.status === 'Settled') {
          return sum + convertToCourierCurrency(e.amount, e.currency);
        }
        return sum + convertToCourierCurrency(e.remittedAmount || 0, e.currency);
      }, 0);

    // 3. Outstanding Custody (المبالغ المتبقية بعهدته)
    const remainingCustody = totalReceived - totalCustodySettled;

    // 4. Performance analytics
    const totalDelivered = cOrders.filter(o => {
      const status = o.orderStatus || o.order_status || '';
      return status === 'تم التسليم' || status === 'Delivered';
    }).length;

    const totalOrdersCount = cOrders.length;
    const deliverySuccessRate = totalOrdersCount > 0
      ? Math.round((totalDelivered / totalOrdersCount) * 100)
      : 0;

    const totalInTransit = cOrders.filter(o => {
      const status = o.orderStatus || o.order_status || '';
      return ['Shipped', 'In Transit', 'Out For Delivery', 'In Local Warehouse', 'وصل مركز التوزيع في اليمن'].includes(status);
    }).length;

    return {
      totalReceived,
      totalRemitted: totalCustodySettled,
      remainingCustody,
      totalDelivered,
      totalOrdersCount,
      deliverySuccessRate,
      totalInTransit,
      courierExpenses: cExpenses,
      courierOrders: cOrders
    };
  };

  const getCourierOrderPartyStats = (courierId: string) => {
    const partyOrders = allOrders.filter((order) =>
      (order.orderPartyType === 'courier' || (order.isStaffOrder && order.courierId))
      && String(order.orderPartyId || order.customerId || order.courierId) === String(courierId),
    );
    const totalValue = partyOrders.reduce((sum, order) => sum + (parseFloat(order.totalCostYER || order.totalCostSAR || 0) || 0), 0);
    const outstanding = partyOrders.reduce((sum, order) => sum + (parseFloat(order.amountRemaining || 0) || 0), 0);
    return {
      totalOrders: partyOrders.length,
      totalValue,
      outstanding,
      paid: partyOrders.reduce((sum, order) => sum + (parseFloat(order.amountPaid || 0) || 0), 0),
      lastOrder: partyOrders[0] || null,
    };
  };

  const getCourierUnifiedLedger = () => {
    const ledger: any[] = [];
    const isAr = settings.language === 'ar';
    const fCurrency = selectedCourier ? (selectedCourier.financialCurrency || 'YER') : 'YER';
    const exchangeRateSAR = dbRates.SAR || 1;

    // 1. Map courierTransactions directly to preserve real double entries
    courierTransactions.forEach(tx => {
      const amtBase = parseFloat(tx.amount || 0);
      const amtOriginal = parseFloat(tx.amountOriginal || tx.amount || 0);

      let type = tx.type || 'Debit';
      let title = '';
      let category = tx.module || 'transaction';

      if (tx.module === 'custody') {
        const isSettlement = (tx.description || '').includes('تسوية') ||
          (tx.description || '').includes('سداد') ||
          (tx.description || '').toLowerCase().includes('settle');
        if (isSettlement) {
          type = 'Credit';
          title = isAr ? 'تسوية وسداد عهدة مالية' : 'Custody Settlement / Return';
        } else {
          type = 'Debit';
          title = isAr ? 'تسليم عهدة مالية للمندوب' : 'Custody Handed Over';
        }
      } else if (tx.module === 'order') {
        if (tx.type === 'Debit') {
          title = isAr ? 'تحصيل قيمة شحنة (كاش بعهدة المندوب)' : 'Collected COD Cargo Cash';
        } else {
          title = isAr ? 'أجور توصيل وعمولة المندوب للطلب' : 'Earned Courier Delivery Commission';
        }
      } else if (tx.module === 'expense') {
        type = 'Credit';
        title = isAr ? 'مصروف تشغيلي / أجور مسددة' : 'Operating Expense / Disbursed';
      } else if (tx.module === 'wage' || tx.module === 'salary_payment') {
        type = 'Credit';
        title = isAr ? 'صرف راتب أو مستحقات الموظف' : 'Salary / Wages Paid';
      } else {
        title = tx.description || (isAr ? 'قيد تسوية لمطابقة رصيد المندوب' : 'Corporate Ledger Adjustment');
      }

      let amountInFCurrency = amtBase;
      if (fCurrency === 'SAR') {
        if (tx.currencyOriginal === 'SAR') {
          amountInFCurrency = amtOriginal;
        } else {
          amountInFCurrency = amtBase / exchangeRateSAR;
        }
      }

      ledger.push({
        id: tx.id || `tx-${Math.random()}`,
        date: tx.createdAt || Date.now(),
        type,
        amount: amtBase,
        amountFCurrency: amountInFCurrency,
        amountOriginal: amtOriginal,
        currencyOriginal: tx.currencyOriginal || 'YER',
        module: category,
        title,
        description: tx.description || (isAr ? `قيد مالي رقم: ${tx.refNumber || tx.accountCode || ''}` : `Entry reference: ${tx.refNumber || tx.accountCode || ''}`),
        ref: tx.refNumber || tx.accountCode || 'GL-TX'
      });
    });

    // Sort oldest to newest
    const sorted = [...ledger].sort((a, b) => a.date - b.date);

    // Calculate running balance: Debits (+) increase outstanding custody, Credits (-) reduce outstanding custody.
    let runningAccountBal = 0;
    const finalLedger = sorted.map(item => {
      if (item.type === 'Debit') {
        runningAccountBal += item.amountFCurrency;
      } else {
        runningAccountBal -= item.amountFCurrency;
      }

      return {
        ...item,
        runningAccountBal
      };
    });

    return finalLedger.reverse();
  };

  useEffect(() => {
    if (roleLoading) return;

    // 1. Subscribe to Couriers
    const qCouriers = query(collection(db, 'couriers'), orderBy('createdAt', 'desc'));
    const unsubCouriers = onSnapshot(qCouriers, (snap) => {
      const rows = snap.docs.map((d: AdapterDocument) => ({ id: d.id, ...d.data() }));
      setCouriers(rows);
      setQueryState(rows.length ? asyncState.success(rows) : asyncState.empty());
    }, (error) => {
      handlePostgreSQLError(error, OperationType.LIST, 'couriers');
    });

    // 2. Subscribe to Orders (Smart Custody / Performance sync)
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      setAllOrders(snap.docs.map((d: AdapterDocument) => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Error loading orders:", error);
    });

    // 3. Subscribe to Accounts
    const unsubAccounts = onSnapshot(collection(db, 'accounts'), (snap) => {
      setAccounts(snap.docs.map((d: AdapterDocument) => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Error loading accounts:", error);
    });

    return () => {
      unsubCouriers();
      unsubOrders();
      unsubAccounts();
    };
  }, [roleLoading]);

  const handleOpenEdit = (courier: any) => {
    setSelectedCourier(courier);
    setEditFormData({
      fullName: courier.fullName || '',
      phone: courier.phone || '',
      email: courier.email || '',
      address: courier.address || '',
      gpsLocation: courier.gpsLocation || '',
      disabled: courier.disabled || false,
      commissionRate: courier.commissionRate || 0,
      notes: courier.notes || '',
      courierType: courier.courierType || 'local'
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDetails = (courier: any) => {
    setSelectedCourier(courier);
    setDetailTab('logistics');
    setFinSearch('');
    setFinModuleFilter('all');
    setIsDetailsModalOpen(true);
    setOrdersLoading(true);

    // Clear previous unsubs if any
    detailsUnsubs.forEach(u => u());

    const qOrders = query(
      collection(db, 'orders'),
      or(
        where('deliveryCourierId', '==', courier.id),
        where('shippingCourierId', '==', courier.id)
      ),
      orderBy('createdAt', 'desc')
    );

    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const rows = snap.docs.map((d: AdapterDocument) => ({ id: d.id, ...d.data() }));
      setCourierOrders(rows);
      setOrdersState(rows.length ? asyncState.success(rows) : asyncState.empty());
    }, (err) => {
      console.error("Error fetching courier orders:", err);
      setCourierOrders([]);
      setOrdersState(asyncState.error(err, 'COURIER_ORDERS_LOAD_FAILED'));
    });

    setCourierExpenses([]);
    setDetailsUnsubs([unsubOrders]);
  };

  const handleCloseDetails = () => {
    setIsDetailsModalOpen(false);
    detailsUnsubs.forEach(u => u());
    setDetailsUnsubs([]);
  };

  const handleUpdateCourier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourier || editLoading) return;
    const result = await runMutation(async () => {
      const type = editFormData.courierType || 'local';
      const finCurrency = type === 'sourcing' ? 'SAR' : 'YER';
      await updateDoc(doc(db, 'couriers', selectedCourier.id), {
        fullName: editFormData.fullName,
        phone: editFormData.phone,
        email: editFormData.email,
        address: editFormData.address,
        gpsLocation: editFormData.gpsLocation,
        disabled: editFormData.disabled,
        commissionRate: editFormData.commissionRate,
        notes: editFormData.notes,
        courierType: type,
        updatedAt: Date.now()
      });
      // Sync financial account name and currency if changed
      const assocAccount = await financialAccountService.getAccountByEntityId(selectedCourier.id);
      if (assocAccount && assocAccount.id) {
        await updateDoc(doc(db, 'accounts', assocAccount.id), {
          entityName: editFormData.fullName,
          currency: finCurrency,
          updatedAt: Date.now()
        });
      }
      activityLogService.log('edit_courier', editFormData.fullName, { ...editFormData });
      notificationService.notify({
        title: isAr ? 'تحديث المندوب' : 'Courier Updated',
        message: isAr ? 'تم تحديث ملف المندوب بنجاح' : 'Courier settings updated successfully',
        type: 'success',
        category: 'system'
      });
      setIsEditModalOpen(false);
    }, setEditMutationState);
    if (result.status === 'error') {
      console.error(result.error);
      notificationService.notify({ title: isAr ? 'فشل العملية' : 'Operation Failed', message: result.error.message, type: 'error' });
    }
  };

  const handleToggleStatus = async (courier: any) => {
    const actionText = courier.disabled ? (isAr ? 'تنشيط' : 'Activate') : (isAr ? 'تعطيل' : 'Disable');
    setConfirmConfig({
      isOpen: true,
      title: isAr ? 'تحديث حالة مندوب' : 'Toggle Courier status',
      message: isAr ? `هل أنت متأكد من رغبتك في ${actionText} حساب المندوب ${courier.fullName}؟` : `Are you sure you want to ${actionText.toLowerCase()} courier ${courier.fullName}?`,
      type: 'warning',
      onConfirm: async () => {
        const result = await runMutation(async () => {
          await updateDoc(doc(db, 'couriers', courier.id), { disabled: !courier.disabled, updatedAt: Date.now() });
          activityLogService.log('edit_courier', courier.fullName, { id: courier.id, disabled: !courier.disabled });
        }, setEditMutationState);
        if (result.status === 'success-after-mutation') {
          notificationService.notify({
            title: isAr ? 'تم تحديث الوضعية' : 'Status Toggle Successful',
            message: isAr ? `تم تعديل وضعية الحساب إلى: ${courier.disabled ? 'نشط' : 'معطل'}` : `Account is now: ${courier.disabled ? 'Active' : 'Disabled'}`,
            type: 'info',
            category: 'system'
          });
        } else if (result.status === 'error') {
          handlePostgreSQLError(result.error, OperationType.UPDATE, 'couriers');
        }
      }
    });
  };

  const handleDeleteCourier = async (id: string, name: string) => {
    setDeletePinConfig({
      isOpen: true,
      entityId: id,
      entityName: name
    });
  };

  const handleAddCourier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addLoading) return;

    if (createSystemUser) {
      if (!systemUserFormData.username.trim() || !systemUserFormData.password.trim()) {
        return notificationService.notify({
          title: isAr ? 'بيانات ناقصة' : 'Missing Data',
          message: isAr ? 'يرجى إدخال اسم المستخدم وكلمة المرور للنظام' : 'Username and password required for system user',
          type: 'error',
          category: 'system'
        });
      }
    }

    const result = await runMutation(async () => {
      // 1. Generate unique custom courier ID
      const courierCountSnap = couriers.length;
      const customId = `ALX-CR-${(courierCountSnap + 1).toString().padStart(3, '0')}`;

      const emailValue = addFormData.email || `${customId.toLowerCase()}@alx.delivery.net`;
      const { accountCode, code, accountId } =
        await financialAccountService.getNextAccountIdentifiers('courier');
      const newId = 'cour_' + accountCode;
      // 2. Save directly to Couriers portfolio as a plain record with auto-ID
      const newCourierRef = doc(collection(db, 'couriers'), newId);
      const type = addFormData.courierType === 'sourcing' ? 'sourcing' : 'local';
      const finCurrency = type === 'sourcing' ? 'SAR' : 'YER';
      await setDoc(newCourierRef, {
        fullName: addFormData.fullName,
        phone: addFormData.phone,
        email: emailValue,
        address: addFormData.address,
        gpsLocation: addFormData.gpsLocation,
        disabled: false,
        courierCustomId: customId,
        commissionRate: addFormData.commissionRate,
        notes: addFormData.notes,
        courierType: type,
        createdAt: Date.now()
      });

      // 3. Auto-create financial account (2120-xxxx)
      try {
        await financialAccountService.createAccountForEntity(
          'courier',
          newCourierRef.id,
          addFormData.fullName,
          type === 'sourcing' ? (settings.defaultOrderCurrency ?? settings.currency ?? 'YER') : (settings.currency ?? 'YER')
        );
      } catch (accErr) {
        console.warn('[Couriers] Could not create financial account:', accErr);
      }

      // Provision System User in `users` table if requested
      if (createSystemUser) {
        try {
          const userId = 'usr_' + Math.random().toString(36).substring(2, 11);
          const userPayload = {
            id: userId,
            username: systemUserFormData.username.trim(),
            email: systemUserFormData.email.trim() || emailValue,
            password: systemUserFormData.password,
            systemPin: systemUserFormData.systemPin.trim(),
            fullName: addFormData.fullName.trim(),
            phone: addFormData.phone.trim(),
            role: systemUserFormData.role || 'Courier',
            disabled: false,
            linkedType: 'courier',
            linkedEntity: newId,
            createdAt: Date.now()
          };
          await setDoc(doc(db, 'users', userId), userPayload);
        } catch (uErr: any) {
          console.error('[Couriers] Error provisioning system user:', uErr);
        }
      }

      activityLogService.log('add_courier', addFormData.fullName, { ...addFormData, courierCustomId: customId });
      notificationService.notify({
        title: isAr ? 'تم تسجيل مندوب' : 'Courier Registered',
        message: isAr
          ? `تم تسجيل المندوب برمز: ${customId} ${createSystemUser ? 'وانشاء حساب مستخدم النظام وربطه به تلقائياً' : 'وانشاء حسابه المالي تلقائياً'}`
          : `Courier ${addFormData.fullName} registered successfully`,
        type: 'success',
        category: 'system'
      });

      // Reset form setup
      setCreateSystemUser(false);
      setAddFormData({ fullName: '', phone: '', email: '', address: '', gpsLocation: '', commissionRate: 0, notes: '', courierType: 'local' });
      setSystemUserFormData({ username: '', email: '', password: '', systemPin: '', role: 'Courier' });
      setIsAddModalOpen(false);

    }, setAddMutationState);
    if (result.status === 'error') {
      console.error(result.error);
      notificationService.notify({ title: isAr ? 'فشل العملية' : 'Operation Failed', message: result.error.message, type: 'error' });
    }
  };

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

  const exportCouriersToPDF = () => {
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
    doc.text('AL-XPRESS COURIER & DISPATCH DIRECTORY', 15, 16);

    doc.setTextColor(180, 180, 180);
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'normal');
    doc.text('LIVE PERFORMANCE LEDGERS & FLEET TELEMETRY', 15, 23);

    doc.setTextColor(130, 130, 130);
    doc.setFontSize(7);
    doc.text(`Generated: ${new Date().toLocaleString()} | User: ${profile?.fullName || profile?.email || 'Administrator'}`, 15, 29);

    // Quick statistics summary block
    doc.setFillColor(245, 245, 247);
    doc.roundedRect(12, 44, 186, 22, 3, 3, 'F');

    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(120, 120, 120);
    doc.text('ACTIVE DISPATCH AGENTS', 20, 51);
    doc.text('TOTAL REVENUE POOL', 90, 51);
    doc.text('OUTSTANDING CASH HELD', 145, 51);

    const activeFleetCount = filteredCouriers.filter(c => !c.disabled).length;
    const totalCashHeld = 0; // Removed manual wallet tracking

    doc.setFontSize(11);
    doc.setTextColor(15, 15, 18);
    doc.text(`${activeFleetCount} Couriers`, 20, 59);
    doc.text(`N/A (Real-time synced)`, 90, 59);
    doc.text(`${totalCashHeld.toLocaleString()} YER`, 145, 59);

    // Headers of main data grid
    doc.setFillColor(24, 24, 27);
    doc.rect(12, 72, 186, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.text('AGENT CODE', 15, 77);
    doc.text('COURIER NAME & CONTACT', 45, 77);
    doc.text('COMMISSION %', 115, 77);
    doc.text('CASH HELD (YER)', 145, 77); // Keep header but will show empty or 0 if needed, or remove
    doc.text('FLEET STATUS', 175, 77);

    let yIdx = 87;
    // Walk through sorted & filtered list
    filteredCouriers.forEach((courier, index) => {
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
        doc.text('COURIER DIRECTORY (CONTINUED)', 15, 11);

        doc.setFillColor(24, 24, 27);
        doc.rect(12, 24, 186, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text('AGENT CODE', 15, 29);
        doc.text('COURIER NAME & CONTACT', 45, 29);
        doc.text('COMMISSION %', 115, 29);
        doc.text('CASH HELD (YER)', 145, 29);
        doc.text('FLEET STATUS', 175, 29);

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

      // Agent custom ID
      doc.setFont('Helvetica', 'bold');
      doc.text(courier.courierCustomId || `ALX-CR-${index + 1}`, 15, yIdx);
      doc.setFont('Helvetica', 'normal');

      // Courier Name
      const nameText = transliterateArabic(courier.fullName || 'Operational Box');
      doc.text(nameText.length > 28 ? `${nameText.substring(0, 26)}...` : nameText, 45, yIdx);

      // Commission
      const commRate = courier.commissionRate || 0;
      doc.text(`${commRate}%`, 115, yIdx);

      // Cash Held
      doc.text('0', 145, yIdx);

      // Status
      const agentStatus = courier.disabled ? 'SUSPENDED' : 'ONLINE';
      if (agentStatus === 'SUSPENDED') {
        doc.setTextColor(190, 40, 40);
        doc.setFont('Helvetica', 'bold');
        doc.text(agentStatus, 175, yIdx);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(40, 40, 43);
      } else {
        doc.setTextColor(16, 124, 65);
        doc.text(agentStatus, 175, yIdx);
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
    doc.text('System generated administrative dispatcher registry. Designed for internal Al-Xpress Corp compliance audit.', 15, 288);
    doc.text(`Doc Ref: ALX-${new Date().getFullYear()}/FLEET`, 175, 288);

    doc.save(`AlXpress_Courier_Directory_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportCouriersToCSV = () => {
    const headers = [
      isAr ? 'رمز المندوب' : 'Agent ID',
      isAr ? 'الاسم بالكامل' : 'Full Name',
      isAr ? 'رقم الهاتف' : 'Phone Number',
      isAr ? 'البريد الإلكتروني' : 'Mail Address',
      isAr ? 'نسبة العمولة' : 'Commission Rate',
      isAr ? 'الرصيد المحتجز (ريال)' : 'Cash Balance YER',
      isAr ? 'ملاحظات المندوب' : 'Agent Notes',
      isAr ? 'الحالة' : 'Status'
    ];

    const csvLines = [headers.join(',')];

    filteredCouriers.forEach(c => {
      const row = [
        `"${c.courierCustomId || ''}"`,
        `"${(c.fullName || '').replace(/"/g, '""')}"`,
        `"${c.phone || ''}"`,
        `"${c.email || ''}"`,
        c.commissionRate || 0,
        0, // Wallet balance removed
        `"${(c.notes || '').replace(/"/g, '""')}"`,
        `"${c.disabled ? (isAr ? 'موقوف' : 'Suspended') : (isAr ? 'نشط' : 'Active')}"`
      ];
      csvLines.push(row.join(','));
    });

    const csvContent = "\uFEFF" + csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AlXpress_Courier_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter couriers
  const filteredCouriers = couriers
    .filter(c => {
      const matchSearch = (c.fullName || '').toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search) || (c.courierCustomId || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' && !c.disabled) || (statusFilter === 'disabled' && c.disabled);
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortBy === 'name-asc') return (a.fullName || '').localeCompare(b.fullName || '');
      if (sortBy === 'balance-desc') {
        return getCourierCustodyStats(b.id).remainingCustody - getCourierCustodyStats(a.id).remainingCustody;
      }
      return 0;
    });

  // Calculate detailed aggregates in real-time using the Smart Custody system
  const activeStats = selectedCourier ? getCourierCustodyStats(selectedCourier.id) : null;
  const totalDelivered = activeStats ? activeStats.totalDelivered : 0;
  const totalInTransit = activeStats ? activeStats.totalInTransit : 0;

  const totalCollectedFromCustomers = activeStats
    ? activeStats.courierOrders
      .filter(o => {
        const status = o.orderStatus || o.order_status || '';
        return o.deliveryCourierId === selectedCourier?.id && (status === 'تم التسليم' || status === 'Delivered');
      })
      .reduce((sum, o) => sum + (parseFloat(o.amountRemaining) || 0), 0)
    : 0;

  const totalAdvancesReceived = activeStats
    ? activeStats.courierExpenses
      .filter(e => e.recipientId === selectedCourier?.id && e.type === 'Advance' && e.status === 'Approved')
      .reduce((sum, e) => sum + (parseFloat(e.amountInDefaultCurrency || e.amount) || 0), 0)
    : 0;

  const totalRemittedToBox = activeStats ? activeStats.totalRemitted : 0;
  const remainingCustodyInHand = activeStats ? activeStats.remainingCustody : 0;

  const totalCollectedFromCustomersInCourierCurrency = selectedCourier?.courierType === 'sourcing'
    ? totalCollectedFromCustomers / (dbRates.SAR || 1)
    : totalCollectedFromCustomers;

  const formatDetailCurrency = (amount: number) => {
    const isSourcing = selectedCourier?.courierType === 'sourcing';
    const curr = isSourcing ? 'SAR' : 'YER';
    const formatted = `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${curr}`;
    if (isSourcing) {
      const yerEquiv = amount * (dbRates.SAR || 1);
      return `${formatted} (≈ ${Math.round(yerEquiv).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} YER)`;
    }
    return formatted;
  };

  if (loading || roleLoading) {
    return (
      <div className="flex bg-[#0e0e11] text-white h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded border-2 border-[#d4af37]/25 border-t-[#d4af37]"></div>
      </div>
    );
  }

  if (!hasPermission('view_couriers') && role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#121215] to-[#070708] rounded-3xl border border-slate-850 shadow-xl text-center select-none">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-[#d4af37] mb-2 uppercase tracking-wide text-center">{t('accessDenied')}</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">{isAr ? 'هذه الصفحة مخصصة للمسؤولين عن تتبع الكوادر اللوجستية والمناديب.' : 'This page is restricted to logistics & courier coordinators.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-start transition-colors font-sans selection:bg-[#d4af37]/30">

      {/* Title Header Panel */}
      <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-5 rounded-3xl shadow-lg shadow-black/3c">
        <div className="flex items-center gap-3">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-2.5 rounded-2xl text-[#d4af37]">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-none mb-1">{isAr ? 'إدارة وكلاء التوصيل والمناديب' : 'Couriers Portfolio'}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isAr ? 'تنظيم الحسابات اللوجيستية • تتبع العهد المستلمة وجرد أرصدة الحسابات' : 'Logistics settlements • Cash custody & Courier accounts'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={exportCouriersToPDF}
            className="bg-slate-950 hover:bg-slate-900 border border-[#d4af37]/25 text-[#d4af37] px-4 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs transition active:scale-95 shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4" /> {isAr ? 'طباعة تقرير PDF' : 'PDF Report'}
          </button>

          <button
            onClick={exportCouriersToCSV}
            className="bg-slate-950 hover:bg-slate-905 border border-emerald-900 text-emerald-400 px-4 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs transition active:scale-95 shadow-md cursor-pointer"
          >
            <Activity className="w-4 h-4" /> {isAr ? 'تصدير CSV' : 'Export CSV'}
          </button>

          {role === 'Admin' || hasPermission('add_couriers') ? (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black px-5 py-2.5 rounded-xl flex items-center gap-2 font-black text-xs transition transform active:scale-95 shadow-md shadow-yellow-950/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> {isAr ? 'مندوب جديد' : 'New Courier'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Main Hub Container */}
      <div className="bg-[#121215] border border-slate-850 rounded-3xl overflow-hidden shadow-2xl flex flex-col">

        {/* Advanced Filter Belt */}
        <div className="p-4 border-b border-slate-850 bg-black/30 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input
              type="text"
              placeholder={isAr ? 'البحث باسم المندوب أو طرازه الموحد...' : 'Query by name or custom id...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2 bg-black/50 border border-slate-850 rounded-xl focus:border-[#d4af37]/60 outline-none text-xs text-white placeholder:text-slate-500 font-bold text-start"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-black/50 border border-slate-850 text-slate-300 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50"
          >
            <option value="all">{isAr ? 'جميع الحالات التشغيلية' : 'All States'}</option>
            <option value="active">{isAr ? 'نشط فقط' : 'Active Only'}</option>
            <option value="disabled">{isAr ? 'معطل ومحظور' : 'Disabled / Suspended'}</option>
          </select>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-black/50 border border-slate-850 text-slate-300 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[#d4af37]/50"
          >
            <option value="newest">{isAr ? 'الأحدث تسجيلاً' : 'Newest Hires'}</option>
            <option value="name-asc">{isAr ? 'فرز أبجدي بالاسم' : 'Name (A-Z)'}</option>
            <option value="balance-desc">{isAr ? 'الأعلى مديونية / عهدة بالصندوق' : 'Highest Balance'}</option>
          </select>
        </div>

        {/* Deliveries Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right animate-fade-in">
            <thead className="bg-[#0a0a0d] text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-850">
              <tr>
                <th className="p-4">{isAr ? 'الترخيص والرمز' : 'Licence Code'}</th>
                <th className="p-4">{isAr ? 'ممثل التوصيل والمدينة' : 'Courier / Location'}</th>
                <th className="p-4">{isAr ? 'الجهاز والبريد' : 'Contact Endpoint'}</th>
                <th className="p-4 text-center">{isAr ? 'رصيد العهدة المعلقة' : 'Outstanding Custody'}</th>
                <th className="p-4 text-center">{isAr ? 'العمولة الافتراضية' : 'Com Rate'}</th>
                <th className="p-4 text-center">{isAr ? 'الحالة' : 'Activity'}</th>
                <th className="p-4 text-left">{isAr ? 'الإجراءات والتقرير' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-850 bg-black/10">
              {filteredCouriers.map(courier => {
                const cStats = getCourierCustodyStats(courier.id);
                return (
                  <tr key={courier.id} className={`hover:bg-slate-950/40 transition-colors ${courier.disabled ? 'opacity-80' : ''}`}>
                    <td className="p-4 font-mono font-black text-slate-400">
                      <div className="flex flex-col gap-1 text-right">
                        <span className="bg-slate-900 border border-slate-800 text-[#d4af37] px-2.5 py-0.5 rounded-lg text-[10px] w-max mr-auto">
                          {courier.courierCustomId || 'ALX-CR-XXX'}
                        </span>
                        {(() => {
                          const account = accounts.find(a => a.id === courier.accountId || a.id === courier.financialAccountId || a.entityId === courier.id);
                          if (!account) return null;

                          // ── Live balance from account_trans ────────────────────────────────────
                          const liveByCode = account.accountCode ? liveBalances.byCode[account.accountCode] : undefined;
                          const liveById = account.id ? liveBalances.byId[account.id] : undefined;
                          const displayBalance = liveByCode ?? liveById ?? account.balance ?? 0;

                          return (
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <span className="text-[9px] font-bold text-slate-550 font-mono block">
                                {account.accountCode} <span className="bg-[#d4af37]/10 text-[#d4af37] px-1 rounded">{account.currency || 'YER'}</span>
                              </span>
                              <span className={`text-[9px] font-bold font-mono ${displayBalance > 0 ? 'text-rose-450' :
                                displayBalance < 0 ? 'text-emerald-400' : 'text-slate-500'
                                }`}>
                                {displayBalance > 0 ? '▲' : displayBalance < 0 ? '▼' : '●'} {Math.abs(displayBalance).toLocaleString()} {account.currency || 'YER'}
                                {account.currency === 'SAR' && (
                                  <span className="block text-[8px] text-slate-500 opacity-80 font-normal mt-0.5">
                                    (≈ {(Math.abs(displayBalance) * (settings.exchangeRateSAR || 140)).toLocaleString()} YER)
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="p-4" onClick={() => handleOpenDetails(courier)}>
                      <div className="flex items-center gap-3 cursor-pointer group">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-800 text-[#d4af37] flex items-center justify-center font-black text-xs shrink-0 group-hover:border-[#d4af37] transition-all">
                          {courier.fullName?.substring(0, 2)}
                        </div>
                        <div className="flex flex-col text-start">
                          <span className="font-extrabold text-white group-hover:text-[#d4af37] transition-colors flex items-center gap-1.5">
                            {courier.fullName}
                            <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded">
                              {courier.financialCurrency || (courier.courierType === 'sourcing' ? 'SAR' : 'YER')}
                            </span>
                            {cStats.remainingCustody > 0 && (
                              <span className="inline-block w-2 w-2 rounded-full bg-rose-500 animate-pulse" title={isAr ? "لديه عهدة معلقة غير موردة" : "Has unremitted custody!"}></span>
                            )}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[9px] text-slate-500 font-bold">
                            <span>{courier.address || '—'}</span>
                            <span className="text-slate-800">•</span>
                            <span className="text-emerald-450 font-mono">
                              {cStats.totalDelivered} {isAr ? 'طلب مُستلم' : 'Delivered'}
                            </span>
                            <span className="text-slate-800">•</span>
                            <span className="text-[#d4af37] font-mono">
                              {cStats.deliverySuccessRate}% {isAr ? 'نجاح' : 'Success'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-start">
                      <div className="flex flex-col">
                        <span className="text-slate-300 font-mono font-bold" dir="ltr">{courier.phone || '—'}</span>
                        <span className="text-slate-500 text-[10px] font-mono mt-0.5" dir="ltr">{courier.email || '—'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center font-mono font-black border-slate-850">
                      <div className="inline-flex flex-col items-center select-none" onClick={() => handleOpenDetails(courier)}>
                        <span className={cStats.remainingCustody > 0 ? "text-rose-450 font-black bg-rose-950/20 border border-rose-950/40 px-2.5 py-1 rounded-lg cursor-pointer hover:bg-rose-950/30 transition-all font-mono" : "text-emerald-450 font-black bg-emerald-950/10 border border-emerald-950/20 px-2.5 py-1 rounded-lg cursor-pointer hover:bg-emerald-100/10 transition-all font-mono"}>
                          {cStats.remainingCustody.toLocaleString()} <span className="text-[9px] font-sans text-slate-500">{courier.financialCurrency || 'YER'}</span>
                        </span>
                        {courier.financialCurrency === 'SAR' && (
                          <span className="text-[8.5px] text-slate-500 block mt-0.7 font-bold">
                            (≈ {(cStats.remainingCustody * (dbRates.SAR || 1)).toLocaleString()} YER)
                          </span>
                        )}
                        {cStats.remainingCustody > 0 && (
                          <span className="text-[8px] text-rose-500/80 font-sans font-black mt-1 animate-pulse uppercase tracking-wider block">
                            {isAr ? '⚠️ غير موردة' : '⚠️ UNREMITTED'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center text-slate-400 font-black">
                      {courier.commissionRate || 0}%
                    </td>
                    <td className="p-4 text-center">
                      {courier.disabled ? (
                        <span className="bg-rose-950/30 text-rose-450 border border-rose-950/60 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-tighter">
                          {isAr ? 'معطل' : 'INACTIVE'}
                        </span>
                      ) : (
                        <span className="bg-emerald-950/30 text-emerald-450 border border-emerald-950/60 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-tighter animate-pulse">
                          {isAr ? 'نشط' : 'ACTIVE'}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-left flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenDetails(courier)}
                        title="سجلات التسليم والتوريدات المالية للمندوب"
                        className="text-[#d4af37] bg-[#d4af37]/5 hover:bg-[#d4af37]/15 border border-[#d4af37]/15 p-2 rounded-xl transition duration-300"
                      >
                        <Receipt className="w-4 h-4" />
                      </button>
                      {role === 'Admin' || hasPermission('edit_couriers') ? (
                        <>
                          <button
                            onClick={() => handleToggleStatus(courier)}
                            title={courier.disabled ? (isAr ? 'تنشيط المندوب' : 'Activate') : (isAr ? 'تعطيل الحساب' : 'Deactivate')}
                            className={`p-2 rounded-xl border transition-all ${courier.disabled ? 'text-emerald-400 bg-emerald-950/10 border-emerald-950/30' : 'text-rose-450 bg-rose-950/10 border-rose-950/40'}`}
                          >
                            {courier.disabled ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(courier)}
                            className="text-white hover:text-[#d4af37] bg-slate-900 border border-slate-800 p-2 rounded-xl transition-all"
                          >
                            <Edit2 className="w-4 h-4 text-slate-400" />
                          </button>
                        </>
                      ) : null}
                      {hasPermission('delete_couriers') && (
                        <button
                          onClick={() => handleDeleteCourier(courier.id, courier.fullName)}
                          className="text-rose-500 hover:bg-rose-950/20 bg-rose-950/10 border border-rose-950/45 p-2 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredCouriers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-16 text-center text-slate-600 font-bold uppercase tracking-widest font-mono text-[10px]">
                    [ no_couriers_matched_search_filters ]
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details / Report Modal Overlay */}
      <CourierDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={handleCloseDetails}
        isAr={isAr}
        selectedCourier={selectedCourier}
        courierOrders={courierOrders}
        ordersLoading={ordersLoading}
        detailTab={detailTab}
        setDetailTab={setDetailTab}
        finSearch={finSearch}
        setFinSearch={setFinSearch}
        finModuleFilter={finModuleFilter}
        setFinModuleFilter={setFinModuleFilter}
        accounts={accounts}
        liveBalances={liveBalances}
        dbRates={dbRates}
        activeStats={activeStats}
        totalDelivered={totalDelivered}
        totalInTransit={totalInTransit}
        totalCollectedFromCustomersInCourierCurrency={totalCollectedFromCustomersInCourierCurrency}
        totalAdvancesReceived={totalAdvancesReceived}
        totalRemittedToBox={totalRemittedToBox}
        remainingCustodyInHand={remainingCustodyInHand}
        formatDetailCurrency={formatDetailCurrency}
        getCourierOrderPartyStats={getCourierOrderPartyStats}
        getCourierUnifiedLedger={getCourierUnifiedLedger}
      />

      <AddCourierModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        isAr={isAr}
        addFormData={addFormData}
        setAddFormData={setAddFormData}
        createSystemUser={createSystemUser}
        setCreateSystemUser={setCreateSystemUser}
        systemUserFormData={systemUserFormData}
        setSystemUserFormData={setSystemUserFormData}
        addLoading={addLoading}
        handleAddSubmit={handleAddCourier}
      />

      <EditCourierModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        isAr={isAr}
        editFormData={editFormData}
        setEditFormData={setEditFormData}
        editLoading={editLoading}
        handleEditSubmit={handleUpdateCourier}
      />

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
        title={isAr ? 'حذف حساب المندوب نهائياً' : 'Delete Courier Permanently'}
        message={isAr
          ? `هل أنت متأكد من رغبتك في حذف المندوب ${deletePinConfig.entityName}؟ هذا الإجراء سيقوم بحذف حسابه المالي وكافة قيوده ومصروفاته المفتوحة نهائياً من النظام.`
          : `Are you sure you want to permanently delete courier ${deletePinConfig.entityName}? This will purge their financial account, journal transactions, and associated expenses from the database.`}
        isAr={isAr}
        onConfirm={async () => {
          await financialAccountService.purgeEntityAndFinancialFootprint('courier', deletePinConfig.entityId);
          await activityLogService.log('delete_courier', deletePinConfig.entityName, { id: deletePinConfig.entityId });
          notificationService.notify({
            title: isAr ? 'تم الحذف' : 'Courier Deleted',
            message: isAr ? `تم حذف المندوب ${deletePinConfig.entityName} وسجلاته المالية بنجاح` : `Courier ${deletePinConfig.entityName} deleted successfully`,
            type: 'warning'
          });
        }}
      />
    </div>
  );
}
