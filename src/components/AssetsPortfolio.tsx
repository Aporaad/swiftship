import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck, Search, Wrench, X, PlusCircle, Trash2, Calendar, DollarSign,
  Activity, CheckCircle, AlertTriangle, ShieldCheck, RefreshCw, User, ClipboardList, Package, Printer
} from 'lucide-react';
import { addAssDoc, db } from '../lib/supabase-firebase-adapter';
import { collection, addDoc, doc, deleteDoc, updateDoc, onSnapshot } from '../lib/supabase-firebase-adapter';
import { notificationService } from '../services/notificationService';
import { jsPDF } from 'jspdf';
import { formatDate } from '../lib/dateUtils';
import { useExchangeRates } from '../hooks/useExchangeRates';

interface AssetsPortfolioProps {
  isAr: boolean;
  settings: any;
  couriers: any[];
}

interface MaintenanceLog {
  logId: string;
  cost: number;
  currency: string;
  type: 'Preventive' | 'Repair' | 'Overhaul';
  notes: string;
  doneBy: string;
  date: string;
  createdAt: number;
}

interface Asset {
  id?: string;
  assetCode: string;
  nameAr: string;
  nameEn: string;
  category: 'Vehicles' | 'Inspection' | 'Office' | 'Computers' | 'Other';
  type: 'Fixed' | 'NonFixed';
  cost: number;
  currency: string;
  purchaseDate: string;
  assignedCourierId: string | null;
  assignedCourierName: string | null;
  status: 'Active' | 'UnderMaintenance' | 'Retired';
  notes: string;
  maintenanceLogs: MaintenanceLog[];
  createdAt: number;
}

