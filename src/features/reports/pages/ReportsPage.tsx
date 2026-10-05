import React, { useState, useMemo, useEffect } from "react";
import { useSettings } from "../../../context/SettingsContext";
import { useRole } from "../../../hooks/useRole";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  FileText,
  TrendingUp,
  DollarSign,
  Users,
  Truck,
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Settings as SettingsIcon,
  AlertCircle,
  Layers,
  Layout,
  Save,
  CheckCircle2,
  Coins,
  Eye,
  ShoppingCart,
  UserCheck,
  Bookmark,
  Trash2,
  Palette,
  Sparkles,
} from "lucide-react";
import { printContent } from "../../../lib/printUtils";
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  isWithinInterval,
} from "date-fns";
import * as XLSX from "xlsx";
import { notificationService } from "../../../services/notificationService";
import { useExpenseCategories } from "../../../hooks/useExpenseCategories";
import { financialAccountService } from "../../../services/financialAccountService";
import { useExchangeRates } from "../../../hooks/useExchangeRates";
import { PrintDesignerPageTab } from "./tabs/PrintDesignerPageTab";
import ReportsTabContent from "./tabs/ReportsTabContent";
import { ReportPrintPreviewModal } from "../components/ReportPrintPreviewModal";
import MultiAccountSelector from "../components/MultiAccountSelector";
import ReportsContextFilters from "../components/ReportsContextFilters";
import {
  DEFAULT_PRINT_SETTINGS,
  REPORT_TYPES,
  type PrintTemplateSettings,
  type ReportFilter,
} from "../types/reports.types";
import { reportsApiDataGateway } from "../services/reportsApiDataGateway";

