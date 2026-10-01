// دوال تصدير قائمة الطلبات — مفصولة من Orders.tsx
import { printContent } from '../lib/printUtils';
import { activityLogService } from '../services/activityLogService';
import type { OrderRecord } from '../features/orders/types';

function orderDate(value: OrderRecord['createdAt']): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
}

function orderAmount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * exportOrdersToPDF
 * طباعة كشف الشحنات والطلبيات
 */
export function exportOrdersToPDF(
  filteredOrdersList: OrderRecord[],
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
  filteredOrdersList: OrderRecord[],
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
      `"${orderDate(o.createdAt).toLocaleDateString()}"`,
      `"${(o.customerName || '').replace(/"/g, '""')}"`,
      `"${o.customerPhone || ''}"`,
      `"${o.orderStatus || ''}"`,
      `"${o.orderSourceName || o.orderSourceType || ''}"`,
      (orderAmount(o.amountPaid) + orderAmount(o.amountRemaining)),
      orderAmount(o.amountPaid),
      orderAmount(o.amountRemaining)
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