export default function AssetsPortfolio({ isAr, settings, couriers }: AssetsPortfolioProps) {
  const { activeCurrencies } = useExchangeRates();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);

  // Filtering & searching states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [assetRegisterLoading, setAssetRegisterLoading] = useState(false);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);

  // New Maintenance overlay
  const [selectedAssetForMaint, setSelectedAssetForMaint] = useState<Asset | null>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  // Forms
  const [newAsset, setNewAsset] = useState({
    assetCode: '',
    nameAr: '',
    nameEn: '',
    category: 'Vehicles' as any,
    type: 'Fixed' as any,
    cost: '',
    currency: 'YER',
    purchaseDate: formatDate(),
    assignedCourierId: '',
    status: 'Active' as any,
    notes: ''
  });

  const [newMaint, setNewMaint] = useState({
    cost: '',
    currency: 'YER',
    type: 'Preventive' as any,
    notes: '',
    doneBy: '',
    date: formatDate(),
  });

  // Rates Converter helper
  const exchangeRates = useMemo(() => {
    return {
      USD: settings?.usdRate || 1650,
      SAR: settings?.sarRate || 440,
      YER: 1
    };
  }, [settings]);

  const convertToYER = (amount: number, currency: string) => {
    const rate = exchangeRates[currency as 'YER' | 'USD' | 'SAR'] || 1;
    if (currency === 'USD') return amount * exchangeRates.USD;
    if (currency === 'SAR') return amount * exchangeRates.SAR;
    return amount;
  };

  // Sync assets from DB
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'assets'), (snap) => {
      setAssets(snap.docs.map((doc: { id: any; assetCode: any; data: () => Asset; }) => ({ id: doc.id, ...doc.data() } as Asset)));
      setAssetsLoading(false);
    }, (error) => {
      console.error("Error fetching assets:", error);
    });
    return () => unsub();
  }, []);

  // Filter lists
  const filteredAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return assets.filter(a => {
      const matchQuery = !query ||
        a.assetCode.toLowerCase().includes(query) ||
        a.nameAr.toLowerCase().includes(query) ||
        a.nameEn.toLowerCase().includes(query) ||
        (a.assignedCourierName && a.assignedCourierName.toLowerCase().includes(query));

      const matchCategory = categoryFilter === 'all' || a.category === categoryFilter;
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;

      return matchQuery && matchCategory && matchStatus;
    });
  }, [assets, searchQuery, categoryFilter, statusFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalFixedValue_YER = 0;
    let totalMaintSpent_YER = 0;
    let activeVehiclesCount = 0;
    let activeScannersCount = 0;
    let underMaintCount = 0;

    assets.forEach(a => {
      const valueY = convertToYER(a.cost, a.currency);
      if (a.type === 'Fixed' && a.status === 'Active') {
        totalFixedValue_YER += valueY;
      }

      if (a.category === 'Vehicles' && a.status === 'Active') {
        activeVehiclesCount++;
      } else if (a.category === 'Inspection' && a.status === 'Active') {
        activeScannersCount++;
      }

      if (a.status === 'UnderMaintenance') {
        underMaintCount++;
      }

      // Sum all logs cost
      if (a.maintenanceLogs && Array.isArray(a.maintenanceLogs)) {
        a.maintenanceLogs.forEach(log => {
          totalMaintSpent_YER += convertToYER(log.cost, log.currency);
        });
      }
    });

    return {
      totalFixedValue_YER,
      totalMaintSpent_YER,
      activeVehiclesCount,
      activeScannersCount,
      underMaintCount
    };
  }, [assets, exchangeRates]);

  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.assetCode || !newAsset.nameAr || !newAsset.nameEn || !newAsset.cost) {
      notificationService.notify({
        title: isAr ? 'تفاصيل غير كافية' : 'Validation Error',
        message: isAr ? 'يرجى مراجعة إدخال الرمز، الأسماء، وتكلفة الشراء.' : 'Please verify code, description and cost.',
        type: 'error'
      });
      return;
    }

    setAssetRegisterLoading(true);
    try {
      const courierObj = couriers.find(c => c.id === newAsset.assignedCourierId);
      const newAssetId = 'asset' + newAsset.assetCode;
      await addAssDoc(newAssetId, newAsset.assetCode, collection(db, 'assets'), {
        assetCode: newAsset.assetCode,
        nameAr: newAsset.nameAr,
        nameEn: newAsset.nameEn,
        category: newAsset.category,
        type: newAsset.type,
        cost: parseFloat(newAsset.cost),
        currency: newAsset.currency,
        purchaseDate: newAsset.purchaseDate,
        assignedCourierId: newAsset.assignedCourierId || null,
        assignedCourierName: courierObj ? courierObj.fullName : null,
        status: newAsset.status,
        notes: newAsset.notes,
        maintenanceLogs: [],
        createdAt: Date.now()
      });

      notificationService.notify({
        title: isAr ? 'تم قيد الأصل في الدفاتر' : 'Asset Registered',
        message: isAr ? `تم حفظ الأصل [${newAsset.nameAr}] كأصل للشركة.` : `Asset [${newAsset.nameEn}] registered successfully.`,
        type: 'success'
      });

      setIsAddOpen(false);
      setNewAsset({
        assetCode: '',
        nameAr: '',
        nameEn: '',
        category: 'Vehicles',
        type: 'Fixed',
        cost: '',
        currency: 'YER',
        purchaseDate: new Date().toISOString().slice(0, 10),
        assignedCourierId: '',
        status: 'Active',
        notes: ''
      });
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: 'Firestore Error',
        message: err.message,
        type: 'error'
      });
    } finally {
      setAssetRegisterLoading(false);
    }
  };

  const handleDeleteAsset = async (id: string, name: string) => {
    if (!window.confirm(isAr
      ? `هل أنت متأكد من حذف وإخراج الأصل (${name}) من عهدة الشركة؟`
      : `Are you sure you want to retire and delete physical asset (${name})?`
    )) return;

    try {
      await deleteDoc(doc(db, 'assets', id));
      notificationService.notify({
        title: isAr ? 'تم الحذف' : 'Success',
        message: isAr ? 'تم إزالة الأصل وسجلات صيانته نهائياً.' : 'Physical asset records removed.',
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleAddMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetForMaint || !newMaint.cost) return;

    setMaintenanceLoading(true);
    try {
      const logId = `MNT-${Math.floor(1000 + Math.random() * 9000)}`;
      const logObj: MaintenanceLog = {
        logId,
        cost: parseFloat(newMaint.cost),
        currency: newMaint.currency,
        type: newMaint.type,
        notes: newMaint.notes,
        doneBy: newMaint.doneBy || (isAr ? 'ورشة محلية ممتازة' : 'Local Premium Workshop'),
        date: newMaint.date,
        createdAt: Date.now()
      };

      const updatedLogs = [...(selectedAssetForMaint.maintenanceLogs || []), logObj];
      await updateDoc(doc(db, 'assets', selectedAssetForMaint.id!), {
        maintenanceLogs: updatedLogs
      });

      notificationService.notify({
        title: isAr ? 'تم إضافة كشف الصيانة للأصل' : 'Maintenance Logged',
        message: isAr ? 'تم تقييد الصيانة مضافاً لتكلفة صيانة الأصل.' : 'Diagnostics logged successfully.',
        type: 'success'
      });

      setSelectedAssetForMaint(null);
      setNewMaint({
        cost: '',
        currency: 'YER',
        type: 'Preventive',
        notes: '',
        doneBy: '',
        date: new Date().toISOString().slice(0, 10),
      });
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: 'Error logging maintenance',
        message: err.message,
        type: 'error'
      });
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const transliterateArabic = (text: string) => {
    if (!text) return '';
    const mapping: { [key: string]: string } = {
      'أ': 'A', 'ا': 'A', 'ب': 'B', 'ت': 'T', 'ث': 'Th', 'ج': 'J', 'ح': 'H', 'خ': 'Kh',
      'د': 'D', 'ذ': 'Dh', 'ر': 'R', 'ز': 'Z', 'س': 'S', 'ش': 'Sh', 'ص': 'S', 'ض': 'D',
      'ط': 'T', 'ظ': 'Dh', 'ع': 'A', 'غ': 'Gh', 'ف': 'F', 'ق': 'Q', 'ك': 'K', 'ل': 'L',
      'م': 'M', 'ن': 'N', 'ه': 'H', 'و': 'W', 'ي': 'Y', 'ى': 'Y', 'ة': 'h', 'ئ': 'Y',
      'ؤ': 'W', ' ': ' ', 'ﻻ': 'La', 'لأ': 'La', '٠': '0', '١': '1', '٢': '2', '٣': '3',
      '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
    };
    return text.split('').map(char => mapping[char] || char).join('');
  };

  const handlePrintAssetReport = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();

      const fixedAssets = assets.filter(a => a.type === 'Fixed');

      let totalValueYER = 0;
      let totalMaintSpentYER = 0;
      let activeCount = 0;
      let underMaintCount = 0;
      let retiredCount = 0;

      fixedAssets.forEach(a => {
        const valY = convertToYER(a.cost, a.currency);
        totalValueYER += valY;

        if (a.status === 'Active') activeCount++;
        else if (a.status === 'UnderMaintenance') underMaintCount++;
        else if (a.status === 'Retired') retiredCount++;

        if (a.maintenanceLogs && Array.isArray(a.maintenanceLogs)) {
          a.maintenanceLogs.forEach(log => {
            totalMaintSpentYER += convertToYER(log.cost, log.currency);
          });
        }
      });

      doc.setFillColor(15, 15, 18);
      doc.rect(0, 0, width, 38, 'F');

      doc.setFillColor(212, 175, 55);
      doc.rect(0, 38, width, 1.5, 'F');

      doc.setTextColor(212, 175, 55);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(transliterateArabic(settings?.companyName || 'AL-XPRESS LOGISTICS'), 15, 16);

      doc.setTextColor(230, 230, 235);
      doc.setFontSize(8.5);
      doc.setFont('Helvetica', 'normal');
      doc.text('CORPORATE FIXED ASSETS AUDIT & EXECUTIVE MAINTENANCE REPORT', 15, 23);

      doc.setTextColor(140, 140, 145);
      doc.setFontSize(7);
      const todayStr = new Date().toLocaleString();
      doc.text(`Print Date: ${todayStr} | Document State: Official Audit Ledger | Coverage: Live Fixed Assets`, 15, 29);

      doc.setFillColor(212, 175, 55);
      doc.roundedRect(width - 45, 11, 30, 16, 2, 2, 'F');
      doc.setTextColor(15, 15, 18);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('TOTAL AUDITED', width - 30, 17, { align: 'center' });
      doc.setFontSize(11);
      doc.text(`${fixedAssets.length}`, width - 30, 23, { align: 'center' });

      let y = 46;
      doc.setFillColor(245, 245, 247);
      doc.roundedRect(12, y, width - 24, 25, 3, 3, 'F');

      doc.setFillColor(212, 175, 55);
      doc.rect(12, y, 2.5, 25, 'F');

      doc.setFontSize(7.5);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(110, 110, 115);
      doc.text('TOTAL FIXED BOOK VALUE (YER)', 20, y + 7);
      doc.text('REPAIR & OVERHAUL OVERHEADS (YER)', 80, y + 7);
      doc.text('OPERATIONAL STATUS SUMMARY', 140, y + 7);

      doc.setFontSize(10.5);
      doc.setTextColor(15, 15, 18);
      doc.text(`${totalValueYER.toLocaleString()} YER`, 20, y + 15);
      doc.setTextColor(180, 40, 40);
      doc.text(`${totalMaintSpentYER.toLocaleString()} YER`, 80, y + 15);

      doc.setFontSize(8.5);
      doc.setTextColor(15, 15, 18);
      doc.setFont('Helvetica', 'bold');
      doc.text(`${activeCount} Active / ${underMaintCount} Maintenance`, 140, y + 15);

      y += 33;

      doc.setTextColor(15, 15, 18);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('I. PORTFOLIO AUDITING LEDGER', 12, y);
      y += 5.5;

      doc.setFillColor(24, 24, 27);
      doc.rect(12, y, width - 24, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont('Helvetica', 'bold');
      doc.text('CODE', 15, y + 5.5);
      doc.text('DESCRIPTION / MODEL (EN/AR)', 38, y + 5.5);
      doc.text('CATEGORY', 94, y + 5.5);
      doc.text('ACQ. DATE', 116, y + 5.5);
      doc.text('RESPONSIBLE ASSIGNEE', 139, y + 5.5);
      doc.text('VALUE', 174, y + 5.5);
      doc.text('STATUS', 190, y + 5.5);

      y += 8;

      fixedAssets.forEach((asset, idx) => {
        if (y > height - 25) {
          doc.addPage();

          doc.setFillColor(15, 15, 18);
          doc.rect(0, 0, width, 18, 'F');
          doc.setFillColor(212, 175, 55);
          doc.rect(0, 18, width, 1.2, 'F');

          doc.setTextColor(212, 175, 55);
          doc.setFontSize(9);
          doc.setFont('Helvetica', 'bold');
          doc.text('AL-XPRESS FIXED ASSETS (CONTINUED)', 15, 11);

          doc.setFillColor(24, 24, 27);
          doc.rect(12, 23, width - 24, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7.5);
          doc.text('CODE', 15, 28.5);
          doc.text('DESCRIPTION / MODEL (EN/AR)', 38, 28.5);
          doc.text('CATEGORY', 94, 28.5);
          doc.text('ACQ. DATE', 116, 28.5);
          doc.text('RESPONSIBLE ASSIGNEE', 139, 28.5);
          doc.text('VALUE', 174, 28.5);
          doc.text('STATUS', 190, 28.5);

          y = 31;
        }

        if (idx % 2 === 0) {
          doc.setFillColor(248, 248, 250);
          doc.rect(12, y, width - 24, 9, 'F');
        }

        doc.setTextColor(30, 30, 35);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);

        doc.setFont('Helvetica', 'bold');
        doc.text(asset.assetCode || 'AST-N/A', 15, y + 6);
        doc.setFont('Helvetica', 'normal');

        const nameEnSafe = asset.nameEn || '';
        const nameArSafe = asset.nameAr ? `(${transliterateArabic(asset.nameAr)})` : '';
        const combinedDesc = `${nameEnSafe} ${nameArSafe}`.substring(0, 38);
        doc.text(combinedDesc, 38, y + 6);

        const categoryLabels: { [key: string]: string } = {
          Vehicles: 'Logistics Fleet',
          Inspection: 'Inspection Gear',
          Office: 'Office Equipment',
          Computers: 'Computers/IT',
          Other: 'Other Equipment'
        };
        doc.text(categoryLabels[asset.category] || asset.category, 94, y + 6);

        doc.text(asset.purchaseDate || 'N/A', 116, y + 6);

        const assigneeText = asset.assignedCourierName ? transliterateArabic(asset.assignedCourierName) : 'Unassigned';
        doc.text(assigneeText.substring(0, 18), 139, y + 6);

        const valText = `${asset.cost.toLocaleString()} ${asset.currency}`;
        doc.text(valText, 174, y + 6);

        const stateStr = asset.status || 'Active';
        if (stateStr === 'Active') {
          doc.setTextColor(16, 120, 80);
          doc.setFont('Helvetica', 'bold');
          doc.text('ACTIVE', 190, y + 6);
        } else if (stateStr === 'UnderMaintenance') {
          doc.setTextColor(180, 100, 20);
          doc.setFont('Helvetica', 'bold');
          doc.text('MAINT.', 190, y + 6);
        } else {
          doc.setTextColor(110, 110, 115);
          doc.setFont('Helvetica', 'normal');
          doc.text('RETIRED', 190, y + 6);
        }

        y += 9;
      });

      if (y > height - 40) {
        doc.addPage();
        y = 20;
      }

      y += 5;
      doc.setDrawColor(220, 220, 225);
      doc.setLineWidth(0.25);
      doc.line(12, y, width - 12, y);
      y += 6;

      doc.setTextColor(120, 120, 125);
      doc.setFontSize(7.5);
      doc.setFont('Helvetica', 'italic');
      doc.text('This property inventory matches system registers. Undergoing maintenance diagnostics are backed by audited physical repair bills.', 12, y);

      y += 12;
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(50, 50, 55);
      doc.text('Prepared By: Assets Comptroller', 15, y);
      doc.text('Approved By: Executive Board', width - 70, y);

      doc.setDrawColor(180, 180, 185);
      doc.line(15, y + 10, 65, y + 10);
      doc.line(width - 70, y + 10, width - 20, y + 10);

      doc.save('Corporate_Fixed_Assets_Portfolio_Report.pdf');

      notificationService.notify({
        title: isAr ? 'تم تصدير تقرير الأصول بنجاح' : 'PDF Asset Report Exported',
        message: isAr ? 'تم تحميل تقرير الأصول الثابتة بصيغة PDF لتسهيل المراجعة الإدارية.' : 'Management Assets Portfolio PDF generated and downloaded successfully.',
        type: 'success'
      });

    } catch (error: any) {
      console.error('PDF Generation Failed:', error);
      notificationService.notify({
        title: 'PDF Generation Error',
        message: error.message || 'An unexpected error occurred during PDF compiling.',
        type: 'error'
      });
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Vehicles': return <Truck className="w-5 h-5 text-amber-500 animate-pulse" />;
      case 'Inspection': return <Search className="w-5 h-5 text-indigo-400 animate-pulse" />;
      case 'Office': return <ClipboardList className="w-5 h-5 text-emerald-400" />;
      case 'Computers': return <Activity className="w-5 h-5 text-[#d4af37]" />;
      default: return <Package className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 pt-2 animate-fade-in text-start">

      {/* Bento Grid Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* Metric 1 */}
        <div className="bg-black/30 border border-slate-850 p-5 rounded-2xl">
          <span className="block text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">{isAr ? 'إجمالي قيمة أصول الشركة الثابتة' : 'Fixed Book Assets Assets'}</span>
          <span className="text-xl font-mono font-black text-white block mt-1">
            {metrics.totalFixedValue_YER.toLocaleString()} YER
          </span>
          <span className="text-[8.5px] text-zinc-550 font-semibold mt-1 block">
            {isAr ? 'تتم التغذية المباشرة من أسطول المركبات والرافعات الفعالة.' : 'Synced directly from live vehicle and scanner portfolios.'}
          </span>
        </div>

        {/* Metric 2 */}
        <div className="bg-black/30 border border-slate-850 p-5 rounded-2xl">
          <span className="block text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">{isAr ? 'مدفوعات صيانة الأصول التراكمية' : 'Gross Maintenance Overheads'}</span>
          <span className="text-xl font-mono font-black text-amber-500 block mt-1">
            {metrics.totalMaintSpent_YER.toLocaleString()} YER
          </span>
          <span className="text-[8.5px] text-zinc-550 font-semibold mt-1 block">
            {isAr ? 'إجمالي نفقات الصيانة الدورية للأجهزة والمركبات.' : 'Cumulative repair expenses charged to operations.'}
          </span>
        </div>

        {/* Metric 3 */}
        <div className="bg-black/30 border border-slate-850 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="block text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">{isAr ? 'الناقلات والمركبات الحية' : 'Live Logistics Fleet'}</span>
            <span className="text-xl font-mono font-black text-white block mt-1">
              {metrics.activeVehiclesCount} {isAr ? 'مركبات' : 'Trucks'}
            </span>
          </div>
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-black/30 border border-slate-850 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="block text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">{isAr ? 'أجهزة وحافلات قيد الصيانة' : 'Undergoing Maintenance'}</span>
            <span className="text-xl font-mono font-black text-rose-400 block mt-1">
              {metrics.underMaintCount} {isAr ? 'أصول' : 'Nodes'}
            </span>
          </div>
          <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
            <Wrench className="w-5 h-5 animate-pulse" />
          </div>
        </div>

      </div>

      {/* Control panel & filters */}
      <div className="bg-[#121215] border border-slate-850 p-5 rounded-3xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider mb-1">
              {isAr ? 'إدارة وتخصيص أصول وعهد الشركة العينية واللوجستية' : 'Fixed corporate asset & custody ledger'}
            </h3>
            <p className="text-[10px] text-slate-550 font-medium">
              {isAr ? 'راقب أسطول سيارات النقل، أجهزة التفتيش الأمني والتقني، عين مناديب التشغيل وراقب سجلات الصيانة والتكالف.' : 'Assign couriers, write maintenance logs, and audit physical assets properties.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder={isAr ? "ابحث بالأصل أو المندوب..." : "Query by custom tag, model..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-black/45 border border-slate-850 text-white placeholder-slate-550 text-xs rounded-xl pl-4 pr-4 py-2 w-full md:w-56 outline-none focus:border-[#d4af37]"
              />
            </div>

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="bg-black/45 border border-slate-850 text-white text-xs rounded-xl px-2 py-2 cursor-pointer outline-none focus:border-[#d4af37]"
            >
              <option value="all">{isAr ? 'كل الفئات' : 'All Classes'}</option>
              <option value="Vehicles">{isAr ? 'وسائل نقل وسيارات' : 'Vehicles'}</option>
              <option value="Inspection">{isAr ? 'أجهزة كشف وفحص' : 'Scanners/Inspection'}</option>
              <option value="Office">{isAr ? 'مستلزمات مكتبية' : 'Office Equip'}</option>
              <option value="Computers">{isAr ? 'أجهزة الكترونية' : 'Computers'}</option>
              <option value="Other">{isAr ? 'أخرى' : 'Other'}</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-black/45 border border-slate-850 text-white text-xs rounded-xl px-2 py-2 cursor-pointer outline-none focus:border-[#d4af37]"
            >
              <option value="all">{isAr ? 'كل الحالات' : 'All States'}</option>
              <option value="Active">{isAr ? 'نشط وتشغيلي' : 'Active'}</option>
              <option value="UnderMaintenance">{isAr ? 'قيد الصيانة' : 'Under Maintenance'}</option>
              <option value="Retired">{isAr ? 'خارج الخدمة' : 'Retired/Retired'}</option>
            </select>

            {/* Print Asset Report Button */}
            <button
              onClick={handlePrintAssetReport}
              className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 text-[#d4af37] px-4 py-2 rounded-xl text-xs font-black transition-all hover:bg-slate-850 cursor-pointer pointer-events-auto"
            >
              <Printer className="w-4 h-4" />
              {isAr ? 'طباعة تقرير الأصول' : 'Print Asset Report'}
            </button>

            {/* Add button trigger */}
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1.5 bg-[#d4af37] hover:bg-[#bfa032] active:bg-[#aa8e2b] text-black px-4 py-2 rounded-xl text-xs font-black transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              {isAr ? 'تسجيل أصل جديد' : 'Add Physical Asset'}
            </button>
          </div>
        </div>

        {/* Grid layout containing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map((asset) => {
            const isExpanded = expandedAssetId === asset.id;

            // Calc total maint cost logged
            const totalMaintCost = (asset.maintenanceLogs || []).reduce((sum, log) => {
              return sum + convertToYER(log.cost, log.currency);
            }, 0);

            return (
              <div
                key={asset.id}
                className="bg-[#121215] border border-slate-850 rounded-2xl overflow-hidden hover:border-[#d4af37]/35 transition-all text-start flex flex-col justify-between"
              >

                {/* Header card header */}
                <div className="p-4 border-b border-slate-850 flex items-center justify-between bg-black/10">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl">
                      {getCategoryIcon(asset.category)}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">{isAr ? asset.nameAr : asset.nameEn}</h4>
                      <span className="text-[8.5px] font-mono text-[#d4af37] font-black px-1.5 py-0.5 bg-black/40 rounded border border-slate-850 mt-1 inline-block">
                        {asset.assetCode}
                      </span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg text-center ${asset.status === 'Active' ? 'bg-emerald-950/45 text-emerald-400 border border-emerald-900/30' :
                    asset.status === 'UnderMaintenance' ? 'bg-amber-950/45 text-amber-500 border border-amber-900/30 animate-pulse' :
                      'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}>
                    {asset.status === 'Active' ? (isAr ? 'نشط تفعيل' : 'Active') :
                      asset.status === 'UnderMaintenance' ? (isAr ? 'قيد صيانة' : 'Maintenance') :
                        (isAr ? 'خارج الخدمة' : 'Retired')}
                  </span>
                </div>

                {/* Info block */}
                <div className="p-4 space-y-3 text-xs flex-1">

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-slate-550 block font-bold">{isAr ? 'تكلفة الاقتناء' : 'Acquisition Cost'}</span>
                      <span className="font-mono font-black text-white">
                        {asset.cost.toLocaleString()} {asset.currency}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-550 block font-bold">{isAr ? 'التكلفة بالريال اليمني' : 'Acq YER equivalent'}</span>
                      <span className="font-mono font-black text-slate-400">
                        {convertToYER(asset.cost, asset.currency).toLocaleString()} YER
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-slate-550 block font-bold">{isAr ? 'تاريخ الشراء' : 'Purchase Date'}</span>
                      <span className="font-mono font-bold text-slate-300">
                        {asset.purchaseDate || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-550 block font-bold">{isAr ? 'نوع التصنيف الاقتصادي' : 'Capital Allocation'}</span>
                      <span className="text-[#d4af37] font-black block">
                        {asset.type === 'Fixed' ? (isAr ? 'أصل مادي ثابت' : 'Fixed Asset') : (isAr ? 'أصل متداول / مرن' : 'Non-Fixed')}
                      </span>
                    </div>
                  </div>

                  {/* Responsible Courier - تحديد المندوب المسؤول عن كل أصل */}
                  <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-850 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <User className="w-4 h-4 text-[#d4af37]" />
                      <div>
                        <span className="text-slate-500 block font-bold text-[8px] leading-tight uppercase">{isAr ? 'المندوب والعهدة المسؤول' : 'Responsible Staff / Courier'}</span>
                        <span className="font-black text-slate-200">
                          {asset.assignedCourierName || (isAr ? 'غير مخصص لمندوب' : 'Unassigned Account')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total Maintenance calculations */}
                  <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-850">
                    <span className="text-slate-500 font-bold">{isAr ? 'نفقات صيانة مسجلة:' : 'Direct repairs logged:'}</span>
                    <span className="font-mono font-black text-[#d4af37]">
                      {totalMaintCost.toLocaleString()} YER
                    </span>
                  </div>

                  {asset.notes && (
                    <p className="text-[10px] text-slate-550 bg-black/10 p-2 rounded-lg italic">
                      "{asset.notes}"
                    </p>
                  )}

                </div>

                {/* Footer action logs lists */}
                <div className="p-4 border-t border-slate-850 bg-black/5 space-y-2">
                  <div className="flex gap-2.5">
                    {/* Expand Maintenance Details Toggle */}
                    <button
                      onClick={() => setExpandedAssetId(isExpanded ? null : asset.id!)}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-850 text-slate-300 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1"
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-[#d4af37]" />
                      {isExpanded ? (isAr ? 'إخفاء سجل الصيانة' : 'Hide diagnostics') : (isAr ? `سجل الصيانة (${asset.maintenanceLogs?.length || 0})` : `Maintenance Logs (${asset.maintenanceLogs?.length || 0})`)}
                    </button>

                    {/* New log trigger */}
                    <button
                      onClick={() => setSelectedAssetForMaint(asset)}
                      className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/35 text-amber-500 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      {isAr ? 'تسجيل صيانة' : 'Log Maintenance'}
                    </button>

                    {/* Delete action */}
                    <button
                      onClick={() => handleDeleteAsset(asset.id!, isAr ? asset.nameAr : asset.nameEn)}
                      className="p-1.5 rounded-xl bg-rose-950/25 border border-rose-900/30 hover:bg-rose-950/60 text-rose-400 transition-all cursor-pointer pointer-events-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Collapsible Maintenance record render */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-slate-850 text-[10px] space-y-2 max-h-44 overflow-y-auto">
                      <span className="block text-[8px] font-black uppercase tracking-wider text-slate-500 mb-1">{isAr ? 'الحركات التفصيلية لصيانة وتوضيب الأصل' : 'Acquisition Overhaul History'}</span>
                      {(asset.maintenanceLogs || []).map((log, index) => (
                        <div key={log.logId || index} className="p-2 rounded bg-black/20 border border-slate-850 space-y-1">
                          <div className="flex justify-between items-center text-[9px]">
                            <span className="font-black text-amber-500 bg-amber-950/40 px-1.5 rounded">
                              {log.type === 'Preventive' ? (isAr ? 'وقائية' : 'Preventive') :
                                log.type === 'Repair' ? (isAr ? 'إصلاح عطل' : 'Repair') :
                                  (isAr ? 'توضيب كامل' : 'Overhaul')}
                            </span>
                            <span className="font-mono text-slate-500 font-bold">
                              {log.date}
                            </span>
                          </div>
                          <p className="font-bold text-slate-300">
                            {log.notes}
                          </p>
                          <div className="flex justify-between items-center text-[8.5px] text-slate-500">
                            <span>{isAr ? `الجهة: ${log.doneBy}` : `Shop: ${log.doneBy}`}</span>
                            <span className="font-mono font-black text-slate-300">
                              {log.cost.toLocaleString()} {log.currency}
                            </span>
                          </div>
                        </div>
                      ))}
                      {(!asset.maintenanceLogs || asset.maintenanceLogs.length === 0) && (
                        <p className="p-5 text-center text-slate-500 font-bold text-[8.5px] uppercase italic">
                          [ no_maintenance_history_logged ]
                        </p>
                      )}
                    </div>
                  )}

                </div>

              </div>
            );
          })}

          {filteredAssets.length === 0 && (
            <div className="p-16 text-center text-slate-500 font-semibold font-mono text-[10px] uppercase border border-dashed border-slate-850 rounded-2xl col-span-full">
              [ {isAr ? 'لا يوجد أصول مطابقة لمعايير البحث.' : 'no_matching_assets_found_in_portfolio'} ]
            </div>
          )}
        </div>

      </div>

      {/* MODAL: ADD PHYSICAL ASSET */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-start">
          <div className="bg-[#121215] border border-slate-850 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative animate-fade-in">

            <button
              onClick={() => setIsAddOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 border-b border-slate-850">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                <PlusCircle className="w-4 h-4 text-[#d4af37]" />
                {isAr ? 'تسجيل وتقييد أصل جديد للشركة' : 'Register Corporate Physical Asset'}
              </h3>
              <p className="text-[9.5px] text-slate-550 mt-1">
                {isAr ? 'أضف مركبات الشحن أو أجهزة فحص الطرود وحدد المندوب المسؤول عنها لمتابعتها.' : 'Add your shipping fleet or inspection gear and designate responsible staff.'}
              </p>
            </div>

            <form onSubmit={handleRegisterAsset} className="p-6 space-y-4">

              <div className="grid grid-cols-2 gap-3">
                {/* Asset Code */}
                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'رمز رقم الأصل المميز (مثال: AST-01)' : 'Asset unique reference ID'}</label>
                  <input
                    type="text"
                    required
                    value={newAsset.assetCode}
                    onChange={e => setNewAsset(prev => ({ ...prev, assetCode: e.target.value }))}
                    placeholder="AST-032"
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-mono font-black outline-none focus:border-[#d4af37]"
                  />
                </div>

                {/* Categories */}
                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'تصنيف وفئة الأصل' : 'Asset Category'}</label>
                  <select
                    value={newAsset.category}
                    onChange={e => setNewAsset(prev => ({ ...prev, category: e.target.value as any }))}
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-black cursor-pointer outline-none focus:border-[#d4af37]"
                  >
                    <option value="Vehicles">{isAr ? 'وسائل نقل وسيارات' : 'Vehicles'}</option>
                    <option value="Inspection">{isAr ? 'أجهزة كشف وفحص فني' : 'Inspection / Scanners'}</option>
                    <option value="Office">{isAr ? 'مستلزمات عقارية ومكتبية' : 'Office Furnishing'}</option>
                    <option value="Computers">{isAr ? 'أجهزة إلكترونية وتقنية' : 'Electronics / IT'}</option>
                    <option value="Other">{isAr ? 'أخرى' : 'Other'}</option>
                  </select>
                </div>
              </div>

              {/* Names */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الاسم والبيان بالعربية' : 'Asset Name (Arabic)'}</label>
                <input
                  type="text"
                  required
                  value={newAsset.nameAr}
                  onChange={e => setNewAsset(prev => ({ ...prev, nameAr: e.target.value }))}
                  placeholder={isAr ? "مثال: ميتسوبيشي غمارة 2024" : "Toyota pickup 2024..."}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الاسم بالإنجليزية' : 'Asset Name (English)'}</label>
                <input
                  type="text"
                  required
                  value={newAsset.nameEn}
                  onChange={e => setNewAsset(prev => ({ ...prev, nameEn: e.target.value }))}
                  placeholder="Mitsubishi Single Cabin 2024"
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Cost / Currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'قيمة تكلفة الشراء الكلية' : 'Acquisition cost'}</label>
                  <input
                    type="number"
                    required
                    value={newAsset.cost}
                    onChange={e => setNewAsset(prev => ({ ...prev, cost: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-mono font-black outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'العملة' : 'Billed original'}</label>
                  <select
                    value={newAsset.currency}
                    onChange={e => setNewAsset(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full bg-black/40 border border-[#1e1e24] text-white rounded-xl px-3 py-2 text-xs font-black cursor-pointer"
                  >
                    {activeCurrencies.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Responsible Courier (المندوب المسؤول عنها) & Date */}
              <div className="grid grid-cols-2 gap-3">
                {/* تحديد المندوب المسؤول عن كل أصل */}
                <div>
                  <label className="block text-[9.5px] font-black text-[#d4af37] mb-1 uppercase">{isAr ? 'تخصيص المندوب المسؤول' : 'Responsible Courier / Assignee'}</label>
                  <select
                    value={newAsset.assignedCourierId}
                    onChange={e => setNewAsset(prev => ({ ...prev, assignedCourierId: e.target.value }))}
                    className="w-full bg-black/40 border border-[#2d2d38] text-white rounded-xl px-3 py-2 text-xs font-black cursor-pointer outline-none focus:border-[#d4af37]"
                  >
                    <option value="">{isAr ? '-- غير مخصص لمندوب --' : '-- Choose staff --'}</option>
                    {couriers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'تاريخ الاقتناء' : 'Acquisition Date'}</label>
                  <input
                    type="date"
                    required
                    value={newAsset.purchaseDate}
                    onChange={e => setNewAsset(prev => ({ ...prev, purchaseDate: e.target.value }))}
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:border-[#d4af37]"
                  />
                </div>
              </div>

              {/* Status and Allocation Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'أصل رأسمالي / مرن' : 'Asset Type'}</label>
                  <select
                    value={newAsset.type}
                    onChange={e => setNewAsset(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-black cursor-pointer outline-none focus:border-[#d4af37]"
                  >
                    <option value="Fixed">Fixed (أصل عيني مادي ثابت)</option>
                    <option value="NonFixed">Non-Fixed (أصل كفائي متداول)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الحالة التشغيلية للأصل' : 'Operation State'}</label>
                  <select
                    value={newAsset.status}
                    onChange={e => setNewAsset(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-black cursor-pointer outline-none focus:border-[#d4af37]"
                  >
                    <option value="Active">Active (نشط فعال)</option>
                    <option value="UnderMaintenance">UnderMaintenance (تحت الخدمة/الصيانة)</option>
                    <option value="Retired">Retired (معدوم خارج الخدمة)</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'شروح وملاحظات مطابقة' : 'Supplementary details'}</label>
                <textarea
                  value={newAsset.notes}
                  onChange={e => setNewAsset(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3.5 py-2 text-xs font-normal outline-none focus:border-[#d4af37] h-16 resize-none animate-fade-in"
                  placeholder={isAr ? "رقم المحرك، رقم اللوحة، المستودع الحالي..." : "License plate, engine serial, current sector..."}
                />
              </div>

              <div className="pt-3 border-t border-slate-850 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="w-1/2 bg-slate-900 border border-slate-800 text-slate-400 py-2.5 rounded-xl text-xs font-bold hover:text-white transition-all"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={assetRegisterLoading}
                  className="w-1/2 bg-[#d4af37] text-black py-2.5 rounded-xl text-xs font-black hover:bg-[#bfa032] transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {assetRegisterLoading && <RefreshCw className="w-3 animate-spin" />}
                  {isAr ? 'تقييد وحفظ' : 'Register Asset'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD MAINTENANCE LOG */}
      {selectedAssetForMaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-start">
          <div className="bg-[#121215] border border-slate-850 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative animate-fade-in">

            <button
              onClick={() => setSelectedAssetForMaint(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-white transition-all pointer-events-auto cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 border-b border-slate-850">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Wrench className="w-4 h-4 text-amber-500" />
                {isAr ? 'تسجيل سند تقرير صيانة' : 'Request Maintenance Bill Entry'}
              </h3>
              <p className="text-[9.5px] text-slate-550 mt-1">
                {isAr ? `توثيق صيانة أو توضيب ميكانيكي للأصل: [ ${isAr ? selectedAssetForMaint.nameAr : selectedAssetForMaint.nameEn} ]` : `Record diagnostic repair history for asset [ ${selectedAssetForMaint.nameEn} ].`}
              </p>
            </div>

            <form onSubmit={handleAddMaintenance} className="p-6 space-y-4">

              {/* Cost  */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'نفقات وتكاليف الصيانة' : 'Cost value'}</label>
                  <input
                    type="number"
                    required
                    value={newMaint.cost}
                    onChange={e => setNewMaint(prev => ({ ...prev, cost: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-mono font-black outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'العملة' : 'Billed curr'}</label>
                  <select
                    value={newMaint.currency}
                    onChange={e => setNewMaint(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-2 py-2 text-[10px] font-black outline-none focus:border-[#d4af37] cursor-pointer"
                  >
                    {activeCurrencies.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Maintenance classification type */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'نوع الصيانة والدورية' : 'Maintenance Type'}</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Preventive', 'Repair', 'Overhaul'] as any[]).map((state) => (
                    <button
                      key={state}
                      type="button"
                      onClick={() => setNewMaint(prev => ({ ...prev, type: state }))}
                      className={`text-[9.5px] font-black border py-2 rounded-xl transition-all ${newMaint.type === state
                        ? 'bg-[#d4af37]/15 border-[#d4af37]/30 text-[#d4af37]'
                        : 'bg-black/25 border-slate-850 text-slate-500 hover:text-slate-300'
                        }`}
                    >
                      {state === 'Preventive' ? (isAr ? 'دورية/وقائية' : 'Preventive') :
                        state === 'Repair' ? (isAr ? 'إصلاح عطل' : 'Repair') :
                          (isAr ? 'توضيب ميكانيكي' : 'Overhaul')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Repairs details done by */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'الجهة الفنية القائمة بالصيانة' : 'Technician Group / Repair Shop'}</label>
                <input
                  type="text"
                  value={newMaint.doneBy}
                  onChange={e => setNewMaint(prev => ({ ...prev, doneBy: e.target.value }))}
                  placeholder={isAr ? "مثال: مركز خدمة تويوتا المعتمد" : "Toyota authorized service center"}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'تاريخ صيانة التقرير' : 'Check Date'}</label>
                <input
                  type="date"
                  required
                  value={newMaint.date}
                  onChange={e => setNewMaint(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:border-[#d4af37]"
                />
              </div>

              {/* Particulars repair descriptions */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 mb-1 uppercase">{isAr ? 'تفاصيل أعمال الصيانة وقطع الغيار' : 'Particulars & parts replaced'}</label>
                <input
                  type="text"
                  required
                  value={newMaint.notes}
                  onChange={e => setNewMaint(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={isAr ? "مثال: تغيير زيت المحرك وفلاتر تصفية الهيدروليك" : "Oil replacement, engine coolant..."}
                  className="w-full bg-black/40 border border-slate-850 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="pt-3 border-t border-slate-850 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAssetForMaint(null)}
                  className="w-1/2 bg-slate-900 border border-slate-800 text-slate-400 py-2.5 rounded-xl text-xs font-bold hover:text-white transition-all"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={maintenanceLoading}
                  className="w-1/2 bg-emerald-500 text-black py-2.5 rounded-xl text-xs font-black hover:bg-emerald-600 transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {maintenanceLoading && <RefreshCw className="w-3 animate-spin" />}
                  {isAr ? 'تسجيل وتقييد السند' : 'Log Maintenance'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
