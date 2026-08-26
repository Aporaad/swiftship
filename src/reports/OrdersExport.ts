// دوال تصدير قائمة الطلبات — مفصولة من Orders.tsx
import { printContent } from '../lib/printUtils';
import { activityLogService } from '../services/activityLogService';

/**
 * exportOrdersToPDF
 * طباعة كشف الشحنات والطلبيات
 */
export function exportOrdersToPDF(
  filteredOrdersList: any[],
  isAr: boolean
): void {
  const reportTitle = isAr ? 'كشف حركة الشحنات والطلبيات' : 'Logistics Orders Ledger';
  printContent(reportTitle, 'orders-ledger-table', isAr);

  activityLogService.log('export_orders_pdf', `Orders list report`, {
    count: filteredOrdersList.length
  });
}

/**
 * exportOrdersToCSV
 * تصدير قائمة الطلبات إلى ملف CSV
 */
export function exportOrdersToCSV(
  filteredOrdersList: any[],
  isAr: boolean
): void {
  const headers = [
    isAr ? 'رقم الطلب' : 'Smart Code',
    isAr ? 'التاريخ' : 'Created At',
    isAr ? 'اسم العميل' : 'Customer Name',
    isAr ? 'هاتف العميل' : 'Customer Phone',
    isAr ? 'حالة الطلب' : 'Status',
    isAr ? 'تأكيد الحساب' : 'Source Node',
    isAr ? 'تكلفة التوصيل (ريال)' : 'Cost YER',
    isAr ? 'المدفوع كاش (ريال)' : 'Paid YER',
    isAr ? 'المتبقي ذمة (ريال)' : 'Balance YER'
  ];

  const csvLines = [headers.join(',')];

  filteredOrdersList.forEach(o => {
    const row = [
      `"${o.orderNumber || ''}"`,
      `"${new Date(o.createdAt || Date.now()).toLocaleDateString()}"`,
      `"${(o.customerName || '').replace(/"/g, '""')}"`,
      `"${o.customerPhone || ''}"`,
      `"${o.orderStatus || ''}"`,
      `"${o.orderSourceName || o.orderSourceType || ''}"`,
      (parseFloat(o.amountPaid || 0) + parseFloat(o.amountRemaining || 0)),
      o.amountPaid || 0,
      o.amountRemaining || 0
    ];
    csvLines.push(row.join(','));
  });

  const csvContent = "\uFEFF" + csvLines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `AlXpress_Orders_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  activityLogService.log('export_orders_csv', `Orders list CSV`, {
    count: filteredOrdersList.length
  });
}
