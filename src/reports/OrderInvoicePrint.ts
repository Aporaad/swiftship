// دوال طباعة فاتورة الطلب — مفصولة من Orders.tsx
import { printContent } from '../lib/printUtils';
import { activityLogService } from '../services/activityLogService';

/**
 * generateOrderInvoicePDF
 * توليد وطباعة فاتورة طلب بصيغة HTML قابلة للطباعة
 */
export function generateOrderInvoicePDF(
  order: any,
  isAr: boolean,
  settings: any
): void {
  if (!order) return;

  const invoiceHtml = `
    <div style="font-family: 'Cairo', sans-serif; color: #111;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 3px double #d4af37; padding-bottom: 20px;">
        <div>
          <h1 style="margin: 0; color: #111; font-size: 28px;">${isAr ? 'فاتورة ضريبية' : 'Tax Invoice'}</h1>
          <p style="margin: 8px 0; font-size: 14px;"><strong>${isAr ? 'رقم الطلب' : 'Order #'}:</strong> <span style="font-family: monospace;">${order.orderNumber || '—'}</span></p>
          <p style="margin: 8px 0; font-size: 14px;"><strong>${isAr ? 'التاريخ' : 'Date'}:</strong> ${new Date(order.createdAt || Date.now()).toLocaleDateString()}</p>
        </div>
        <div style="text-align: right;">
           <h2 style="margin: 0; color: #d4af37; font-size: 24px;">${settings.systemName || settings.companyName || 'AL-XPRESS'}</h2>
           <p style="margin: 5px 0; font-size: 13px;">${settings.companyPhone || ''}</p>
           <p style="margin: 5px 0; font-size: 13px;">${settings.companyEmail || ''}</p>
           <p style="margin: 5px 0; font-size: 13px;">${settings.companyAddress || ''}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px;">
        <div style="background: #f8f8fa; padding: 20px; border-radius: 12px; border-right: 4px solid #d4af37;">
          <h3 style="margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 10px; font-size: 16px;">${isAr ? 'بيانات العميل المستلم' : 'Bill To (Recipient)'}</h3>
          <p style="margin: 8px 0;"><strong>${isAr ? 'الاسم' : 'Name'}:</strong> ${order.customerName || '—'}</p>
          <p style="margin: 8px 0;"><strong>${isAr ? 'الهاتف' : 'Phone'}:</strong> ${order.customerPhone || '—'}</p>
          <p style="margin: 8px 0;"><strong>${isAr ? 'العنوان' : 'Address'}:</strong> ${order.customerAddress || '—'}</p>
        </div>
        <div style="background: #f8f8fa; padding: 20px; border-radius: 12px; border-right: 4px solid #334155;">
          <h3 style="margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 10px; font-size: 16px;">${isAr ? 'تفاصيل الشحن واللوجستيات' : 'Shipping & Logistics'}</h3>
          <p style="margin: 8px 0;"><strong>${isAr ? 'الحالة' : 'Status'}:</strong> ${order.orderStatus || '—'}</p>
          <p style="margin: 8px 0;"><strong>${isAr ? 'المصدر' : 'Source'}:</strong> ${order.orderSourceName || '—'}</p>
          <p style="margin: 8px 0;"><strong>${isAr ? 'رقم التتبع' : 'Tracking'}:</strong> <span style="font-family: monospace;">${order.trackingNumber || '—'}</span></p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #1e293b; color: white;">
            <th style="padding: 12px; border: 1px solid #334155; text-align: ${isAr ? 'right' : 'left'};">${isAr ? 'وصف المنتج' : 'Item Description'}</th>
            <th style="padding: 12px; border: 1px solid #334155; text-align: center;">${isAr ? 'الكمية' : 'Qty'}</th>
            <th style="padding: 12px; border: 1px solid #334155; text-align: center;">${isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
            <th style="padding: 12px; border: 1px solid #334155; text-align: center;">${isAr ? 'الإجمالي' : 'Subtotal'}</th>
          </tr>
        </thead>
        <tbody>
          ${(order.items || []).length > 0
      ? (order.items || []).map((item: any) => `
              <tr>
                <td style="padding: 12px; border: 1px solid #eee;">${item.productName || item.name || '—'}</td>
                <td style="padding: 12px; border: 1px solid #eee; text-align: center;">${item.quantity || 1}</td>
                <td style="padding: 12px; border: 1px solid #eee; text-align: center;">${(parseFloat(item.productPrice || item.price || 0)).toLocaleString()} SAR</td>
                <td style="padding: 12px; border: 1px solid #eee; text-align: center;">${((item.quantity || 1) * (parseFloat(item.productPrice || item.price || 0))).toLocaleString()} SAR</td>
              </tr>
            `).join('')
      : `
              <tr>
                <td colspan="4" style="padding: 20px; text-align: center; color: #999;">${isAr ? 'لا توجد أصناف مسجلة' : 'No items registered'}</td>
              </tr>
            `}
        </tbody>
      </table>

      <div style="margin-right: auto; margin-left: ${isAr ? '0' : 'auto'}; width: 350px; background: #f8f8fa; padding: 20px; border-radius: 12px; border: 1px solid #eee;">
         <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
           <span style="font-weight: 700;">${isAr ? 'إجمالي المنتجات (SAR):' : 'Products Total (SAR):'}</span>
           <span>${(order.totalCostSAR || 0).toLocaleString()} SAR</span>
         </div>
         ${parseFloat(order.shippingCostSAR || 0) > 0 ? `
         <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
           <span>${isAr ? 'تكلفة الشحن الدولي (SAR):' : 'International Shipping (SAR):'}</span>
           <span>${parseFloat(order.shippingCostSAR || 0).toLocaleString()} SAR</span>
         </div>` : ''}
         <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 8px; font-weight: 800; font-size: 18px; color: #111;">
           <span>${isAr ? 'الإجمالي الكلي (YER):' : 'Grand Total (YER):'}</span>
           <span>${(parseFloat(order.amountPaid || 0) + parseFloat(order.amountRemaining || 0)).toLocaleString()} YER</span>
         </div>
         <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: #059669; font-weight: 800;">
           <span>${isAr ? 'المبلغ المدفوع (YER):' : 'Amount Paid (YER):'}</span>
           <span>${parseFloat(order.amountPaid || 0).toLocaleString()} YER</span>
         </div>
         <div style="display: flex; justify-content: space-between; margin-top: 5px; color: #dc2626; font-weight: 800; font-size: 20px; border-top: 2px solid #dc2626; padding-top: 10px;">
           <span>${isAr ? 'المبلغ المتبقي (YER):' : 'Balance Due (YER):'}</span>
           <span>${parseFloat(order.amountRemaining || 0).toLocaleString()} YER</span>
         </div>
      </div>
      
      <div style="margin-top: 50px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
        <p>${settings.invoiceNotes || (isAr ? 'شكراً لتعاملكم معنا! تم إنشاء هذه الفاتورة آلياً.' : 'Thank you for your business! Generated automatically.')}</p>
      </div>
    </div>
  `;

  printContent(isAr ? 'فاتورة طلب' : 'Order Invoice', invoiceHtml, isAr);
  activityLogService.log('export_orders_pdf', order.orderNumber || order.id, { singleOrder: true });
}
