import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, setDoc, deleteDoc, query, where, orderBy, or } from '../lib/supabase-firebase-adapter';
import { db, auth } from '../lib/supabase-firebase-adapter';
import { handleFirestoreError, OperationType } from '../lib/firebase';
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
import { printContent } from '../lib/printUtils';
import { jsPDF } from 'jspdf';
import { useRole } from '../hooks/useRole';
import { useSettings } from '../context/SettingsContext';
import { notificationService } from '../services/notificationService';
import { activityLogService } from '../services/activityLogService';
import { financialAccountService } from '../services/financialAccountService';
import { useAccountBalances } from '../hooks/useAccountBalances';
import ConfirmModal from '../components/ConfirmModal';
import ConfirmDeletePinModal from '../components/ConfirmDeletePinModal';

export default function Couriers() {
  const { settings, t } = useSettings();
  const [couriers, setCouriers] = useState<any[]>([]);
  const { role, hasPermission, profile, loading: roleLoading } = useRole();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const isAr = settings.language === 'ar';

  // ── Live transaction-based balances (real-time from account_transactions) ────
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
  const [ordersLoading, setOrdersLoading] = useState(false);
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
      collection(db, 'account_transactions'),
      where('entityId', '==', selectedCourier.id)
    );
    const unsubTx = onSnapshot(qTx, (snap) => {
      setCourierTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Error fetching transactions for courier:", err);
    });

    return () => unsubTx();
  }, [selectedCourier, isDetailsModalOpen]);

  // Global collections for smart calculations
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  const [editFormData, setEditFormData] = useState({
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

  const [addFormData, setAddFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    gpsLocation: '',
    commissionRate: 0,
    notes: '',
    courierType: 'local' as 'sourcing' | 'local'
  });

  const [addLoading, setAddLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // Smart Custody Calculator Helper
  const getCourierCustodyStats = (courierId: string) => {
    const cour = couriers.find(c => c.id === courierId);
    const targetCurrency = cour?.courierType === 'sourcing' ? 'SAR' : 'YER';
    const rates = { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR };

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

  const getCourierUnifiedLedger = () => {
    const ledger: any[] = [];
    const isAr = settings.language === 'ar';
    const fCurrency = selectedCourier ? (selectedCourier.financialCurrency || 'YER') : 'YER';
    const exchangeRateSAR = parseFloat(settings.exchangeRateSAR || 140);

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
      setCouriers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'couriers');
    });

    // 2. Subscribe to Orders (Smart Custody / Performance sync)
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      setAllOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Error loading orders:", error);
    });

    // 3. Subscribe to Expenses (Smart Custody sync)
    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snap) => {
      setAllExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Error loading expenses:", error);
    });

    // 4. Subscribe to Accounts
    const unsubAccounts = onSnapshot(collection(db, 'accounts'), (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Error loading accounts:", error);
    });

    return () => {
      unsubCouriers();
      unsubOrders();
      unsubExpenses();
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
      setCourierOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setOrdersLoading(false);
    }, (err) => {
      console.error("Error fetching courier orders:", err);
      setCourierOrders([]);
      setOrdersLoading(false);
    });

    const qExpenses = query(
      collection(db, 'expenses'),
      where('recipientId', '==', courier.id),
      orderBy('createdAt', 'desc')
    );

    const unsubExpenses = onSnapshot(qExpenses, (snap) => {
      setCourierExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Error fetching courier expenses:", err);
      setCourierExpenses([]);
    });

    setDetailsUnsubs([unsubOrders, unsubExpenses]);
  };

  const handleCloseDetails = () => {
    setIsDetailsModalOpen(false);
    detailsUnsubs.forEach(u => u());
    setDetailsUnsubs([]);
  };

  const handleUpdateCourier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourier || editLoading) return;
    setEditLoading(true);
    try {
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
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'couriers');
    } finally {
      setEditLoading(false);
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
        try {
          await updateDoc(doc(db, 'couriers', courier.id), {
            disabled: !courier.disabled,
            updatedAt: Date.now()
          });
          activityLogService.log('edit_courier', courier.fullName, { id: courier.id, disabled: !courier.disabled });
          notificationService.notify({
            title: isAr ? 'تم تحديث الوضعية' : 'Status Toggle Successful',
            message: isAr ? `تم تعديل وضعية الحساب إلى: ${courier.disabled ? 'نشط' : 'معطل'}` : `Account is now: ${courier.disabled ? 'Active' : 'Disabled'}`,
            type: 'info',
            category: 'system'
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, 'couriers');
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
    setAddLoading(true);
    try {
      // 1. Generate unique custom courier ID
      const courierCountSnap = couriers.length;
      const customId = `ALX-CR-${(courierCountSnap + 1).toString().padStart(3, '0')}`;

      const emailValue = addFormData.email || `${customId.toLowerCase()}@alx.delivery.net`;

      // 2. Save directly to Couriers portfolio as a plain record with auto-ID
      const newCourierRef = doc(collection(db, 'couriers'));
      const type = addFormData.courierType === 'sourcing' ? 'sourcing' : 'local';
      const finCurrency = type === 'sourcing' ? 'SAR' : 'YER';
      console.log('DEBUG: Creating courier, type:', type, 'Currency:', finCurrency);
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
      console.log('DEBUG: Creating account for entity with currency:', type === 'sourcing' ? 'SAR' : 'YER');
      try {
        await financialAccountService.createAccountForEntity(
          'courier',
          newCourierRef.id,
          addFormData.fullName,
          type === 'sourcing' ? 'SAR' : 'YER'
        );
      } catch (accErr) {
        console.warn('[Couriers] Could not create financial account:', accErr);
      }

      activityLogService.log('add_courier', addFormData.fullName, { ...addFormData, courierCustomId: customId });
      notificationService.notify({
        title: isAr ? 'تم تسجيل مندوب خارجي' : 'External Courier Registered',
        message: isAr
          ? `تم تسجيل المندوب برمز: ${customId} وإنشاء حسابه المالي تلقائياً`
          : `External courier registered: ${customId} with auto-generated financial account`,
        type: 'success',
        category: 'system'
      });

      // Reset form setup
      setAddFormData({ fullName: '', phone: '', email: '', address: '', gpsLocation: '', commissionRate: 0, notes: '', courierType: 'local' });
      setIsAddModalOpen(false);

    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ في إنشاء المندوب' : 'Registration Failure',
        message: err.message || 'Error configuring Courier record',
        type: 'error',
        category: 'system'
      });
    } finally {
      setAddLoading(false);
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
    ? totalCollectedFromCustomers / (settings.exchangeRateSAR || 140)
    : totalCollectedFromCustomers;

  const formatDetailCurrency = (amount: number) => {
    const isSourcing = selectedCourier?.courierType === 'sourcing';
    const curr = isSourcing ? 'SAR' : 'YER';
    const formatted = `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${curr}`;
    if (isSourcing) {
      const yerEquiv = amount * (settings.exchangeRateSAR || 140);
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

                          // ── Live balance from account_transactions ──────────────────────────
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
                            (≈ {(cStats.remainingCustody * (settings.exchangeRateSAR || 140)).toLocaleString()} YER)
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
      {isDetailsModalOpen && selectedCourier && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0c0c0f] border border-[#d4af37]/25 rounded-3xl shadow-2xl max-w-5xl w-full h-[90vh] overflow-hidden flex flex-col font-sans">

            {/* Header portion */}
            <div className="bg-black/40 p-5 border-b border-slate-850/80 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4 text-start">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#121215] to-[#070708] border border-[#d4af37]/25 text-[#d4af37] flex items-center justify-center font-black text-xl shadow-lg shadow-black/40">
                  {selectedCourier.fullName?.substring(0, 2)}
                </div>
                <div>
                  <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2 mb-1">
                    {selectedCourier.fullName}
                    <Crown className="w-4 h-4 text-[#d4af37]" />
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-slate-500 font-bold">
                    <span className="text-[10px] font-mono" dir="ltr">{selectedCourier.email}</span>
                    <span className="w-1.5 h-1.5 bg-slate-805 rounded-full"></span>
                    <span className="text-[10px] font-mono" dir="ltr">{selectedCourier.phone}</span>
                    <span className="w-1.5 h-1.5 bg-slate-805 rounded-full"></span>
                    <span className="text-[10px] bg-slate-900 border border-slate-800 text-[#d4af37] px-2 py-0.5 rounded-md font-mono">ID: {selectedCourier.courierCustomId}</span>
                    <span className="text-[10px] bg-purple-950/20 border border-purple-950/50 text-purple-400 px-2 py-0.5 rounded-md">عمولة: {selectedCourier.commissionRate}%</span>
                  </div>
                  {selectedCourier.address && (
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-[#d4af37]" />
                      <span>{selectedCourier.address}</span>
                      {selectedCourier.gpsLocation && (
                        <a href={selectedCourier.gpsLocation.startsWith('http') ? selectedCourier.gpsLocation : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedCourier.gpsLocation)}`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline flex items-center gap-1 ml-2">
                          (الموقع GPS)
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={handleCloseDetails} className="bg-slate-900 hover:bg-slate-850 p-2 rounded-xl text-slate-500 hover:text-white border border-slate-800 transition-all active:scale-95"><X className="w-5 h-5" /></button>
            </div>

            {/* Scrollable Content inside Details portal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0a0a0c]" id="courier-ledger-content">

              {selectedCourier.notes && (
                <div className="bg-amber-950/10 border border-amber-950/40 p-4 rounded-xl text-start">
                  <h5 className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">⚠️ ملاحظات تشغيلية سرية</h5>
                  <p className="text-slate-350 leading-relaxed font-bold text-xs">{selectedCourier.notes}</p>
                </div>
              )}

              {/* Smart Unremitted Custody Alert Warning */}
              {remainingCustodyInHand > 0 && (
                <div className="bg-rose-955/15 border border-rose-500/35 p-5 rounded-2xl text-start flex items-start gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-450 shrink-0">
                    <ShieldAlert className="w-5 h-5 animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 animate-spin-slow" />
                      {isAr ? 'تنبيه عهد وقيم معلقة تحت التحصيل غير موردة!' : 'ALERT: ACTIVE UNREMITTED COURIER CUSTODY'}
                    </h4>
                    <p className="text-slate-300 text-[11px] font-bold leading-relaxed">
                      {isAr
                        ? `يحمل المندوب حالياً مبالغ مالية متبقية بعهدة ذمته بقيمة (${formatDetailCurrency(remainingCustodyInHand)}) مستحقة لخزينة الشركة ولم يوردها بعد. يرجى مراجعة وتصفية كافة مستحقات الشحن والعهد المفتوحة لتجنب التراكم.`
                        : `This courier is currently holding an outstanding unremitted custody of (${formatDetailCurrency(remainingCustodyInHand)}) due to the company cash box. Please initiate box remittance with the audited staff immediately.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Tab Selector for Courier */}
              <div className="flex bg-black/35 border border-slate-850/50 p-1 rounded-2xl gap-2 mt-4 shrink-0 font-sans">
                <button
                  type="button"
                  onClick={() => setDetailTab('logistics')}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] sm:text-xs font-black transition flex items-center justify-center gap-1.5 ${detailTab === 'logistics'
                      ? 'bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37]'
                      : 'border border-transparent text-slate-500 hover:text-slate-350'
                    }`}
                >
                  <Package className="w-4 h-4" />
                  {isAr ? 'بيانات الأداء الميداني والعهد' : 'Field Performance & Custody'}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('financial')}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] sm:text-xs font-black transition flex items-center justify-center gap-1.5 ${detailTab === 'financial'
                      ? 'bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37]'
                      : 'border border-transparent text-slate-500 hover:text-slate-350'
                    }`}
                >
                  <Coins className="w-4 h-4" />
                  {isAr ? 'كشف الحساب المالي للمندوب' : 'Courier Financial Statement'}
                </button>
              </div>

              {detailTab === 'logistics' && (
                <>
                  {/* Courier Performance Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md">
                      <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block mb-3 text-start">{isAr ? 'أداء وكفاءة التوصيل' : 'Transit KPI'}</span>
                      <div className="flex items-baseline gap-1.5 text-start">
                        <span className="text-xl font-black text-[#d4af37]">{totalDelivered}</span>
                        <span className="text-[10px] font-bold text-slate-500">{isAr ? 'مسلم ناجح' : 'Delivered success'}</span>
                      </div>
                      <div className="text-[9px] text-amber-500 font-bold mt-1 text-start">
                        {totalInTransit} {isAr ? 'قيد التوصيل حالياً' : 'Current Handover'}
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md text-start">
                      <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block mb-3">{isAr ? 'المبالغ التي استلمها المندوب' : 'Total Custody Received'}</span>
                      <div className="text-base font-mono font-black text-amber-400">{formatDetailCurrency(totalCollectedFromCustomersInCourierCurrency + totalAdvancesReceived)}</div>
                      <span className="text-[9px] text-slate-500 font-bold block mt-1">{isAr ? 'يشمل نقد الشحنات والعهد والسلف' : 'Includes COD cash, custody & advances'}</span>
                    </div>

                    <div className="bg-gradient-to-br from-[#121215] to-[#070708] p-4 rounded-2xl border border-slate-850 shadow-md text-start">
                      <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block mb-3">{isAr ? 'المبالغ الموردة للصندوق' : 'Remitted To Fund'}</span>
                      <div className="text-base font-mono font-black text-emerald-450">{formatDetailCurrency(totalRemittedToBox)}</div>
                      <span className="text-[9px] text-slate-500 font-bold block mt-1">{isAr ? 'عهد مسواة وموردة رسمياً' : 'Cleared / discharged custody'}</span>
                    </div>

                    <div className={`p-4 rounded-2xl border text-start ${remainingCustodyInHand > 0 ? 'bg-rose-950/10 border-rose-950/40' : 'bg-[#121215] border-slate-850'}`}>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-3">
                        {remainingCustodyInHand > 0 ? '⚠️ المبالغ المتبقية بعهدته' : '✅ العهدة مصفاة بالكامل'}
                      </span>
                      <div className={`text-base font-mono font-black mb-1 ${remainingCustodyInHand > 0 ? 'text-rose-450' : 'text-emerald-450'}`}>
                        {formatDetailCurrency(remainingCustodyInHand)}
                      </div>
                      <span className="text-[9px] text-slate-500 font-bold block">{isAr ? 'عهد وذمم متبقية بذمة المندوب' : 'Outstanding client-side balance'}</span>
                    </div>
                  </div>

                  {/* Logistics Performance Analytics Sheet */}
                  <div className="bg-[#121215] p-5 rounded-2xl border border-slate-850 text-start space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-xs text-[#d4af37] uppercase tracking-wider mb-1">
                          {isAr ? '📈 تقارير ومعدلات أداء المندوب الذكية' : '📈 COURIER PERFORMANCE REPORT & KPI OUTLOOK'}
                        </h4>
                        <p className="text-[10px] text-slate-550 font-bold">{isAr ? 'تنقيب وتحليل فترات الشحن، والتسوية، والكفاءة العامة لنظام العهد' : 'Monitor delivery success rates, handover ratios, and physical turnovers'}</p>
                      </div>
                      <div className="bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] text-xs px-3 py-1 rounded-xl font-mono font-black">
                        {activeStats ? `${activeStats.deliverySuccessRate}%` : '0%'}
                      </div>
                    </div>

                    {/* Progress bar visual indicator */}
                    <div className="w-full bg-slate-900 border border-slate-855 rounded-full h-3 overflow-hidden shadow-inner">
                      <div
                        className="bg-gradient-to-r from-yellow-600 to-[#d4af37] h-3 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(212,175,55,0.3)]"
                        style={{ width: `${activeStats ? activeStats.deliverySuccessRate : 0}%` }}
                      ></div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                      <div className="p-3.5 bg-black/40 border border-slate-850 rounded-xl">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1.5 font-bold">{isAr ? 'مجموع الشحنات الموكلة' : 'Total Assigned'}</span>
                        <span className="text-base font-black text-white font-mono">{activeStats?.totalOrdersCount || 0}</span>
                      </div>
                      <div className="p-3.5 bg-black/40 border border-slate-850 rounded-xl">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1.5 font-bold">{isAr ? 'تم تسليمها للعميل' : 'Delivered Status'}</span>
                        <span className="text-base font-black text-emerald-450 font-mono">{activeStats?.totalDelivered || 0}</span>
                      </div>
                      <div className="p-3.5 bg-black/40 border border-slate-850 rounded-xl">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1.5 font-bold">{isAr ? 'قيد النقل والتوصيل' : 'In Hand / Shipped'}</span>
                        <span className="text-base font-black text-cyan-400 font-mono">{activeStats?.totalInTransit || 0}</span>
                      </div>
                      <div className="p-3.5 bg-black/40 border border-slate-850 rounded-xl">
                        <span className="text-[9px] text-[#d4af37]/80 uppercase tracking-widest block mb-1.5 font-bold">{isAr ? 'مجموع فاعلية التسليم' : 'Fulfillment %'}</span>
                        <span className="text-base font-black text-[#d4af37] font-mono">{activeStats?.deliverySuccessRate || 0}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery History Log */}
                  <div className="space-y-3 text-start">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-xs text-[#d4af37] uppercase tracking-wider">{isAr ? 'سجل التسليمات والشحنات الموكلة للمندوب' : 'Operational Delivery Log'}</h4>
                      <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-500 px-3 py-1 rounded-lg font-bold font-mono">LIVE SYNC</span>
                    </div>

                    {ordersLoading ? (
                      <div className="p-12 text-center text-slate-500 font-bold font-mono uppercase tracking-widest">[ extracting_ledger_traces ]</div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {courierOrders.map(order => {
                          const isDelivered = (order.order_status || order.orderStatus) === "تم التسليم";
                          return (
                            <div key={order.id} className="bg-[#121215] p-4 rounded-2xl border border-slate-850 flex items-start gap-4 hover:border-[#d4af37]/30 transition-all group">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner ${isDelivered ? "bg-emerald-950/20 text-emerald-400 border-emerald-950/50" : "bg-blue-950/20 text-blue-400 border-blue-950/50"}`}>
                                <Package className="w-5 h-5 animate-hover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-mono font-black text-white text-xs truncate">
                                    {order.orderNumber || 'ALX-XXXX-XXXX'}
                                    {order.trackingNumber && <span className="text-[9px] text-slate-500 font-bold block mt-0.5">Track: {order.trackingNumber}</span>}
                                  </span>
                                  <span className={`text-[8px] font-black px-2 py-0.5 rounded tracking-tighter ${isDelivered ? "bg-emerald-950/30 text-emerald-400" : "bg-blue-950/30 text-blue-450"}`}>
                                    {order.orderStatus || order.order_status || 'معلق'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 mb-2">
                                  {order.shippingCourierId === selectedCourier.id && (
                                    <span className="text-[8px] font-bold bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800">مندوب شحن</span>
                                  )}
                                  {order.deliveryCourierId === selectedCourier.id && (
                                    <span className="text-[8px] font-black bg-purple-950/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-950/30">مندوب توصيل</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold mb-2">
                                  <span className="flex items-center gap-1 text-slate-300"><User className="w-3 h-3 text-[#d4af37]" /> {order.receiverName || order.receiver_name || 'مستلم مجهول'}</span>
                                  <span className="flex items-center gap-1 text-slate-300"><MapPin className="w-3 h-3 text-[#d4af37]" /> {order.receiverCity || order.receiver_city || '—'}</span>
                                </div>
                                <div className="bg-black/40 p-2 rounded-xl border border-slate-850 flex items-center justify-between">
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                    <span>إجمالي الرسوم: <span className="text-white font-mono">{((parseFloat(order.amountPaid) || 0) + (parseFloat(order.amountRemaining) || 0)).toLocaleString()} YER</span></span>
                                  </div>
                                  <div className="text-[9px] font-mono font-bold text-slate-500">
                                    {new Date(order.createdAt).toLocaleDateString('ar-YE')}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {courierOrders.length === 0 && (
                          <div className="lg:col-span-2 p-16 text-center text-slate-600 font-bold font-mono text-[9px] capitalize select-none">
                            [ no_operational_handover_records_linked_to_this_account ]
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {detailTab === 'financial' && (() => {
                const account = accounts.find(a => a.id === selectedCourier.accountId || a.id === selectedCourier.financialAccountId || a.entityId === selectedCourier.id);
                const ledgerData = getCourierUnifiedLedger();
                const debits = ledgerData.filter(i => i.type === 'Debit').reduce((sum, i) => sum + i.amountFCurrency, 0);
                const credits = ledgerData.filter(i => i.type === 'Credit').reduce((sum, i) => sum + i.amountFCurrency, 0);
                // ── Live balance from account_transactions (preferred over stored account.balance) ──
                const liveByCode = account?.accountCode ? liveBalances.byCode[account.accountCode] : undefined;
                const liveById = account?.id ? liveBalances.byId[account.id] : undefined;
                const netBalance = liveByCode ?? liveById ?? account?.balance ?? 0;
                const fCurrency = account?.currency || selectedCourier.financialCurrency || 'YER';
                const exchangeRateSAR = parseFloat(settings.exchangeRateSAR || 140);

                const filteredLedger = ledgerData.filter(item => {
                  const q = finSearch.toLowerCase();
                  const matchesSearch = !q ||
                    (item.title || '').toLowerCase().includes(q) ||
                    (item.description || '').toLowerCase().includes(q) ||
                    (item.ref || '').toLowerCase().includes(q);
                  const matchesModule = finModuleFilter === 'all' || item.module === finModuleFilter;
                  return matchesSearch && matchesModule;
                });

                return (
                  <div className="space-y-6">
                    {/* Financial Summary Info Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Unified Account Balance card */}
                      <div className="bg-gradient-to-br from-[#02130a] to-[#041a10] border border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-between text-start shadow">
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5" />
                          {isAr ? 'رصيد الحساب الموحد' : 'Consolidated Balance'}
                        </span>
                        <div className={`font-mono font-black text-base ${netBalance >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                          {netBalance.toLocaleString()} {fCurrency}
                          {fCurrency === 'SAR' && (
                            <span className="block text-[11px] text-slate-400 font-normal mt-0.5" dir="ltr">
                              (≈ {(netBalance * exchangeRateSAR).toLocaleString()} YER)
                            </span>
                          )}
                        </div>
                        <span className="text-[8.5px] text-slate-500 font-sans mt-1">
                          {isAr ? 'مستحق كسب (دائن) أو ذمة (مدين)' : 'Live calculated balanced path'}
                        </span>
                      </div>

                      {/* Debits */}
                      <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 rounded-2xl p-4 flex flex-col justify-between text-start shadow">
                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          {isAr ? 'إجمالي المدينات (المستقطع -)' : 'Total Debits (-)'}
                        </span>
                        <div className="font-mono font-black text-rose-400 text-base">
                          {debits.toLocaleString()} {fCurrency}
                          {fCurrency === 'SAR' && (
                            <span className="block text-[11px] text-slate-400 font-normal mt-0.5" dir="ltr">
                              (≈ {(debits * exchangeRateSAR).toLocaleString()} YER)
                            </span>
                          )}
                        </div>
                        <span className="text-[8.5px] text-slate-500 font-sans mt-1">
                          {isAr ? 'العهد المستلمة والمبيعات المحصلة' : 'Obligations, COD cash & custodies'}
                        </span>
                      </div>

                      {/* Credits */}
                      <div className="bg-gradient-to-br from-[#121215] to-[#070708] border border-slate-850 rounded-2xl p-4 flex flex-col justify-between text-start shadow">
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <ArrowUpLeft className="w-3.5 h-3.5" />
                          {isAr ? 'إجمالي المودعات (المضاف +)' : 'Total Credits (+)'}
                        </span>
                        <div className="font-mono font-black text-emerald-400 text-base">
                          {credits.toLocaleString()} {fCurrency}
                          {fCurrency === 'SAR' && (
                            <span className="block text-[11px] text-slate-400 font-normal mt-0.5" dir="ltr">
                              (≈ {(credits * exchangeRateSAR).toLocaleString()} YER)
                            </span>
                          )}
                        </div>
                        <span className="text-[8.5px] text-slate-500 font-sans mt-1">
                          {isAr ? 'العهد المصفاة من رواتب وأجور وتوريد' : 'Wages earned & cash box handovers'}
                        </span>
                      </div>
                    </div>

                    {/* Filter and statement block */}
                    <div className="flex flex-col sm:flex-row gap-3 p-4 bg-black/45 border border-slate-850/60 rounded-2xl">
                      <div className="relative flex-1">
                        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input
                          type="text"
                          placeholder={isAr ? 'البحث عن حركة برقم القيد، المرجع، أو البيان...' : 'Filter ledger details...'}
                          value={finSearch}
                          onChange={e => setFinSearch(e.target.value)}
                          className="w-full bg-black/50 border border-slate-855 rounded-xl py-2 px-9 text-xs font-bold text-white focus:border-[#d4af37]/50 outline-none text-start"
                        />
                      </div>
                      <select
                        value={finModuleFilter}
                        onChange={e => setFinModuleFilter(e.target.value as any)}
                        className="bg-[#0e0e11] border border-slate-820 rounded-xl py-2 px-3 text-xs font-black text-slate-300 outline-none focus:border-[#d4af37]/50 cursor-pointer text-start"
                      >
                        <option value="all">{isAr ? 'جميع التصنيفات' : 'All Activities'}</option>
                        <option value="order">{isAr ? 'الطرود والتحصيلات COD' : 'COD Shipments'}</option>
                        <option value="expense">{isAr ? 'العهد والمسحوبات' : 'Custody & Expenses'}</option>
                        <option value="transaction">{isAr ? 'القيود اليدوية والتسويات' : 'Settlement Entries'}</option>
                      </select>
                    </div>

                    {/* Statement Table of selected Courier */}
                    <div className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
                      <div className="p-4 border-b border-slate-850 bg-black/40 flex justify-between items-center text-start">
                        <h4 className="font-black text-xs text-emerald-455 uppercase tracking-wider flex items-center gap-2">
                          <Coins className="w-4 h-4 animate-pulse animate-spin-slow" />
                          {isAr ? 'كشف الحساب المالي التفصيلي للمندوب' : 'COURIER FINANCIAL AUDIT STATEMENT'}
                        </h4>
                        <span className="text-[10px] bg-emerald-950/25 text-[#d4af37] border border-[#d4af37]/40 px-3 py-1 rounded-lg font-bold font-mono">
                          {isAr ? 'مطابق ومحدث حياً' : 'AUDITED LOG'}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-black/30 text-[9px] text-slate-500 uppercase tracking-widest font-black border-b border-slate-850">
                            <tr>
                              <th className="p-3 text-start">{isAr ? 'التاريخ' : 'Posting Date'}</th>
                              <th className="p-3 text-start">{isAr ? 'التصنيف' : 'Classification'}</th>
                              <th className="p-3 text-start">{isAr ? 'البيان والتفاصيل' : 'Description / Narrative'}</th>
                              <th className="p-3 text-start">{isAr ? 'رقم المرجع' : 'Reference Ref'}</th>
                              <th className="p-3 text-start">{isAr ? 'النوع' : 'Entry Type'}</th>
                              <th className="p-3 text-start">{isAr ? 'المبلغ (العملة الأصلية)' : 'Amount (Original)'}</th>
                              <th className="p-3 text-start">{isAr ? `الحساب المالي (${selectedCourier.financialCurrency || 'YER'})` : `Account Balance (${selectedCourier.financialCurrency || 'YER'})`}</th>
                              <th className="p-3 text-left">{isAr ? 'الرصيد التراكمي' : 'Running Balance'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 bg-[#08080a]/20">
                            {filteredLedger.map((item, idx) => {
                              const isCredit = item.type === 'Credit';
                              return (
                                <tr key={item.id || idx} className="hover:bg-slate-950/40 transition-colors">
                                  <td className="p-3 font-mono font-bold text-[10px] text-slate-400 text-start" dir="ltr">
                                    {new Date(item.date).toLocaleString(isAr ? 'ar-YE' : 'en-US', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="p-3 text-start">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${item.module === 'order' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/20' :
                                        item.module === 'expense' ? 'bg-amber-955/20 text-amber-500 border border-amber-950/20' :
                                          'bg-purple-950/30 text-purple-400 border border-purple-950/20'
                                      }`}>
                                      {item.module === 'order' ? (isAr ? 'تحصيل شحنة' : 'Shipment COD') :
                                        item.module === 'expense' ? (isAr ? 'عهد وسلف وأجور' : 'Disbursed') :
                                          (isAr ? 'تسوية مركزية' : 'Journal Entry')}
                                    </span>
                                  </td>
                                  <td className="p-3 font-bold text-white text-start">
                                    <div className="text-xs">{item.title}</div>
                                    <div className="text-[9px] text-slate-550 font-normal mt-0.5">{item.description}</div>
                                  </td>
                                  <td className="p-3 font-mono text-[10px] text-[#d4af37] font-black text-start">{item.ref}</td>
                                  <td className="p-3 text-start">
                                    {isCredit ? (
                                      <span className="text-[9px] bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 px-2.5 py-0.5 rounded-xl font-black">{isAr ? 'إيداع / دائن (+)' : 'Credit (+)'}</span>
                                    ) : (
                                      <span className="text-[9px] bg-rose-955/20 text-rose-500 border border-rose-950/30 px-2.5 py-0.5 rounded-xl font-black">{isAr ? 'خصم / مدين (-)' : 'Debit (-)'}</span>
                                    )}
                                  </td>
                                  <td className={`p-3 font-mono font-bold text-xs ${isCredit ? 'text-emerald-450' : 'text-rose-450'}`}>
                                    <span>{isCredit ? '+' : '-'}{(item.amountOriginal || item.amount || 0).toLocaleString()} {item.currencyOriginal || 'YER'}</span>
                                  </td>
                                  <td className={`p-3 font-mono font-black text-xs ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    <span>{isCredit ? '+' : '-'}{(item.amountFCurrency || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {selectedCourier.financialCurrency || 'YER'}</span>
                                    {selectedCourier.financialCurrency === 'SAR' && (
                                      <span className="block text-[9px] text-slate-500 font-normal mt-0.5" dir="ltr">
                                        ≈ {isCredit ? '+' : '-'}{(item.amount || 0).toLocaleString()} YER
                                      </span>
                                    )}
                                  </td>
                                  <td className={`p-3 text-left font-mono font-black text-xs ${item.runningAccountBal >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                                    <span>{item.runningAccountBal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {selectedCourier.financialCurrency || 'YER'}</span>
                                    {selectedCourier.financialCurrency === 'SAR' && (
                                      <span className="block text-[9px] text-slate-550 font-normal mt-0.5" dir="ltr">
                                        ≈ {Math.round(item.runningAccountBal * exchangeRateSAR).toLocaleString()} YER
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            {filteredLedger.length === 0 && (
                              <tr>
                                <td colSpan={8} className="p-16 text-center text-slate-650 italic font-bold">
                                  {isAr ? '[ لم يتم تقييد حركات مالية مسجلة لهذا المندوب ]' : '[ NO FINANCIAL TRANSACTIONS DISCOVERED ]'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal action tray */}
            <div className="p-4 bg-black/40 border-t border-slate-850 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 select-none">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] font-mono text-slate-500 uppercase">ACTIVE TRACEWAY CONNECTED</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => printContent(isAr ? `كشف حساب المندوب: ${selectedCourier.fullName}` : 'Courier Liability Statement', 'courier-ledger-content', isAr)}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-md active:scale-95"
                >
                  <Printer className="w-4 h-4" /> {isAr ? 'طباعة تقرير المصادقة اليدوية' : 'Print Statement & Incentives'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Courier Modal (Gold Dark UI Frame) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddCourier} className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden font-sans">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <h3 className="font-black text-white text-xs uppercase tracking-widest flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'تسجيل وتقييد مندوب لوجستي' : 'Engage New Logistics Courier'}
              </h3>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="text-slate-550 hover:text-white p-1 bg-slate-900 border border-slate-800 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-start">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الاسم الثلاثي للمندوب' : 'Full Name'}</label>
                <input required type="text" value={addFormData.fullName} onChange={(e) => setAddFormData({ ...addFormData, fullName: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'رقم الهوية الجوال' : 'Cellphone'}</label>
                  <input required placeholder="+967..." type="tel" value={addFormData.phone} onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start" dir="ltr" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'البريد الإلكتروني للولوج' : 'Login Mail ID'}</label>
                  <input type="email" placeholder="courier@swiftship.net" value={addFormData.email} onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start" dir="ltr" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'مستقر السكن الحالي' : 'Courier Base Address'}</label>
                <input placeholder="صنعاء - شارع الخمسين" type="text" value={addFormData.address} onChange={(e) => setAddFormData({ ...addFormData, address: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'مسارات التتبع والموقع الفعلي (GPS)' : 'Live GPS Coords/Maps Link'}</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#d4af37] w-4 h-4" />
                  <input type="text" value={addFormData.gpsLocation} onChange={(e) => setAddFormData({ ...addFormData, gpsLocation: e.target.value })} placeholder="https://maps.google.com/?q=..." className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 pl-10 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'العمولة من عمليات التوزيع (%)' : 'Standard Commission Rate (%)'}</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-550 w-4 h-4" />
                    <input type="number" min="0" max="100" step="0.1" value={addFormData.commissionRate} onChange={(e) => setAddFormData({ ...addFormData, commissionRate: parseFloat(e.target.value) || 0 })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 pl-10 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'نوع المندوب' : 'Courier Type'}</label>
                  <select
                    value={addFormData.courierType}
                    onChange={(e) => setAddFormData({ ...addFormData, courierType: e.target.value as any })}
                    className="w-full bg-black/50 border border-[#d4af37]/25 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  >
                    <option value="local" className="bg-[#121215] text-white">{isAr ? 'مندوب محلي (اليمن)' : 'Local / Delivery'}</option>
                    <option value="sourcing" className="bg-[#121215] text-[#d4af37]">{isAr ? 'مندوب تجميع (سعودي)' : 'Sourcing / Collection'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'تقرير وملاحظات التسجيل' : 'Induction confidential remarks'}</label>
                <textarea value={addFormData.notes} onChange={(e) => setAddFormData({ ...addFormData, notes: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none h-20 text-start"></textarea>
              </div>
            </div>

            <div className="p-4 border-t border-slate-850 bg-[#07070a]/40 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-5 py-2.5 text-slate-400 font-bold hover:bg-slate-850 rounded-xl transition-colors text-xs">{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button type="submit" disabled={addLoading} className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] disabled:opacity-40 text-black font-black rounded-xl shadow-md transition-all text-xs active:scale-95">
                {addLoading ? (isAr ? 'جاري التسجيل والربط...' : 'Creating login...') : (isAr ? 'حفظ وإصدار كود المندوب' : 'Register Courier')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Courier Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUpdateCourier} className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/25 rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden font-sans">
            <div className="p-4 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-widest">{isAr ? 'تعديل بيانات وإثباتات مندوب' : 'Configure Courier Parameters'}</h3>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="text-slate-550 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-start">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الاسم الكامل' : 'Full Name'}</label>
                <input required type="text" value={editFormData.fullName} onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'رقم الهاتف' : 'Phone'}</label>
                  <input type="tel" value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start" dir="ltr" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'البريد الإلكتروني' : 'Mail ID'}</label>
                  <input type="email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start" dir="ltr" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'سكني' : 'Settlement Residence'}</label>
                <input type="text" value={editFormData.address} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'الموقع جيوغرافيك (GPS)' : 'Live Coordinates GPS'}</label>
                <input type="text" value={editFormData.gpsLocation} onChange={(e) => setEditFormData({ ...editFormData, gpsLocation: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start font-mono" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'نسبة العمولة التشغيلية (%)' : 'Operational Commission Rate (%)'}</label>
                  <input type="number" min="0" max="100" step="0.1" value={editFormData.commissionRate} onChange={(e) => setEditFormData({ ...editFormData, commissionRate: parseFloat(e.target.value) || 0 })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none font-mono text-start" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'نوع المندوب' : 'Courier Type'}</label>
                  <select
                    value={editFormData.courierType || 'local'}
                    onChange={(e) => setEditFormData({ ...editFormData, courierType: e.target.value as any })}
                    className="w-full bg-black/50 border border-[#d4af37]/25 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none text-start"
                  >
                    <option value="local" className="bg-[#121215] text-white">{isAr ? 'مندوب محلي (اليمن)' : 'Local / Delivery'}</option>
                    <option value="sourcing" className="bg-[#121215] text-[#d4af37]">{isAr ? 'مندوب تجميع (سعودي)' : 'Sourcing / Collection'}</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer pt-3">
                  <input type="checkbox" checked={editFormData.disabled} onChange={(e) => setEditFormData({ ...editFormData, disabled: e.target.checked })} className="w-4 h-4 text-rose-600 focus:ring-rose-500 bg-black/50 border-slate-850 rounded" />
                  <span className="text-[11px] font-black text-rose-500 uppercase tracking-tighter">{isAr ? 'تجميد حساب المندوب مؤقتاً' : 'Freeze courier account'}</span>
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">{isAr ? 'ملاحظات وبنود التحديث' : 'Administrative Confidential Remarks'}</label>
                <textarea value={editFormData.notes} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} className="w-full bg-black/50 border border-slate-850 rounded-xl p-3 text-xs font-bold text-white focus:border-[#d4af37]/60 outline-none h-20 text-start"></textarea>
              </div>
            </div>

            <div className="p-4 border-t border-slate-850 bg-[#07070a]/40 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 text-slate-400 font-bold hover:bg-slate-855 rounded-xl transition-colors text-xs">{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button type="submit" disabled={editLoading} className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] disabled:opacity-40 text-black font-black rounded-xl shadow-md transition-all text-xs active:scale-95">
                {editLoading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ وحماية التعديلات' : 'Save Changes')}
              </button>
            </div>
          </form>
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