export default function ReportsPage() {
  const { settings } = useSettings();
  const { rates: dbRates } = useExchangeRates();
  const EXPENSE_CATEGORIES_DYNAMIC = useExpenseCategories();
  const { role, hasPermission, loading: roleLoading } = useRole();
  const isAr = settings.language === "ar";

  // Core Data States
  const [orders, setOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<any[]>([]);
  const [accountTransactions, setAccountTransactions] = useState<any[]>([]);
  const [allAccountTransactions, setAllAccountTransactions] = useState<any[]>(
    []
  );
  const [allTimeTransactions, setAllTimeTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs layout
  const [activeTab, setActiveTab] = useState<"reports" | "templates">(
    "reports"
  );

  // Print Template State
  const [printSettings, setPrintSettings] = useState<PrintTemplateSettings>(
    DEFAULT_PRINT_SETTINGS
  );
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Custom Saved Report Filter Templates System
  const [savedReportTemplates, setSavedReportTemplates] = useState<any[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);
  const [isSavingFilterTemplate, setIsSavingFilterTemplate] = useState(false);

  // Filter States
  const [activeReport, setActiveReport] = useState("financial_overview");
  const [filters, setFilters] = useState<ReportFilter>({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
    type: "all",
  });
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  // Multi-account selection state variables for the reports requested
  const [selectedPackagingAccountIds, setSelectedPackagingAccountIds] =
    useState<string[]>([]);
  const [selectedOrdersCostAccountIds, setSelectedOrdersCostAccountIds] =
    useState<string[]>([]);
  const [
    selectedShippingCompaniesAccountIds,
    setSelectedShippingCompaniesAccountIds,
  ] = useState<string[]>([]);
  const [reportSettingsLoaded, setReportSettingsLoaded] = useState(false);

  // Load report account selections from the API-independent UI preference store.
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("swiftship.report_accounts") || "{}"
      );
      if (Array.isArray(saved.packaging))
        setSelectedPackagingAccountIds(saved.packaging);
      if (Array.isArray(saved.orders_cost))
        setSelectedOrdersCostAccountIds(saved.orders_cost);
      if (Array.isArray(saved.shipping_companies))
        setSelectedShippingCompaniesAccountIds(saved.shipping_companies);
    } catch (error) {
      console.warn("Unable to load report account preferences.", error);
    }
    setReportSettingsLoaded(true);
  }, []);

  // Automatically initialize defaults ONLY if nothing is loaded from DB and reportSettingsLoaded is true
  useEffect(() => {
    if (accounts.length > 0 && reportSettingsLoaded) {
      if (selectedPackagingAccountIds.length === 0) {
        const pkgAcc = accounts.find(
          a =>
            a.entityId === "sys_packaging_fees" ||
            a.accountCode === "5100-7355" ||
            (a.name || "").includes("تغليف")
        );
        if (pkgAcc) {
          setSelectedPackagingAccountIds([pkgAcc.id]);
        }
      }
      if (selectedOrdersCostAccountIds.length === 0) {
        const defaults = accounts
          .filter(
            a =>
              [
                "sys_sourcing_cost",
                "sys_shipping_costs",
                "sys_delivery_cost",
              ].includes(a.entityId || "") ||
              ["5100-4483", "5000-1122", "5300-7118", "5000-2788"].includes(
                a.accountCode || ""
              ) ||
              (a.name || "").includes("تجميع") ||
              (a.name || "").includes("شحن") ||
              (a.name || "").includes("توصيل")
          )
          .map(a => a.id);
        if (defaults.length > 0) {
          setSelectedOrdersCostAccountIds(defaults);
        }
      }
      if (selectedShippingCompaniesAccountIds.length === 0) {
        const defaults = accounts
          .filter(
            a =>
              a.entityType === "shipping_company" ||
              (a.name || "").includes("عمول") ||
              (a.name || "").includes("شحن") ||
              (a.accountCode || "").startsWith("5300")
          )
          .map(a => a.id);
        if (defaults.length > 0) {
          setSelectedShippingCompaniesAccountIds(defaults);
        }
      }
    }
  }, [accounts, reportSettingsLoaded]);

  const handleSaveAccountSelection = async (reportType: string) => {
    try {
      const selectedIds =
        reportType === "packaging"
          ? selectedPackagingAccountIds
          : reportType === "orders_cost"
            ? selectedOrdersCostAccountIds
            : selectedShippingCompaniesAccountIds;
      const existing = JSON.parse(
        localStorage.getItem("swiftship.report_accounts") || "{}"
      );
      localStorage.setItem(
        "swiftship.report_accounts",
        JSON.stringify({ ...existing, [reportType]: selectedIds })
      );
      notificationService.notify({
        title: isAr ? "تم الحفظ" : "Saved",
        message: isAr
          ? "تم حفظ إعدادات التقرير محلياً"
          : "Report settings saved locally",
        type: "success",
      });
    } catch (err: any) {
      notificationService.notify({
        title: isAr ? "خطأ في الحفظ" : "Save Error",
        message: err.message,
        type: "error",
      });
    }
  };

  // Active Print Slips Preview Modal
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [printZoomScale, setPrintZoomScale] = useState(0.8);

  // Drilldown Selected States
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(
    null
  );
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<
    string | null
  >(null);

  const convertToYER = (amount: number, currency: string) => {
    return financialAccountService.convertToDefaultCurrency(
      amount,
      currency,
      settings.currency || "YER",
      dbRates
    );
  };

  const convertCurrency = (amount: number, from: string, to: string) => {
    return financialAccountService.convertToTargetCurrency(
      amount,
      from,
      to,
      dbRates
    );
  };

  const [mainEntriesMap, setMainEntriesMap] = useState<Map<string, any>>(
    new Map()
  );

  // Account transactions and entry states are populated by reportsApiDataGateway.
  useEffect(() => {
    const start = startOfDay(new Date(filters.startDate));
    const end = endOfDay(new Date(filters.endDate));
    setAllAccountTransactions(
      allTimeTransactions.filter((tx: any) =>
        isWithinInterval(new Date(tx.createdAt), { start, end })
      )
    );
  }, [allTimeTransactions, filters.startDate, filters.endDate]);

  // Custom presets handlers
  const handleSaveFilterTemplate = async () => {
    if (!newTemplateName.trim()) {
      notificationService.notify({
        title: isAr ? "خطأ" : "Error",
        message: isAr
          ? "يرجى إدخال اسم للقالب المحفوظ"
          : "Please provide a name for the saved template",
        type: "error",
      });
      return;
    }
    setIsSavingFilterTemplate(true);
    try {
      const templates = JSON.parse(
        localStorage.getItem("swiftship.report_templates") || "[]"
      );
      templates.push({
        id: crypto.randomUUID(),
        name: newTemplateName.trim(),
        activeReport,
        filters,
        sortBy,
        sortOrder,
        searchTerm,
        selectedOrderId,
        selectedCustomerId,
        selectedCourierId,
        selectedCompanyId,
        selectedUserId,
        selectedExpenseCategory,
        createdAt: Date.now(),
      });
      localStorage.setItem(
        "swiftship.report_templates",
        JSON.stringify(templates)
      );
      setSavedReportTemplates(templates);
      notificationService.notify({
        title: isAr ? "تم الحفظ" : "Saved",
        message: isAr
          ? "تم حفظ قالب الفلترة بنجاح"
          : "Filter configuration saved successfully",
        type: "success",
      });
      setNewTemplateName("");
      setShowSaveTemplateForm(false);
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: isAr ? "خطأ في الحفظ" : "Save Error",
        message: err.message,
        type: "error",
      });
    } finally {
      setIsSavingFilterTemplate(false);
    }
  };

  const handleDeleteFilterTemplate = async (
    templateId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (
      !window.confirm(
        isAr
          ? "هل أنت متأكد من حذف هذا القالب الذكي؟"
          : "Are you sure you want to delete this custom template?"
      )
    )
      return;
    try {
      const templates = JSON.parse(
        localStorage.getItem("swiftship.report_templates") || "[]"
      ).filter((template: any) => template.id !== templateId);
      localStorage.setItem(
        "swiftship.report_templates",
        JSON.stringify(templates)
      );
      setSavedReportTemplates(templates);
      notificationService.notify({
        title: isAr ? "تم الحذف" : "Deleted",
        message: isAr
          ? "تمت إزالة قالب الفلترة بنجاح"
          : "Custom filter template layout deleted successfully",
        type: "success",
      });
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: isAr ? "خطأ في الحذف" : "Delete Error",
        message: err.message,
        type: "error",
      });
    }
  };

  const handleApplyFilterTemplate = (template: any) => {
    setActiveReport(template.activeReport);
    if (template.filters) {
      setFilters(template.filters);
    }
    if (template.sortBy) setSortBy(template.sortBy);
    if (template.sortOrder) setSortOrder(template.sortOrder);
    if (template.searchTerm !== undefined) setSearchTerm(template.searchTerm);

    setSelectedOrderId(template.selectedOrderId || null);
    setSelectedCustomerId(template.selectedCustomerId || null);
    setSelectedCourierId(template.selectedCourierId || null);
    setSelectedCompanyId(template.selectedCompanyId || null);
    setSelectedUserId(template.selectedUserId || null);
    setSelectedExpenseCategory(template.selectedExpenseCategory || null);

    notificationService.notify({
      title: isAr ? "تم تطبيق القالب" : "Template Applied",
      message: isAr
        ? `تم تنشيط الفلترة والترتيب بناءً على القالب: ${template.name}`
        : `Active filters applied for ${template.name}`,
      type: "success",
    });
  };

  // Reset drilldowns when active report tab changes to avoid state pollution
  useEffect(() => {
    setSelectedOrderId(null);
    setSelectedCustomerId(null);
    setSelectedCourierId(null);
    setSelectedCompanyId(null);
    setSelectedUserId(null);
    setSelectedExpenseCategory(null);
  }, [activeReport]);

  // Load local report templates and print preferences; business data comes from API.
  useEffect(() => {
    try {
      setSavedReportTemplates(
        JSON.parse(localStorage.getItem("swiftship.report_templates") || "[]")
      );
      const print = JSON.parse(
        localStorage.getItem("swiftship.print_template") || "null"
      );
      if (print) setPrintSettings(previous => ({ ...previous, ...print }));
    } catch (error) {
      console.warn("Unable to load local report preferences.", error);
    }
    setLoading(false);
  }, []);

  // تدريجياً: يقرأ نطاق Reports الأساسي من API عند تفعيل العلم، مع بقاء
  // collections غير المدعومة حالياً على Legacy Gateway حتى لا تنكسر التقارير.
  useEffect(() => {
    return reportsApiDataGateway.subscribeCoreData({
      onData: state => {
        setOrders(state.orders);
        setExpenses(state.expenses);
        setCouriers(state.couriers);
        setCustomers(state.customers);
        setSources(state.sources);
        setUsers(state.users);
        setAccounts(state.accounts);
        setShippingCompanies(state.shippingCompanies);
        setSavedReportTemplates(state.reportTemplates);
        setAccountTransactions(state.accountTransactions);
        setAllAccountTransactions(state.accountTransactions);
        setAllTimeTransactions(state.accountTransactions);
        setMainEntriesMap(
          new Map(state.mainEntries.map(entry => [entry.id, entry]))
        );
      },
      onError: error =>
        console.error("Reports API read failed; retaining Legacy data:", error),
    });
  }, []);

  // Apply report drill-down filters to the API-provided transaction state.
  useEffect(() => {
    const selectedAccountId =
      filters.accountId ||
      (filters.entityId
        ? accounts.find(account => account.entityId === filters.entityId)?.id
        : undefined);
    const filtered = allAccountTransactions.filter((tx: any) => {
      if (selectedAccountId && tx.accountId !== selectedAccountId) return false;
      if (
        filters.entityId &&
        tx.entityId !== filters.entityId &&
        tx.accountId !== filters.entityId
      )
        return false;
      if (selectedOrderId && tx.orderId !== selectedOrderId) return false;
      if (selectedCustomerId && tx.entityId !== selectedCustomerId)
        return false;
      if (selectedCourierId && tx.entityId !== selectedCourierId) return false;
      return true;
    });
    setAccountTransactions(filtered);
  }, [
    allAccountTransactions,
    accounts,
    filters.accountId,
    filters.entityId,
    selectedOrderId,
    selectedCustomerId,
    selectedCourierId,
  ]);

  // Save changes to print settings template in supabase
  const handleSavePrintSettings = async () => {
    setSavingTemplate(true);
    try {
      localStorage.setItem(
        "swiftship.print_template",
        JSON.stringify(printSettings)
      );
      notificationService.notify({
        title: isAr ? "تم الحفظ بنجاح" : "Settings Saved",
        message: isAr
          ? "تم تحديث قالب الطباعة وإعدادات الفواتير بنجاح"
          : "Print templates updated successfully.",
        type: "success",
      });
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: isAr ? "خطأ في الحفظ" : "Save Error",
        message: err.message,
        type: "error",
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  // Process data matching filters
  const filteredData = useMemo(() => {
    const start = startOfDay(new Date(filters.startDate));
    const end = endOfDay(new Date(filters.endDate));

    const checkInterval = (timestamp: number) => {
      if (!timestamp) return false;
      return isWithinInterval(new Date(timestamp), { start, end });
    };

    let fOrders = orders.filter(o => checkInterval(o.createdAt || 0));
    let fExpenses = expenses.filter(e => checkInterval(e.createdAt || 0));

    // Custom Category / Type expense filter
    if (activeReport === "expenses") {
      if (filters.type && filters.type !== "all") {
        fExpenses = fExpenses.filter(e => e.category === filters.type);
      }
    }

    // Secondary filters depending on report
    let fCustomers = customers;
    if (activeReport === "customers" && filters.entityId) {
      fCustomers = customers.filter(c => c.id === filters.entityId);
    }

    let fCouriers = couriers;
    if (activeReport === "couriers" && filters.entityId) {
      fCouriers = couriers.filter(co => co.id === filters.entityId);
    }

    let fUsers = users;
    if (activeReport === "users" && filters.entityId) {
      fUsers = users.filter(u => u.id === filters.entityId);
    }

    // Apply Sorting
    const sortFn = (a: any, b: any) => {
      let valA = a.createdAt || 0;
      let valB = b.createdAt || 0;
      if (sortBy === "amount") {
        valA = parseFloat(a.amount || a.totalPrice || 0);
        valB = parseFloat(b.amount || b.totalPrice || 0);
      }
      return sortOrder === "desc" ? valB - valA : valA - valB;
    };

    return {
      orders: fOrders.sort(sortFn),
      expenses: fExpenses.sort(sortFn),
      couriers: fCouriers,
      customers: fCustomers,
      users: fUsers,
      shippingCompanies,
    };
  }, [
    orders,
    expenses,
    couriers,
    customers,
    users,
    shippingCompanies,
    filters,
    sortOrder,
    sortBy,
    activeReport,
  ]);

  const reportMetrics = useMemo(() => {
    // 1. Identify specific system account IDs and codes
    const profitAcc = accounts.find(a => a.entityId === "sys_profit_account");
    const pkgAcc = accounts.find(a => a.entityId === "sys_packaging_fees");
    const sourcingAcc = accounts.find(a => a.entityId === "sys_sourcing_cost");
    const shippingAcc = accounts.find(a => a.entityId === "sys_shipping_costs");
    const deliveryAcc = accounts.find(a => a.entityId === "sys_delivery_cost");

    const profitAccId = profitAcc?.id || "sys_profit_account";
    const pkgAccId = pkgAcc?.id || "sys_packaging_fees";
    const sourcingAccId = sourcingAcc?.id || "sys_sourcing_cost";
    const shippingAccId = shippingAcc?.id || "sys_shipping_costs";
    const deliveryAccId = deliveryAcc?.id || "sys_delivery_cost";

    // 2. Compute Revenue (Credit - Debit on Revenue accounts)
    const revenue = allAccountTransactions
      .filter(
        tx =>
          tx.accountCode?.startsWith("4") || tx.accountCode?.startsWith("REV")
      )
      .reduce(
        (sum, tx) =>
          sum +
          (tx.type === "Credit"
            ? convertToYER(
                parseFloat(tx.amountOriginal) || 0,
                tx.currencyOriginal || "YER"
              )
            : -convertToYER(
                parseFloat(tx.amountOriginal) || 0,
                tx.currencyOriginal || "YER"
              )),
        0
      );

    // 3. Compute Costs (Debit - Credit on Expense accounts)
    const costs = allAccountTransactions
      .filter(
        tx =>
          tx.accountCode?.startsWith("5") || tx.accountCode?.startsWith("EXP")
      )
      .reduce(
        (sum, tx) =>
          sum +
          (tx.type === "Debit"
            ? convertToYER(
                parseFloat(tx.amountOriginal) || 0,
                tx.currencyOriginal || "YER"
              )
            : -convertToYER(
                parseFloat(tx.amountOriginal) || 0,
                tx.currencyOriginal || "YER"
              )),
        0
      );

    /* const costs = allAccountTransactions
       .filter(a => a.accountCode?.startsWith('5') || a.accountCode?.startsWith('EXP'))
       .reduce((sum, a) => {
         const balance = parseFloat(a.balance as any) || 0;
         const converted = financialAccountService.convertToDefaultCurrency(
           balance,
           a.currency || 'YER',
           settings.currency || 'YER',
           { USD: settings.exchangeRateUSD, SAR: settings.exchangeRateSAR }
         );
         return sum + converted;
       }, 0);*/

    const profit = revenue - costs;

    // 4. Compute specific sub-costs for charts with proper fallbacks
    const sourcingCosts = allAccountTransactions
      .filter(
        tx => tx.accountId === sourcingAccId || tx.accountCode === "5100-4483"
      )
      .reduce(
        (sum, tx) =>
          sum +
          (tx.type === "Debit"
            ? convertToYER(
                parseFloat(tx.amount) || 0,
                tx.currencyOriginal || tx.currency || "YER"
              )
            : -convertToYER(
                parseFloat(tx.amount) || 0,
                tx.currencyOriginal || tx.currency || "YER"
              )),
        0
      );

    const shippingCosts = allAccountTransactions
      .filter(
        tx =>
          tx.accountId === shippingAccId ||
          tx.accountCode === "5000-1122" ||
          tx.accountCode === "5300-7118"
      )
      .reduce(
        (sum, tx) =>
          sum +
          (tx.type === "Debit"
            ? convertToYER(
                parseFloat(tx.amount) || 0,
                tx.currencyOriginal || tx.currency || "YER"
              )
            : -convertToYER(
                parseFloat(tx.amount) || 0,
                tx.currencyOriginal || tx.currency || "YER"
              )),
        0
      );

    const deliveryCosts = allAccountTransactions
      .filter(
        tx => tx.accountId === deliveryAccId || tx.accountCode === "5000-2788"
      )
      .reduce(
        (sum, tx) =>
          sum +
          (tx.type === "Debit"
            ? convertToYER(
                parseFloat(tx.amount) || 0,
                tx.currencyOriginal || tx.currency || "YER"
              )
            : -convertToYER(
                parseFloat(tx.amount) || 0,
                tx.currencyOriginal || tx.currency || "YER"
              )),
        0
      );

    const packagingCosts = allAccountTransactions
      .filter(tx => tx.accountId === pkgAccId || tx.accountCode === "5100-7355")
      .reduce(
        (sum, tx) =>
          sum +
          (tx.type === "Credit"
            ? convertToYER(
                parseFloat(tx.amount) || 0,
                tx.currencyOriginal || tx.currency || "YER"
              )
            : -convertToYER(
                parseFloat(tx.amount) || 0,
                tx.currencyOriginal || tx.currency || "YER"
              )),
        0
      ); // Treated as collected revenue offset

    const salaryCosts = allAccountTransactions
      .filter(
        tx => tx.accountCode?.startsWith("2130") || tx.module === "salary"
      )
      .reduce(
        (sum, tx) =>
          sum +
          (tx.type === "Debit"
            ? convertToYER(
                parseFloat(tx.amountOriginal) || 0,
                tx.currencyOriginal || "YER"
              )
            : -convertToYER(
                parseFloat(tx.amountOriginal) || 0,
                tx.currencyOriginal || "YER"
              )),
        0
      );

    const operationalCosts = Math.max(
      0,
      costs - (sourcingCosts + shippingCosts + deliveryCosts + salaryCosts)
    );

    return {
      revenue,
      costs,
      profit,
      packagingCosts,
      operationalCosts,
      shippingCosts,
      salaryCosts,
    };
  }, [allAccountTransactions, accounts]);

  const treasuryBalances = useMemo(() => {
    let yerIn = 0,
      yerOut = 0;
    let usdIn = 0,
      usdOut = 0;
    let sarIn = 0,
      sarOut = 0;

    /*const cashAccount = accounts.find(a => a.entityId === 'sys_cash_account');
    if (cashAccount) {
      allTimeTransactions.forEach(tx => {
        if (tx.accountId === cashAccount.id) {
          const amt = parseFloat(tx.amountOriginal || tx.amount || 0);
          const cur = tx.currencyOriginal || tx.currency || 'YER';

          if (cur === 'YER') {
            if (tx.type === 'Debit') yerIn += amt;
            if (tx.type === 'Credit') yerOut += amt;
          } else if (cur === 'USD') {
            if (tx.type === 'Debit') usdIn += amt;
            if (tx.type === 'Credit') usdOut += amt;
          } else if (cur === 'SAR') {
            if (tx.type === 'Debit') sarIn += amt;
            if (tx.type === 'Credit') sarOut += amt;
          }
        }
      });
    }*/
    const cashAccountYER = accounts.find(a => a.accountCode === "1111-0");
    const cashAccountusd = accounts.find(a => a.accountCode === "1110-1");
    const cashAccountSAR = accounts.find(a => a.accountCode === "1110-2");
    if (cashAccountYER && cashAccountusd && cashAccountSAR) {
      allTimeTransactions.forEach(tx => {
        if (tx.accountCode === cashAccountYER.accountCode) {
          const amtyer = parseFloat(tx.amount || 0);
          const cur = tx.currency || "YER";
          if (tx.type === "Debit") yerIn += amtyer;
          if (tx.type === "Credit") yerOut += amtyer;
        } else if (tx.accountCode === cashAccountusd.accountCode) {
          const amtusd = parseFloat(tx.amount || 0);
          const cur = tx.currency || "USD";
          if (tx.type === "Debit") usdIn += amtusd;
          if (tx.type === "Credit") usdOut += amtusd;
        } else if (tx.accountCode === cashAccountSAR.accountCode) {
          const amtsar = parseFloat(tx.amount || 0);
          const cur = tx.currency || "SAR";
          if (tx.type === "Debit") sarIn += amtsar;
          if (tx.type === "Credit") sarOut += amtsar;
        }
      });
    }
    const yerBalance = yerIn - yerOut;
    const usdBalance = usdIn - usdOut;
    const sarBalance = sarIn - sarOut;

    const usdToYer = usdBalance * (dbRates.USD || 1);
    const sarToYer = sarBalance * (dbRates.SAR || 1);
    const combinedTotalYER = yerBalance + usdToYer + sarToYer;

    return {
      yer: { in: yerIn, out: yerOut, balance: yerBalance },
      usd: { in: usdIn, out: usdOut, balance: usdBalance },
      sar: { in: sarIn, out: sarOut, balance: sarBalance },
      combinedTotalYER,
    };
  }, [allTimeTransactions, accounts, settings]);

  const ledgerMetrics = useMemo(() => {
    if (activeReport !== "account_ledger" || !filters.accountId) return null;
    const selectedAccount = accounts.find(a => a.id === filters.accountId);
    if (!selectedAccount) return null;

    const start = startOfDay(new Date(filters.startDate));
    const end = endOfDay(new Date(filters.endDate));

    const getTime = (val: any) => {
      if (!val) return 0;
      if (typeof val === "number") return val;
      if (typeof val.toDate === "function") return val.toDate().getTime();
      const d = new Date(val);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const isDebitNormal = (acc: any) => {
      const type = (acc.type || acc.accountType || "").trim();
      if (type === "Asset" || type === "Expense") return true;
      if (type === "Liability" || type === "Equity" || type === "Revenue")
        return false;
      const cleanCode = (acc.accountCode || "").trim().toUpperCase();
      if (
        cleanCode.startsWith("1") ||
        cleanCode.startsWith("5") ||
        cleanCode.startsWith("AST") ||
        cleanCode.startsWith("EXP")
      )
        return true;
      return false;
    };
    const debitNormal = isDebitNormal(selectedAccount);

    // Get all transactions of all time for this account (excluding temporary entries)
    const myAllTimeTxs = allTimeTransactions.filter((tx: any) => {
      if (
        tx.entryCategory === "Temp" ||
        tx.entry_category === "Temp" ||
        tx.category === "Temp"
      )
        return false;

      const matchesIdOrCode =
        tx.accountId === selectedAccount.id ||
        tx.accountCode === selectedAccount.accountCode;
      const matchesEntity =
        selectedAccount.entityId &&
        (tx.entityId === selectedAccount.entityId ||
          tx.accountId === selectedAccount.entityId);
      const isTargetPackaging =
        selectedAccount.entityId === "sys_packaging_fees" ||
        selectedAccount.accountCode === "5100-7355";
      const matchesPackaging =
        isTargetPackaging &&
        (tx.accountId === "sys_packaging_fees" ||
          tx.entityId === "sys_packaging_fees");
      return matchesIdOrCode || matchesEntity || matchesPackaging;
    });

    // Sort chronologically (oldest first) to compute running balance
    const sortedAllTime = [...myAllTimeTxs].sort((a, b) => {
      const tA = getTime(a.createdAt || a.created_at);
      const tB = getTime(b.createdAt || b.created_at);
      return tA - tB;
    });

    let openingBalance = 0;
    let periodDebits = 0;
    let periodCredits = 0;

    sortedAllTime.forEach(tx => {
      const t = getTime(tx.createdAt || tx.created_at);
      const txDate = new Date(t);
      const amt = parseFloat(tx.amount) || 0;
      const isDebit = (tx.trans_type || tx.transType || tx.type) === "Debit";

      if (txDate < start) {
        if (isDebit) {
          openingBalance += debitNormal ? amt : -amt;
        } else {
          openingBalance += debitNormal ? -amt : amt;
        }
      } else if (isWithinInterval(txDate, { start, end })) {
        if (isDebit) {
          periodDebits += amt;
        } else {
          periodCredits += amt;
        }
      }
    });

    const closingBalance =
      openingBalance +
      (debitNormal
        ? periodDebits - periodCredits
        : periodCredits - periodDebits);

    let currentRunning = openingBalance;
    const rowsWithRunningBalance = sortedAllTime
      .filter(tx => {
        const t = getTime(tx.createdAt || tx.created_at);
        const txDate = new Date(t);
        return isWithinInterval(txDate, { start, end });
      })
      .map(tx => {
        const amt = parseFloat(tx.amount) || 0;
        const isDebit = (tx.trans_type || tx.transType || tx.type) === "Debit";
        if (isDebit) {
          currentRunning += debitNormal ? amt : -amt;
        } else {
          currentRunning += debitNormal ? -amt : amt;
        }
        return {
          ...tx,
          type: tx.trans_type || tx.transType || tx.type || "Debit",
          runningBalance: currentRunning,
        };
      });

    // reverse for display (newest first)
    const displayRows = [...rowsWithRunningBalance].reverse();

    return {
      selectedAccount,
      debitNormal,
      openingBalance,
      periodDebits,
      periodCredits,
      closingBalance,
      displayRows,
    };
  }, [
    activeReport,
    filters.accountId,
    filters.startDate,
    filters.endDate,
    accounts,
    allTimeTransactions,
  ]);

  // Derived charts and tables lists based on search parameter
  const searchMatchList = (list: any[], keyField: string) => {
    if (!searchTerm) return list;
    return list.filter(
      item =>
        String(item[keyField] || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        String(item.phone || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        String(item.companyName || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
    );
  };

  // Recharts representation config
  const pnlData = useMemo(() => {
    return [
      {
        name: isAr ? "المبيعات اللوجستية" : "Gross Revenue",
        value: reportMetrics.revenue,
      },
      {
        name: isAr ? "المصروفات والأجور" : "Operating Cost",
        value: reportMetrics.costs,
      },
      {
        name: isAr ? "صافي الأرباح" : "Corporate Profit",
        value: Math.max(0, reportMetrics.profit),
      },
    ];
  }, [reportMetrics, isAr]);

  // Export Report to XLSX natively (fully supports Arabic because of modern XML sheet representation)
  const handleExportExcel = async () => {
    let dataToExport: any[] = [];
    let title = activeReport;

    if (activeReport === "expenses") {
      dataToExport = filteredData.expenses.map(e => ({
        [isAr ? "رقم السند" : "ID"]: e.expenseNumber || "-",
        [isAr ? "التاريخ" : "Date"]: format(
          new Date(e.createdAt || Date.now()),
          "yyyy-MM-dd"
        ),
        [isAr ? "التصنيف" : "Category"]: e.category || "-",
        [isAr ? "المستلم" : "Recipient"]: e.recipientName || "-",
        [isAr ? "البيان" : "Notes"]: e.notes || "-",
        [isAr ? "المبلغ" : "Amount"]: e.amount || 0,
        [isAr ? "العملة" : "Currency"]: e.currency || "SAR",
      }));
    } else if (activeReport === "account_ledger" && ledgerMetrics) {
      dataToExport = [...ledgerMetrics.displayRows].reverse().map(tx => {
        const amt = parseFloat(tx.amount) || 0;
        return {
          [isAr ? "التاريخ" : "Date"]: format(
            new Date(tx.createdAt),
            "yyyy-MM-dd HH:mm"
          ),
          [isAr ? "رقم القيد" : "Ref"]: tx.refNumber || "-",
          [isAr ? "النوع" : "Type"]:
            tx.type === "Debit"
              ? isAr
                ? "مدين / صادر"
                : "Debit"
              : isAr
                ? "دائن / وارد"
                : "Credit",
          [isAr ? "البيان الوصفي" : "Description"]: tx.description || "-",
          [isAr ? "مدين (+)" : "Debit"]: tx.type === "Debit" ? amt : 0,
          [isAr ? "دائن (-)" : "Credit"]: tx.type === "Credit" ? amt : 0,
          [isAr ? "الرصيد التراكمي" : "Running Balance"]: tx.runningBalance,
        };
      });
    } else if (activeReport === "customers") {
      dataToExport = filteredData.customers.map(c => ({
        [isAr ? "اسم العميل" : "Customer"]: c.fullName,
        [isAr ? "الهاتف" : "Phone"]: c.phone || "-",
        [isAr ? "العنوان" : "Address"]: c.address || "-",
        [isAr ? "العملة المفضلة" : "Currency"]: c.financialCurrency || "SAR",
        [isAr ? "رصيد الحساب المالي" : "Balance"]: c.financialBalance || 0,
      }));
    } else if (activeReport === "couriers") {
      dataToExport = filteredData.couriers.map(c => ({
        [isAr ? "اسم المندوب" : "Courier Name"]: c.fullName,
        [isAr ? "الهاتف" : "Phone"]: c.phone || "-",
        [isAr ? "طريقة الحساب" : "Type"]:
          c.courierType === "sourcing"
            ? isAr
              ? "تجميع (سعودي)"
              : "Sourcing"
            : isAr
              ? "توزيع (محلي)"
              : "Local",
        [isAr ? "الرصيد المالي الحالي" : "Financial Balance"]:
          c.financialBalance || 0,
        [isAr ? "رصيد العهدة المعلقة" : "Outstanding Custody"]:
          c.outstandingCustody || 0,
        [isAr ? "العملة" : "Currency"]: c.financialCurrency || "SAR",
      }));
    } else if (activeReport === "shipping_companies") {
      dataToExport = filteredData.shippingCompanies.map(sc => ({
        [isAr ? "شركة الشحن" : "Shipping Co"]: sc.name,
        [isAr ? "الهاتف" : "Phone"]: sc.phone || "-",
        [isAr ? "الموقع" : "Type"]: sc.type || "-",
      }));
    } else if (activeReport === "users") {
      dataToExport = filteredData.users.map(u => ({
        [isAr ? "الاسم الكامل" : "Staff Name"]:
          u.fullName || u.displayName || "-",
        [isAr ? "البريد الإلكتروني" : "Email"]: u.email || "-",
        [isAr ? "الصلاحية وظيفة" : "Role"]: u.role || "-",
        [isAr ? "الراتب الشهري الأساسي" : "Basic Monthly Salary"]:
          u.monthlySalary || 0,
      }));
    } else if (activeReport === "packaging") {
      const expensesPart = filteredData.expenses
        .filter(e => e.category === "PACKAGING")
        .map(e => ({
          [isAr ? "النوع المالي" : "Fin Type"]: isAr
            ? "مصروف / خرج"
            : "Expense",
          [isAr ? "السند/رقم الطلب" : "ID"]: e.expenseNumber,
          [isAr ? "التاريخ" : "Date"]: format(
            new Date(e.createdAt || Date.now()),
            "yyyy-MM-dd"
          ),
          [isAr ? "البيان / الشرح" : "Notes"]: e.notes || "-",
          [isAr ? "الجهة المستلمة" : "Recipient"]: e.recipientName || "-",
          [isAr ? "المبلغ الفعلي" : "Amount"]: e.amount || 0,
          [isAr ? "العملة" : "Currency"]: e.currency,
        }));

      const ordersPart = filteredData.orders
        .filter(
          o =>
            o.orderStatus !== "Cancelled" &&
            (parseFloat(o.packagingFee) || 0) > 0
        )
        .map(o => ({
          [isAr ? "النوع المالي" : "Fin Type"]: isAr
            ? "إيراد / رسوم محصلة"
            : "Income",
          [isAr ? "السند/رقم الطلب" : "ID"]: o.orderNumber,
          [isAr ? "التاريخ" : "Date"]: format(
            new Date(o.createdAt || Date.now()),
            "yyyy-MM-dd"
          ),
          [isAr ? "البيان / الشرح" : "Notes"]: isAr
            ? `رسوم تغليف شحنة للعميل`
            : `Order packaging fee`,
          [isAr ? "الجهة المستلمة" : "Recipient"]: o.customerName || "-",
          [isAr ? "المبلغ الفعلي" : "Amount"]: o.packagingFee || 0,
          [isAr ? "العملة" : "Currency"]: "SAR",
        }));

      dataToExport = [...expensesPart, ...ordersPart];
    } else {
      // default orders report
      dataToExport = filteredData.orders.map(o => ({
        [isAr ? "رقم الطلب" : "Order Num"]: o.orderNumber,
        [isAr ? "التاريخ" : "Date"]: format(
          new Date(o.createdAt || Date.now()),
          "yyyy-MM-dd"
        ),
        [isAr ? "اسم العميل" : "Customer"]: o.customerName,
        [isAr ? "حالة الطلب" : "Status"]: o.orderStatus,
        [isAr ? "تكلفة الطلب الصافي" : "Total"]: o.totalPrice || 0,
        [isAr ? "قيمة التغليف" : "Packaging"]: o.packagingFee || 0,
        [isAr ? "المبلغ المستلم" : "Paid"]: o.amountPaid || 0,
        [isAr ? "المتبقي ذمة" : "Remaining"]: o.amountRemaining || 0,
      }));
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    // Ensure sheet correctly aligns right-to-left for Arabic
    if (isAr) {
      ws["!dir"] = "rtl";
    }

    const fileName = `alx_Report_${title}_${filters.startDate}.xlsx`;

    // ─── Electron: use native Save dialog ──────────────────────────────
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.saveFile) {
      try {
        // XLSX.write returns a Uint8Array buffer
        const buffer: Uint8Array = XLSX.write(wb, {
          bookType: "xlsx",
          type: "buffer",
        });
        const result = await electronAPI.saveFile({
          defaultName: fileName,
          filters: [
            { name: "Excel Files", extensions: ["xlsx"] },
            { name: "All Files", extensions: ["*"] },
          ],
          buffer: Array.from(buffer), // Transfer as plain array via IPC
        });

        if (!result.success) {
          if (result.reason !== "canceled") {
            notificationService.notify({
              title: isAr ? "خطأ في الحفظ" : "Save Error",
              message:
                result.reason ||
                (isAr ? "فشل حفظ الملف" : "Failed to save file"),
              type: "error",
            });
          }
          return;
        }

        notificationService.notify({
          title: isAr ? "تم تصدير الدفتر بنجاح" : "Export Successful",
          message: isAr
            ? `تم إنشاء كشوف السجلات وحفظها بنجاح في: ${result.filePath}`
            : `Financial spreadsheet saved to: ${result.filePath}`,
          type: "success",
        });
        return;
      } catch (ipcErr: any) {
        console.warn(
          "[Export] Electron IPC save failed, falling back to browser download:",
          ipcErr
        );
      }
    }

    // ─── Browser fallback (web / dev mode) ─────────────────────────────
    XLSX.writeFile(wb, fileName);

    notificationService.notify({
      title: isAr ? "تم تصدير الدفتر بنجاح" : "Success",
      message: isAr
        ? "تم إنشاء كشوف السجلات وتنزيلها بصيغة XLSX احترافية"
        : "Financial Spreadsheet compiled and downloaded.",
      type: "success",
    });
  };

  // Modern Native Print implementation — Electron aware
  const triggerNativePrint = async () => {
    const electronAPI = (window as any).electronAPI;

    // ─── Electron: use WebContents print API ───────────────────────────
    if (electronAPI?.printPage) {
      try {
        // Determine page settings from printSettings
        const isLandscape =
          (printSettings.paperSize as string) === "A4_Landscape";
        const isReceipt =
          printSettings.paperSize === "80mm" ||
          printSettings.paperSize === "58mm";
        const result = await electronAPI.printPage({
          silent: false,
          printBackground: true,
          pageSize: isReceipt ? "A5" : "A4",
          landscape: isLandscape,
          marginTop:
            printSettings.margins === "none"
              ? 0
              : printSettings.margins === "minimal"
                ? 5
                : 10,
          marginBottom:
            printSettings.margins === "none"
              ? 0
              : printSettings.margins === "minimal"
                ? 5
                : 10,
          marginLeft:
            printSettings.margins === "none"
              ? 0
              : printSettings.margins === "minimal"
                ? 5
                : 10,
          marginRight:
            printSettings.margins === "none"
              ? 0
              : printSettings.margins === "minimal"
                ? 5
                : 10,
        });
        if (!result.success) {
          console.warn("[Print] Electron print failed:", result.reason);
          // Fallback to window.print()
          window.print();
        }
        return;
      } catch (err) {
        console.warn("[Print] Electron IPC print failed, fallback:", err);
      }
    }

    // ─── Browser fallback ───────────────────────────────────────────────
    const reportTitle = isAr ? "تقرير نظام ALX" : "ALX System Report";
    printContent(reportTitle, "print-invoice-canvas", isAr);
  };

  if (loading || roleLoading) {
    return (
      <div className="flex bg-[#0a0a0c] text-white h-[85vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#d4af37]/10 border-t-[#d4af37]"></div>
          <span className="text-xs font-bold text-slate-500 animate-pulse">
            {isAr
              ? "مستودع السجلات والمزامنة قيد التحميل..."
              : "Synchronizing Vault Nodes..."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 text-start font-sans relative w-full max-w-full overflow-hidden">
      {/* Arabic Print-Friendly Stylesheet overrides browser default layout during printing */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          /* Hide everything except the print canvas wrapper */
          body * {
            visibility: hidden;
            background: transparent !important;
          }
          #print-invoice-canvas, #print-invoice-canvas * {
            visibility: visible;
          }
          #print-invoice-canvas {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            background: white !important;
            color: black !important;
            font-family: "${printSettings.fontFamily || "Cairo"}", sans-serif !important;
            padding: ${printSettings.margins === "none" ? "0mm" : printSettings.margins === "minimal" ? "5mm" : "12mm"} !important;
            box-shadow: none !important;
            border: none !important;
            direction: rtl !important;
            font-size: ${printSettings.fontSize === "xs" ? "10px" : printSettings.fontSize === "sm" ? "12px" : printSettings.fontSize === "md" ? "14px" : "16px"} !important;
          }
          /* Custom sizes overrides */
          ${
            printSettings.paperSize === "80mm"
              ? `
            @page { size: 80mm auto; margin: 0; }
            #print-invoice-canvas { width: 80mm !important; }
          `
              : printSettings.paperSize === "58mm"
                ? `
            @page { size: 58mm auto; margin: 0; }
            #print-invoice-canvas { width: 58mm !important; }
          `
                : printSettings.paperSize === "A4_Landscape"
                  ? `
            @page { size: A4 landscape; margin: 10mm; }
          `
                  : `
            @page { size: A4; margin: 10mm; }
          `
          }
          .no-print {
            display: none !important;
          }
        }
      `,
        }}
      />

      {/* Modern Dashboard Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-black/40 backdrop-blur-md border border-[#d4af37]/20 p-6 rounded-3xl shadow-lg relative overflow-hidden gap-4 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-[#d4af37]/10 border border-[#d4af37]/25 p-3 rounded-2xl text-[#d4af37]">
            <Layers className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white leading-none mb-1">
              {isAr
                ? "الإدارة المالية والقوالب الذكية"
                : "Financial Hub & Templates"}
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">
              {isAr
                ? "كشوف عهد ذمم مستقلة • مصادقة القيود • محرر تصاميم الفواتير والحراريات"
                : "Enterprise Ledgering • Dynamic Print Templates"}
            </p>
          </div>
        </div>

        {/* Navigation Tabs between Reports View and Report Settings Template Edit */}
        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-900 self-stretch md:self-auto justify-stretch">
          <button
            onClick={() => setActiveTab("reports")}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${activeTab === "reports" ? "bg-[#d4af37] text-black" : "text-slate-400 hover:text-white"}`}
          >
            <Layers className="w-4 h-4" />
            {isAr ? "السجلات والتقارير" : "Analytical Reports"}
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${activeTab === "templates" ? "bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20" : "text-slate-400 hover:text-white"}`}
          >
            <SettingsIcon className="w-4 h-4" />
            {isAr ? "إعدادات قوالب الطباعة" : "Templates Config"}
          </button>
        </div>
      </div>

      {activeTab === "reports" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start no-print">
          {/* LEFT: Reports Tree Menu Navigation Sidebar */}
          <div className="lg:col-span-4 bg-[#111114] border border-slate-850 p-3 rounded-3xl space-y-1 block">
            <h3 className="px-4 py-2 text-[10px] font-black text-slate-550 uppercase tracking-widest border-b border-slate-850/40 mb-2">
              {isAr ? "سجلات النظام المحاسبية والتقريرية" : "Ledger Categories"}
            </h3>
            <div className="space-y-1">
              {REPORT_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => {
                    setActiveReport(type.id);
                    // Reset selected filters corresponding to switch
                    setFilters(prev => ({
                      ...prev,
                      accountId: undefined,
                      entityId: undefined,
                    }));
                    setSearchTerm("");
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl transition-all border text-right ${
                    activeReport === type.id
                      ? "bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/30 shadow-md font-bold"
                      : "text-slate-400 hover:bg-slate-900/50 hover:text-white border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <type.icon
                      className={`w-4 h-4 shrink-0 ${activeReport === type.id ? "text-[#d4af37]" : "text-slate-500"}`}
                    />
                    <span className="text-xs font-bold leading-tight">
                      {isAr ? type.labelAr : type.labelEn}
                    </span>
                  </div>
                  {activeReport === type.id && (
                    <div className="w-1.5 h-1.5 bg-[#d4af37] rounded-full shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Micro summary */}
            <div className="pt-4 mt-2 border-t border-slate-850 p-3 space-y-2 text-xs">
              <span className="text-[10px] font-black text-slate-550 block uppercase">
                {isAr ? "مستخلص التدقيق الحالي" : "Live Sync Health"}
              </span>
              <div className="flex justify-between text-slate-400">
                <span>{isAr ? "إجمالي فواتير الطلبات:" : "Total Orders:"}</span>
                <span className="font-mono font-bold text-white">
                  {orders.length}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{isAr ? "إجمالي سندات الصرف:" : "Total Receipts:"}</span>
                <span className="font-mono font-bold text-white">
                  {expenses.length}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{isAr ? "شجرة الحسابات النشطة:" : "Chart Nodes:"}</span>
                <span className="font-mono font-bold text-[#d4af37]">
                  {accounts.length}
                </span>
              </div>
            </div>

            {/* Saved Custom templates list */}
            <div className="pt-4 mt-4 border-t border-slate-850 p-3 space-y-2 text-xs">
              <span className="text-[10px] font-black text-slate-550 block uppercase flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-[#d4af37]" />
                {isAr
                  ? "التقارير المخصصة والفلترات المحفوظة"
                  : "Saved Custom Views"}
              </span>
              {savedReportTemplates.length === 0 ? (
                <p className="text-[10px] text-slate-500 italic mt-1.5">
                  {isAr
                    ? "لا توجد فلترات مخصصة محفوظة حالياً."
                    : "No saved presets available."}
                </p>
              ) : (
                <div className="space-y-1.5 mt-2 max-h-[220px] overflow-y-auto pr-1">
                  {savedReportTemplates.map(tpl => {
                    const rType = REPORT_TYPES.find(
                      r => r.id === tpl.activeReport
                    );
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleApplyFilterTemplate(tpl)}
                        className="group flex items-center justify-between p-2 rounded-xl bg-slate-950/80 hover:bg-[#d4af37]/5 border border-slate-900 hover:border-[#d4af37]/20 cursor-pointer transition text-right"
                      >
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          <span className="font-bold text-[11px] text-white truncate">
                            {tpl.name}
                          </span>
                          <span className="text-[9px] text-slate-500 font-bold truncate">
                            {isAr ? rType?.labelAr : rType?.labelEn}
                          </span>
                        </div>
                        <button
                          onClick={e => handleDeleteFilterTemplate(tpl.id, e)}
                          className="p-1 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition shrink-0 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Analytical content panels */}
          <div className="lg:col-span-8 space-y-6">
            <ReportsContextFilters
              isAr={isAr}
              activeReport={activeReport}
              filters={filters}
              onFilterChange={(field, value) =>
                setFilters(prev => ({ ...prev, [field]: value }))
              }
              expenseCategories={EXPENSE_CATEGORIES_DYNAMIC}
              accounts={accounts}
              customers={customers}
              couriers={couriers}
              users={users}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              showSaveTemplateForm={showSaveTemplateForm}
              onToggleSaveTemplateForm={() =>
                setShowSaveTemplateForm(!showSaveTemplateForm)
              }
              onCloseSaveTemplateForm={() => {
                setShowSaveTemplateForm(false);
                setNewTemplateName("");
              }}
              newTemplateName={newTemplateName}
              onTemplateNameChange={setNewTemplateName}
              onSaveFilterTemplate={handleSaveFilterTemplate}
              isSavingFilterTemplate={isSavingFilterTemplate}
              onOpenPrintSettings={() => setIsPreviewModalOpen(true)}
              onExportExcel={handleExportExcel}
              sortBy={sortBy}
              onSortByChange={value => setSortBy(value)}
              sortOrder={sortOrder}
              onSortOrderToggle={() =>
                setSortOrder(previous => (previous === "asc" ? "desc" : "asc"))
              }
            />

            {/* LIVE DISPLAY AREA */}
            <div className="bg-[#111114] border border-slate-850 rounded-3xl p-6 min-h-[450px]">
              <ReportsTabContent
                activeReport={activeReport}
                isAr={isAr}
                filteredData={filteredData}
                reportMetrics={reportMetrics}
                treasuryBalances={treasuryBalances}
                pnlData={pnlData}
                EXPENSE_CATEGORIES_DYNAMIC={EXPENSE_CATEGORIES_DYNAMIC}
                selectedExpenseCategory={selectedExpenseCategory}
                setSelectedExpenseCategory={setSelectedExpenseCategory}
                accountTransactions={accountTransactions}
                accounts={accounts}
                ledgerMetrics={ledgerMetrics}
                searchMatchList={searchMatchList}
                convertToYER={convertToYER}
                convertCurrency={convertCurrency}
                selectedPackagingAccountIds={selectedPackagingAccountIds}
                setSelectedPackagingAccountIds={setSelectedPackagingAccountIds}
                selectedOrdersCostAccountIds={selectedOrdersCostAccountIds}
                setSelectedOrdersCostAccountIds={
                  setSelectedOrdersCostAccountIds
                }
                selectedShippingCompaniesAccountIds={
                  selectedShippingCompaniesAccountIds
                }
                setSelectedShippingCompaniesAccountIds={
                  setSelectedShippingCompaniesAccountIds
                }
                selectedOrderId={selectedOrderId}
                setSelectedOrderId={setSelectedOrderId}
                selectedCustomerId={selectedCustomerId}
                setSelectedCustomerId={setSelectedCustomerId}
                selectedCourierId={selectedCourierId}
                setSelectedCourierId={setSelectedCourierId}
                selectedCompanyId={selectedCompanyId}
                setSelectedCompanyId={setSelectedCompanyId}
                selectedUserId={selectedUserId}
                setSelectedUserId={setSelectedUserId}
                handleSaveAccountSelection={handleSaveAccountSelection}
                MultiAccountSelectorComponent={MultiAccountSelector}
              />
            </div>

            {/* Smart PDF export advice panel to prevent garbled letters error */}
            <div className="bg-[#121215] border border-[#d4af37]/25 p-5 rounded-3xl flex items-start gap-4">
              <AlertCircle className="w-5 h-5 text-[#d4af37] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider mb-1">
                  {isAr
                    ? "ملاحظة بخصوص جودة طباعة وتصدير التقارير العربية"
                    : "Pristine Vector Printing & PDF Export Guide"}
                </h4>
                <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
                  {isAr
                    ? 'لتجنب تشوه الخطوط العربية وظهور الرموز العشوائية في ملفات PDF الناتجة بصورة تقليدية، نقوم بتطبيق نظام الطباعة المعياري عالي الكفاءة. اضغط على زر "معاينة وطباعة القالب" ثم اختر "حفظ بتنسيق PDF" من نافذة طباعة النظام المتطورة. يضمن هذا الإجراء تحويل المستند بالكامل بنظام المتجهات النحيف (Vector Form) وبجميع خطوط الطراز العربي الأصيلة والمحاذاة التامة RTL.'
                    : 'To ensure 100% accurate Arabic rendering without encoding corruption, we highly recommend utilizing the browser Standard Printing dialog. Click "Save as PDF" directly from the browser window after initiating live printing to capture pristine vector scripts and RTL alignment.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <PrintDesignerPageTab
          isAr={isAr}
          printSettings={printSettings}
          setPrintSettings={setPrintSettings}
          savingTemplate={savingTemplate}
          handleSavePrintSettings={handleSavePrintSettings}
          handleResetPrintSettings={() =>
            setPrintSettings(DEFAULT_PRINT_SETTINGS)
          }
        />
      )}

      <ReportPrintPreviewModal
        isPreviewModalOpen={isPreviewModalOpen}
        setIsPreviewModalOpen={setIsPreviewModalOpen}
        isAr={isAr}
        printSettings={printSettings}
        activeReport={activeReport}
        selectedOrderId={selectedOrderId}
        selectedCustomerId={selectedCustomerId}
        selectedCourierId={selectedCourierId}
        selectedCompanyId={selectedCompanyId}
        selectedUserId={selectedUserId}
        selectedExpenseCategory={selectedExpenseCategory}
        filters={filters}
        orders={orders}
        customers={customers}
        couriers={couriers}
        shippingCompanies={shippingCompanies}
        users={users}
        expenses={expenses}
        filteredData={filteredData}
        reportMetrics={reportMetrics}
        accountTransactions={accountTransactions}
        ledgerMetrics={ledgerMetrics}
        initialPrintZoomScale={0.8}
        triggerNativePrint={triggerNativePrint}
        convertToYER={convertToYER}
        convertCurrency={convertCurrency}
      />
    </div>
  );
}
