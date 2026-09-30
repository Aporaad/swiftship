import React from 'react';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';
import { PrintTemplateSettings } from './PrintTemplateDesignerTab';

interface ReportPrintPreviewModalProps {
  isPreviewModalOpen: boolean;
  setIsPreviewModalOpen: (open: boolean) => void;
  isAr: boolean;
  printSettings: PrintTemplateSettings;
  activeReport: string;
  selectedOrderId: string | null;
  selectedCustomerId: string | null;
  selectedCourierId: string | null;
  selectedCompanyId: string | null;
  selectedUserId: string | null;
  selectedExpenseCategory: string | null;
  filters: any;
  orders: any[];
  customers: any[];
  couriers: any[];
  shippingCompanies: any[];
  users: any[];
  expenses: any[];
  filteredData: any;
  reportMetrics: any;
  accountTransactions: any[];
  triggerNativePrint: () => void;
  convertToYER: (amount: number, currency: string) => number;
}

export const ReportPrintPreviewModal: React.FC<ReportPrintPreviewModalProps> = ({
  isPreviewModalOpen,
  setIsPreviewModalOpen,
  isAr,
  printSettings,
  activeReport,
  selectedOrderId,
  selectedCustomerId,
  selectedCourierId,
  selectedCompanyId,
  selectedUserId,
  selectedExpenseCategory,
  filters,
  orders,
  customers,
  couriers,
  shippingCompanies,
  users,
  expenses,
  filteredData,
  reportMetrics,
  accountTransactions,
  triggerNativePrint,
  convertToYER,
}) => {
  const [printZoomScale, setPrintZoomScale] = React.useState<number>(0.85);
  const convertCurrency = (val: number, _from?: string, _to?: string) => val;
  const ledgerMetrics = { totalDebit: 0, totalCredit: 0, balance: 0, displayRows: [] };

  if (!isPreviewModalOpen) return null;

  return (
    <>
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-[#0c0c0f] border border-[#d4af37]/30 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col font-sans">

            {/* Header overlay */}
            <div className="bg-black/40 p-5 border-b border-slate-850 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-md font-black text-white">{isAr ? 'نافذة اعتماد وطباعة القيود والسجلات الموحدة' : 'Unified Voucher Standard Printing Dialog'}</h3>
                <p className="text-xs text-slate-500 mt-1">{isAr ? 'هذا المستند يتوافق مع إعدادات قالب الطباعة النشط لتجنب تشوه الخطوط العربية' : 'Active PDF and paper print matching your template style.'}</p>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-1 px-3 text-xs font-black rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>

            {/* Zoom / Scale Controller Overlay */}
            <div className="bg-slate-950 px-5 py-2.5 border-b border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 text-xs text-slate-350">
              <div className="flex items-center gap-2">
                <span className="text-slate-450 font-bold">{isAr ? 'مستوى تكبير/تصغير المعاينة بالملفات الشاشة:' : 'Screen Zoom Level:'}</span>
                <span className="font-mono text-[#d4af37] font-black">{Math.round(printZoomScale * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintZoomScale(prev => Math.max(0.4, prev - 0.05))}
                  className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center font-bold text-white border border-slate-800 hover:border-[#d4af37]/35 transition text-xs select-none"
                >
                  -
                </button>
                <input
                  type="range"
                  min="0.3"
                  max="1.5"
                  step="0.05"
                  value={printZoomScale}
                  onChange={(e) => setPrintZoomScale(parseFloat(e.target.value))}
                  className="w-28 sm:w-40 accent-[#d4af37]"
                />
                <button
                  type="button"
                  onClick={() => setPrintZoomScale(prev => Math.min(1.5, prev + 0.05))}
                  className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center font-bold text-white border border-slate-800 hover:border-[#d4af37]/35 transition text-xs select-none"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setPrintZoomScale(0.85)}
                  className="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-300 font-bold hover:text-white rounded text-[10px]"
                >
                  {isAr ? 'إعادة ضبط' : 'Reset'}
                </button>
              </div>
              <button
                type="button"
                onClick={triggerNativePrint}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#d4af37] hover:bg-yellow-500 text-black font-black rounded-xl text-xs transition shadow-md"
              >
                <Printer className="w-3.5 h-3.5" />
                {isAr ? 'طباعة المستند الآن' : 'Print Document'}
              </button>
            </div>

            {/* Printable Frame content */}
            <div className="flex-1 overflow-x-auto overflow-y-auto p-4 md:p-8 flex justify-center bg-slate-950/40">

              {/* Scale container wrapping the target print canvas */}
              <div
                style={{
                  transform: `scale(${printZoomScale})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.1s ease-out',
                  height: `${297 * printZoomScale}mm`,
                  width: printSettings.paperSize === '80mm' ? '80mm' : printSettings.paperSize === '58mm' ? '58mm' : '210mm'
                }}
                className="shrink-0 animate-fade-in"
              >

                {/* PRINT CANVAS TARGET: Will be the unique component shown on print */}
                <div
                  id="print-invoice-canvas"
                  className="bg-white text-black p-8 shadow-2xl relative border border-slate-300 text-start"
                  style={{
                    width: printSettings.paperSize === '80mm' ? '80mm' : printSettings.paperSize === '58mm' ? '58mm' : '100%',
                    maxWidth: ['80mm', '58mm'].includes(printSettings.paperSize) ? 'none' : '210mm',
                    minHeight: '297mm',
                    boxSizing: 'border-box',
                    fontFamily: `"${(printSettings as any).fontFamily || 'Cairo'}", sans-serif`,
                    fontSize: printSettings.fontSize === 'xs' ? '11px' : printSettings.fontSize === 'sm' ? '13px' : printSettings.fontSize === 'md' ? '15px' : '17px'
                  }}
                >

                  {/* Logo Section */}
                  {printSettings.showLogo && (
                    <div className="flex justify-center mb-6 pb-4 border-b border-slate-200">
                      {printSettings.logoUrl ? (
                        <img src={printSettings.logoUrl} alt="Logo" className="h-12 object-contain max-w-[210px] p-1 bg-white rounded" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-mono font-black" style={{ backgroundColor: printSettings.primaryColor }}>SS</div>
                          <span className="font-mono font-black text-[13px] tracking-widest text-[#000000]">SWIFTSHIP LOGISTICS</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Print Title Header */}
                  <div className="text-center space-y-1 mb-6">
                    <h2 className="font-extrabold text-[18px] leading-tight" style={{ color: printSettings.primaryColor }}>{printSettings.headerTitleAr}</h2>
                    <h3 className="font-mono font-bold text-[12px] text-slate-600 tracking-wider uppercase leading-none">{printSettings.headerTitleEn}</h3>
                    <p className="text-[11px] text-slate-500 font-bold">{printSettings.subtitleAr}</p>
                    <p className="text-[10px] font-mono text-slate-400 font-semibold uppercase">{printSettings.subtitleEn}</p>
                  </div>

                  {/* Subtitle banner */}
                  <div className="border border-slate-300 bg-slate-100 p-3 rounded-lg text-center font-bold text-[13px] mb-6">
                    <span>
                      {(() => {
                        if (activeReport === 'orders_cost') {
                          return selectedOrderId ? (isAr ? `تقرير تفاصيل شحنة الطلب رقم: ${selectedOrderId}` : `Detailed Statement for Shipment: ${selectedOrderId}`) : (isAr ? 'تقرير ومكاسب تكاليف الطلبات والشحنات المجمعة' : 'All Orders Cost Summary Ledger');
                        }
                        if (activeReport === 'customers') {
                          return selectedCustomerId ? (isAr ? `كشف حساب تفصيلي للعميل: ${customers.find(c => c.id === selectedCustomerId)?.fullName || ''}` : `Detailed Account Statement: ${customers.find(c => c.id === selectedCustomerId)?.fullName || ''}`) : (isAr ? 'كشف تفصيلي بالعملاء والذمم والمديونيات' : 'Customers Outstanding Balances Ledger');
                        }
                        if (activeReport === 'couriers') {
                          return selectedCourierId ? (isAr ? `سجل تصفية عهدة المندوب: ${couriers.find(c => c.id === selectedCourierId)?.fullName || ''}` : `Courier Custody Statement: ${couriers.find(c => c.id === selectedCourierId)?.fullName || ''}`) : (isAr ? 'تقرير عهد وتحصيل وتوزيع المندوبين الكلي' : 'Couriers Collection & Custodies Summary');
                        }
                        if (activeReport === 'shipping_companies') {
                          return selectedCompanyId ? (isAr ? `كشف حساب شركة الشحن: ${selectedCompanyId}` : `Shipping Carrier Statement: ${selectedCompanyId}`) : (isAr ? 'تقرير شركات الشحن والعمولات اللوجستية العامة' : 'Partner Carriers & Commissions Audit');
                        }
                        if (activeReport === 'users') {
                          return selectedUserId ? (isAr ? `مسير رواتب وعمولات الموظف: ${users.find(u => u.id === selectedUserId)?.fullName || ''}` : `Employee Payroll Voucher: ${users.find(u => u.id === selectedUserId)?.fullName || ''}`) : (isAr ? 'تقرير الموظفين والرواتب والعمولات المجمعة' : 'Corporate Payroll & Employee Matrix');
                        }
                        if (activeReport === 'expenses') {
                          return selectedExpenseCategory ? (isAr ? `كشف مصرفات ونفقات فئة: ${selectedExpenseCategory}` : `Categorized Expense Statement: ${selectedExpenseCategory}`) : (isAr ? 'تقرير المصروفات والمدفوعات المتنوعة المجمعة' : 'Operating Expenses Ledger Dashboard');
                        }
                        if (activeReport === 'packaging') {
                          return (isAr ? 'تقرير رسوم التغليف والتعبئة وتكاليف شحن محلي' : 'Packaging and wrapping fees statement');
                        }
                        if (activeReport === 'account_ledger') {
                          return (isAr ? 'كشف الحساب التفصيلي للتدقيق المحاسبي الموحد' : 'Unified Accounting Ledger General Audit');
                        }
                        return (isAr ? 'تقرير نظام ألكس للخدمات اللوجستية' : 'alx Logistics Custom Export Document');
                      })()}
                    </span>
                  </div>

                  {/* Parameters specs metadesk */}
                  <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 border-b pb-4 mb-6">
                    <div>
                      <span>{isAr ? 'الفترة الزمنية:' : 'Statement Period:'} </span>
                      <strong className="text-black font-semibold">{filters.startDate} {isAr ? 'إلى' : 'to'} {filters.endDate}</strong>
                    </div>
                    <div className="text-right">
                      <span>{isAr ? 'تاريخ وقت الطباعة:' : 'Date Issued:'} </span>
                      <strong className="text-black font-mono">{format(new Date(), 'yyyy-MM-dd HH:mm')}</strong>
                    </div>
                    <div>
                      <span>{isAr ? 'الرقابة والترخيص الضريبي:' : 'Corporate Tax ID:'} </span>
                      <strong className="text-black font-mono">{printSettings.taxNumber}</strong>
                    </div>
                    <div className="text-right">
                      <span>{isAr ? 'نوع المستند والتقرير:' : 'Document Classification:'} </span>
                      <strong className="text-black uppercase font-bold">{activeReport} {selectedOrderId || selectedCustomerId || selectedCourierId || selectedCompanyId || selectedUserId || selectedExpenseCategory ? ' (DETAIL)' : ' (INDEX)'}</strong>
                    </div>
                  </div>

                  {/* Table details containing real filtered data rows */}
                  <div className="mb-8">
                    {(() => {
                      // 1. Order Detail Printout card
                      if (activeReport === 'orders_cost' && selectedOrderId !== null) {
                        const o = orders.find(ord => ord.id === selectedOrderId || ord.orderNumber === selectedOrderId);
                        if (!o) return <p className="text-center py-4 font-bold text-slate-500">{isAr ? 'الطلب غير متوفر' : 'Order not found'}</p>;
                        return (
                          <div className="space-y-4 text-xs">
                            <h4 className="font-extrabold text-[#000] border-b pb-1 text-sm">{isAr ? 'تفاصيل شحنة الطلب وعقد النقل' : 'Detailed Freight Invoice Logistics'}</h4>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <div><span className="text-slate-500">{isAr ? 'رقم الطلب:' : 'Order Ref:'}</span> <strong className="font-mono text-black">{o.orderNumber || o.id}</strong></div>
                              <div><span className="text-slate-500">{isAr ? 'تاريخ الإنشاء:' : 'Date Issued:'}</span> <span className="font-mono">{o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd') : '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'العميل المستلم:' : 'Customer Receipient:'}</span> <strong className="text-black">{o.customerName}</strong></div>
                              <div><span className="text-slate-500">{isAr ? 'هاتف الاتصال:' : 'Contact Phone:'}</span> <span className="font-mono">{o.customerPhone || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'المندوب الناقل:' : 'Courier Service:'}</span> <span>{o.courierName || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'شركة الشحن والمسار:' : 'Carrier Route:'}</span> <span>{o.shippingCompany || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'عدد القطع:' : 'Items count:'}</span> <span className="font-bold">{o.itemCount || 1}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'حالة الشحنة:' : 'Delivery status:'}</span> <span className="bg-slate-200 px-1.5 py-0.5 rounded font-black text-[9px] uppercase">{o.orderStatus}</span></div>
                            </div>

                            <table className="w-full text-xs text-right border-collapse border border-slate-300">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'البيان وتوصيف الحركة' : 'Particulars'}</th>
                                  <th className="p-2 text-right">{isAr ? 'القيمة المالية' : 'Amount'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="p-2 border-r border-slate-300">{isAr ? 'سعر قيمة شحن الطرد والأغراض' : 'Parcel Freight shipping charges'}</td>
                                  <td className="p-2 text-right font-mono font-bold">{parseFloat(o.totalPrice || '0').toLocaleString()} YER</td>
                                </tr>
                                <tr>
                                  <td className="p-2 border-r border-slate-300">{isAr ? 'تكاليف الخدمات اللوجستية ومصاريف التوريد' : 'Freight distribution & delivery fees'}</td>
                                  <td className="p-2 text-right font-mono">{(parseFloat(o.deliveryCost) || 0).toLocaleString()} YER</td>
                                </tr>
                                <tr className="bg-slate-50 font-bold border-t border-slate-300">
                                  <td className="p-2 border-r border-slate-300">{isAr ? 'المسدد من العميل فعلياً:' : 'Paid / Settled by client:'}</td>
                                  <td className="p-2 text-right font-mono text-emerald-600">{(parseFloat(o.amountPaid) || 0).toLocaleString()} YER</td>
                                </tr>
                                <tr className="bg-slate-50 font-black border-t-2 border-double border-slate-400">
                                  <td className="p-2 border-r border-slate-300 text-rose-500">{isAr ? 'الذمة المتبقية في الحساب:' : 'Outstanding Balance (Debt):'}</td>
                                  <td className="p-2 text-right font-mono text-rose-600">{(parseFloat(o.amountRemaining) || 0).toLocaleString()} YER</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      // 2. Customer statement of account
                      if (activeReport === 'customers' && selectedCustomerId !== null) {
                        const cust = customers.find(c => c.id === selectedCustomerId);
                        if (!cust) return <p className="text-center py-4 font-bold text-slate-500">Customer not found</p>;
                        const custOrders = filteredData.orders.filter(o => o.customerId === cust.id || o.customerName === cust.fullName || o.customerPhone === cust.phone);
                        const grossSum = custOrders.reduce((sum, o) => sum + convertCurrency(parseFloat(o.totalPrice) || 0, o.currency || 'YER', 'YER'), 0);
                        const paidSum = custOrders.reduce((sum, o) => sum + convertCurrency(parseFloat(o.amountPaid) || 0, o.currency || 'YER', 'YER'), 0);
                        return (
                          <div className="space-y-4 text-xs">
                            <h4 className="font-extrabold text-[#000] border-b pb-1 text-sm">{isAr ? `كشف حساب تفصيلي للعميل: ${cust.fullName}` : `Statement Of Account: ${cust.fullName}`}</h4>
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <div><span className="text-slate-500">{isAr ? 'هاتف العميل:' : 'Phone phone:'}</span> <span className="font-mono text-black font-bold">{cust.phone || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'العنوان الجغرافي:' : 'Location Address:'}</span> <span className="font-bold">{cust.address || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'العملة المسجلة:' : 'Financial Currency:'}</span> <span className="font-black text-rose-600 font-mono">{cust.financialCurrency || 'SAR'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'الرصيد الختامي للدائنية:' : 'Terminal Balance Due:'}</span> <span className="font-black text-emerald-600 font-mono">{(cust.financialBalance || 0).toLocaleString()} {cust.financialCurrency || 'SAR'}</span></div>
                            </div>

                            <span className="text-xs font-black text-slate-800 block mt-2">{isAr ? 'سجل الشحنات والطلب المالي المرتبط' : 'Customer Associated Shipments Ledger'}</span>
                            <table className="w-full text-xs text-right border-collapse border border-slate-300">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'كود الطرد' : 'Order ID'}</th>
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'التاريخ' : 'Date'}</th>
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'الحالة' : 'Status'}</th>
                                  <th className="p-2 border-r border-slate-300 text-center">{isAr ? 'المسدد' : 'Paid'}</th>
                                  <th className="p-2 text-right">{isAr ? 'المجموع' : 'Total'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {custOrders.map(o => (
                                  <tr key={o.id} className="border-b border-slate-200">
                                    <td className="p-2 border-r border-slate-300 font-mono font-bold text-yellow-600">{o.orderNumber || o.id}</td>
                                    <td className="p-2 border-r border-slate-300 text-slate-500">{o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd') : '-'}</td>
                                    <td className="p-2 border-r border-slate-300 text-stone-600 uppercase font-bold text-[9px]">{o.orderStatus}</td>
                                    <td className="p-2 border-r border-slate-300 text-center text-emerald-600 font-bold">{(parseFloat(o.amountPaid) || 0).toLocaleString()} YER</td>
                                    <td className="p-2 text-right font-mono font-bold">{parseFloat(o.totalPrice || '0').toLocaleString()} YER</td>
                                  </tr>
                                ))}
                                {custOrders.length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="p-4 text-center text-slate-400 italic">{isAr ? 'لا توجد شحنات مسجلة للعميل' : 'No shipments registered.'}</td>
                                  </tr>
                                )}
                                <tr className="bg-slate-100 font-extrabold border-t border-slate-300">
                                  <td colSpan={3} className="p-2 border-r border-slate-300 text-start">{isAr ? 'مجموع قيم العمليات والمدفوعات الكلية (YER):' : 'Sum Aggregate values (YER):'}</td>
                                  <td className="p-2 text-center text-emerald-600 font-mono">{paidSum.toLocaleString()}</td>
                                  <td className="p-2 text-right font-mono text-black">{grossSum.toLocaleString()}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      // 3. Courier custody print card
                      if (activeReport === 'couriers' && selectedCourierId !== null) {
                        const courier = couriers.find(c => c.id === selectedCourierId);
                        if (!courier) return <p className="text-center py-4 font-bold text-slate-500">Courier not found</p>;
                        const coOrders = filteredData.orders.filter(o => o.shippingCourierId === courier.id || o.deliveryCourierId === courier.id || o.courierId === courier.id || o.courierName === courier.fullName);
                        return (
                          <div className="space-y-4 text-xs">
                            <h4 className="font-extrabold text-[#000] border-b pb-1 text-sm">{isAr ? `مسند تصفية العهد والمالية للمندوب: ${courier.fullName}` : `Courier Debt & Custody Settlement: ${courier.fullName}`}</h4>
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <div><span className="text-slate-500">{isAr ? 'البريد/الهاتف:' : 'Phone:'}</span> <span className="font-mono text-black font-bold">{courier.phone || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'طريقة الحساب:' : 'Delivery Model:'}</span> <span className="font-bold">{courier.courierType === 'sourcing' ? (isAr ? 'تجميع خارجي' : 'Sourcing') : (isAr ? 'توزيع داخلي' : 'Local')}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'العهدة المالية النشطة حالياً:' : 'Active Custody balance:'}</span> <strong className="font-mono text-rose-500">{(courier.outstandingCustody || 0).toLocaleString()} {courier.financialCurrency || 'SAR'}</strong></div>
                              <div><span className="text-slate-500">{isAr ? 'الرصيد والحساب المصادق:' : 'Terminal Balance:'}</span> <strong className="font-mono text-emerald-600">{(courier.financialBalance || 0).toLocaleString()} {courier.financialCurrency || 'SAR'}</strong></div>
                            </div>

                            <span className="text-xs font-black text-slate-800 block mt-2">{isAr ? 'سجل الطرود التي استلمها المندوب للتوصيل' : 'Custody Handled Shipments Checklist'}</span>
                            <table className="w-full text-xs text-right border-collapse border border-slate-300">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'كود الطرد' : 'Order ID'}</th>
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'توصيل العميل' : 'Receipient'}</th>
                                  <th className="p-2 border-r border-slate-300 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                                  <th className="p-2 text-right">{isAr ? 'العهدة المستحقة' : 'Due Custody'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {coOrders.map(o => (
                                  <tr key={o.id} className="border-b border-slate-200">
                                    <td className="p-2 border-r border-slate-300 font-mono font-bold text-yellow-600">{o.orderNumber || o.id}</td>
                                    <td className="p-2 border-r border-slate-300 font-bold text-black">{o.customerName}</td>
                                    <td className="p-2 border-r border-slate-300 text-center uppercase font-bold text-[9px]">{o.orderStatus}</td>
                                    <td className="p-2 text-right font-mono font-bold text-rose-500">{(parseFloat(o.amountRemaining) || 0).toLocaleString()} YER</td>
                                  </tr>
                                ))}
                                {coOrders.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="p-4 text-center text-slate-400 italic">{isAr ? 'لا توجد شحنات معنية للمندوب' : 'No shipments assigned currently.'}</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      // 4. Shipping Carriers view print details
                      if (activeReport === 'shipping_companies' && selectedCompanyId !== null) {
                        const sc = shippingCompanies.find(c => c.name === selectedCompanyId || c.id === selectedCompanyId) || { name: selectedCompanyId, type: 'INTERNATIONAL', phone: '-', dueAmount: 0 };
                        const coOrders = filteredData.orders.filter(o => o.shippingCompany === sc.name || o.shippingCompanyId === sc.id);
                        return (
                          <div className="space-y-4 text-xs">
                            <h4 className="font-extrabold text-[#000] border-b pb-1 text-sm">{isAr ? `كشف أداء وحساب شركة الشحن والمسار: ${sc.name}` : `Shipping Carrier Auditing: ${sc.name}`}</h4>
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <div><span className="text-slate-500">{isAr ? 'تصنيف خطوط الشحن:' : 'Carrier route type:'}</span> <span className="font-black text-yellow-600">{sc.type}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'رقم الاتصال والدعم:' : 'Operations Phone:'}</span> <span className="font-mono">{sc.phone || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'عدد الشحنات الكلي:' : 'Total orders routed:'}</span> <strong className="text-black font-mono">{coOrders.length}</strong></div>
                              <div><span className="text-slate-500">{isAr ? 'الذمة المالية والمستنقع:' : 'Outstanding due amount:'}</span> <strong className="font-mono text-rose-500">{(sc.dueAmount || 0).toLocaleString()} YER</strong></div>
                            </div>

                            <span className="text-xs font-black text-slate-800 block mt-2">{isAr ? 'كشف الشحنات التي تم نقلها عبر هذه الشركة' : 'Carrier Routed Cargo Bills'}</span>
                            <table className="w-full text-xs text-right border-collapse border border-slate-300">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'كود الشحنة' : 'Waybill ID'}</th>
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'العميل النهائي' : 'End Customer'}</th>
                                  <th className="p-2 border-r border-slate-300 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                                  <th className="p-2 text-right">{isAr ? 'القيمة الإجمالية' : 'Total charge'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {coOrders.map(o => (
                                  <tr key={o.id} className="border-b border-slate-200">
                                    <td className="p-2 border-r border-slate-300 font-mono font-bold text-yellow-600">{o.orderNumber || o.id}</td>
                                    <td className="p-2 border-r border-slate-300 text-black">{o.customerName}</td>
                                    <td className="p-2 border-r border-slate-300 text-center font-bold text-[9px] uppercase">{o.orderStatus}</td>
                                    <td className="p-2 text-right font-mono font-black">{parseFloat(o.totalPrice || '0').toLocaleString()} YER</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      // 5. Users and Salaries detailed printout card
                      if (activeReport === 'users' && selectedUserId !== null) {
                        const u = users.find(user => user.id === selectedUserId);
                        if (!u) return <p className="text-center py-4 font-bold text-slate-500">Employee not found</p>;
                        return (
                          <div className="space-y-4 text-xs">
                            <h4 className="font-extrabold text-[#000] border-b pb-1 text-sm">{isAr ? `قسيمة رواتب وعمولات الموظف: ${u.fullName}` : `Employee payroll card statement: ${u.fullName}`}</h4>
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <div><span className="text-slate-500">{isAr ? 'المسمى الوظيفي:' : 'Job Designation:'}</span> <strong className="text-black font-bold uppercase">{u.role || '-'}</strong></div>
                              <div><span className="text-slate-500">{isAr ? 'رقم الهاتف:' : 'Phone phone:'}</span> <span className="font-mono">{u.phone || '-'}</span></div>
                              <div><span className="text-slate-500">{isAr ? 'الراتب الأساسي الصافي:' : 'Base Monthly salary:'}</span> <strong className="font-mono text-emerald-600">{(u.baseSalary || 0).toLocaleString()} YER</strong></div>
                              <div><span className="text-slate-500">{isAr ? 'رصيد الذمة والحساب:' : 'Overage / outstanding balance:'}</span> <strong className="font-mono text-rose-500">{(u.financialBalance || 0).toLocaleString()} YER</strong></div>
                            </div>

                            <table className="w-full text-xs text-right border-collapse border border-slate-300">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'البند التفصيلي' : 'Payment Particular Label'}</th>
                                  <th className="p-2 text-right">{isAr ? 'القيمة المحتسبة' : 'Subtotal calculated'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="p-2 border-r border-slate-300">{isAr ? 'الراتب الشهري الأساسي المصادق' : 'Regular basic salary package'}</td>
                                  <td className="p-2 text-right font-mono">{(u.baseSalary || 0).toLocaleString()} YER</td>
                                </tr>
                                <tr>
                                  <td className="p-2 border-r border-slate-300">{isAr ? 'العمولات التشغيلية ومكافأت الاستحقاق' : 'Operational incentive commissions'}</td>
                                  <td className="p-2 text-right font-mono">0 YER</td>
                                </tr>
                                <tr className="bg-slate-50 font-black border-t-2 border-slate-400">
                                  <td className="p-2 border-r border-slate-300">{isAr ? 'صافي الحساب والرواتب المستحقة الصرف:' : 'Net Payroll due balance outstanding:'}</td>
                                  <td className="p-2 text-right font-mono text-emerald-600">{(u.baseSalary || 0).toLocaleString()} YER</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      // 6. Expense category breakdown printout card
                      if (activeReport === 'expenses' && selectedExpenseCategory !== null) {
                        const catExpenses = filteredData.expenses.filter(e => e.category === selectedExpenseCategory);
                        const catSum = catExpenses.reduce((sum, e) => sum + convertToYER(parseFloat(e.amount) || 0, e.currency || 'YER'), 0);
                        return (
                          <div className="space-y-4 text-xs">
                            <h4 className="font-extrabold text-[#000] border-b pb-1 text-sm">{isAr ? `كشف تفصيلي لمصروفات تصنيف: ${selectedExpenseCategory}` : `Expense Statement Category: ${selectedExpenseCategory}`}</h4>

                            <table className="w-full text-xs text-right border-collapse border border-slate-300">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'رقم المصروف' : 'Doc ID'}</th>
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'الجهة المستفيدة' : 'Recipient'}</th>
                                  <th className="p-2 border-r border-slate-300">{isAr ? 'شرح النفقة' : 'Narration'}</th>
                                  <th className="p-2 text-right">{isAr ? 'المقدار المالي' : 'Amount'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {catExpenses.map(e => (
                                  <tr key={e.id} className="border-b border-slate-200 font-medium">
                                    <td className="p-2 border-r border-slate-300 font-mono font-bold text-yellow-600">{e.expenseNumber}</td>
                                    <td className="p-2 border-r border-slate-300 text-black">{e.recipientName}</td>
                                    <td className="p-2 border-r border-slate-300 text-slate-500">{e.notes || '-'}</td>
                                    <td className="p-2 text-right font-mono font-black">{e.amount?.toLocaleString()} {e.currency}</td>
                                  </tr>
                                ))}
                                <tr className="bg-slate-50 font-extrabold border-t-2 border-slate-300">
                                  <td colSpan={3} className="p-2 border-r border-slate-300 text-end">{isAr ? 'مجموع نفقات التصنيف الإجمالي:' : 'Aggregate Expense Sum:'}</td>
                                  <td className="p-2 text-right font-mono text-rose-600">{catSum.toLocaleString()} YER</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      // 7. DEFAULT: RENDER INDEX SPREADSHEET TABLE OF REPORT RANGE
                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-right border-collapse border border-slate-300">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-300 font-black text-[12px]">
                                {activeReport === 'expenses' ? (
                                  <>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'كود السند' : 'Doc ID'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'فئة النفقة' : 'Category'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'المستلم' : 'Entity'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'البيان الوصفي' : 'Narration'}</th>
                                    <th className="p-3 text-right">{isAr ? 'المبلغ المالي' : 'Amount'}</th>
                                  </>
                                ) : activeReport === 'account_ledger' ? (
                                  <>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'الرقم المرجعي للقيد' : 'Voucher Ref'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'البيان التفصيلي والشرح' : 'Description'}</th>
                                    <th className="p-3 text-right">{isAr ? 'مدين (Debit)' : 'Debit'}</th>
                                    <th className="p-3 text-right">{isAr ? 'دائن (Credit)' : 'Credit'}</th>
                                    <th className="p-3 text-right">{isAr ? 'الرصيد التراكمي' : 'Running Balance'}</th>
                                  </>
                                ) : activeReport === 'customers' ? (
                                  <>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'اسم العميل الموحد' : 'Customer'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'هاتف التواصل' : 'Phone'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'العنوان' : 'Address'}</th>
                                    <th className="p-3 text-right">{isAr ? 'الرصيد النهائي' : 'Balance'}</th>
                                  </>
                                ) : activeReport === 'couriers' ? (
                                  <>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'اسم المندوب' : 'Courier'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'طريقة الحساب' : 'Type'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'العهدة المعلقة بعهدته' : 'Pending Custody'}</th>
                                    <th className="p-3 text-right">{isAr ? 'رصيد الحساب المالي' : 'Balance'}</th>
                                  </>
                                ) : activeReport === 'shipping_companies' ? (
                                  <>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'اسم الشركة الناقلة' : 'Shipping Co'}</th>
                                    <th className="p-3 border-r border-slate-300 text-center">{isAr ? 'نوع خط الشحن' : 'Shipline Route'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'هاتف الاتصال' : 'Phone'}</th>
                                    <th className="p-3 text-right">{isAr ? 'الرصيد والذمة المستحقة' : 'Outstanding Balance'}</th>
                                  </>
                                ) : activeReport === 'users' ? (
                                  <>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'اسم الموظف' : 'Employee'}</th>
                                    <th className="p-3 border-r border-slate-300 uppercase text-slate-600 font-bold">{isAr ? 'المسمى الوظيفي' : 'Job Role'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'الراتب الأساسي الصافي' : 'Base Salary'}</th>
                                    <th className="p-3 text-right">{isAr ? 'رصيد الذمة والحساب' : 'Balance'}</th>
                                  </>
                                ) : (
                                  <>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'رقم السند/الطلب' : 'Doc Num'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'اسم المستفيد/العميل' : 'Customer'}</th>
                                    <th className="p-3 border-r border-slate-300">{isAr ? 'الحالة والفرز' : 'Status'}</th>
                                    <th className="p-3 text-right">{isAr ? 'السعر النهائي' : 'Price Total'}</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {activeReport === 'expenses' ? (
                                filteredData.expenses.map(e => (
                                  <tr key={e.id} className="border-b border-slate-300 font-medium">
                                    <td className="p-3 border-r border-slate-300 font-mono text-slate-700">{e.expenseNumber}</td>
                                    <td className="p-3 border-r border-slate-300 uppercase">{e.category}</td>
                                    <td className="p-3 border-r border-slate-300">{e.recipientName}</td>
                                    <td className="p-3 border-r border-slate-300 text-slate-600">{e.notes || '-'}</td>
                                    <td className="p-3 text-right font-mono font-black">{e.amount?.toLocaleString()} {e.currency}</td>
                                  </tr>
                                ))
                              ) : activeReport === 'account_ledger' ? (
                                ledgerMetrics ? (
                                  ledgerMetrics.displayRows.map(tx => {
                                    const amt = parseFloat(tx.amount) || 0;
                                    return (
                                      <tr key={tx.id} className="border-b border-slate-300 font-medium">
                                        <td className="p-3 border-r border-slate-300 font-mono text-slate-600">
                                          {format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm')}
                                        </td>
                                        <td className="p-3 border-r border-slate-300 font-mono text-slate-700">{tx.refNumber}</td>
                                        <td className="p-3 border-r border-slate-300 text-slate-900 font-semibold">{tx.description}</td>
                                        <td className="p-3 text-right font-mono font-bold text-rose-600">
                                          {tx.type === 'Debit' ? `+${amt.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="p-3 text-right font-mono font-bold text-emerald-600">
                                          {tx.type === 'Credit' ? `-${amt.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="p-3 text-right font-mono font-black">
                                          {tx.runningBalance.toLocaleString()} {tx.currencyOriginal || tx.currency || 'SAR'}
                                        </td>
                                      </tr>
                                    );
                                  })
                                ) : (
                                  <tr>
                                    <td colSpan={6} className="text-center p-4 italic text-slate-500">
                                      {isAr ? 'يرجى تحديد حساب مالي' : 'Please select an account'}
                                    </td>
                                  </tr>
                                )
                              ) : activeReport === 'customers' ? (
                                filteredData.customers.map(c => (
                                  <tr key={c.id} className="border-b border-slate-300 font-medium">
                                    <td className="p-3 border-r border-slate-300 font-bold">{c.fullName}</td>
                                    <td className="p-3 border-r border-slate-300 font-mono">{c.phone || '-'}</td>
                                    <td className="p-3 border-r border-slate-300">{c.address || '-'}</td>
                                    <td className="p-3 text-right font-mono font-black">{c.financialBalance?.toLocaleString()} {c.financialCurrency || 'SAR'}</td>
                                  </tr>
                                ))
                              ) : activeReport === 'couriers' ? (
                                filteredData.couriers.map(c => (
                                  <tr key={c.id} className="border-b border-slate-300 font-medium">
                                    <td className="p-3 border-r border-slate-300 font-bold">{c.fullName}</td>
                                    <td className="p-3 border-r border-slate-300">{c.courierType === 'sourcing' ? (isAr ? 'تجميع خارجي' : 'Sourcing') : (isAr ? 'توزيع داخلي' : 'Local')}</td>
                                    <td className="p-3 border-r border-slate-300 font-mono font-black text-rose-600">{(c.outstandingCustody || 0).toLocaleString()} {c.financialCurrency || 'SAR'}</td>
                                    <td className="p-3 text-right font-mono font-black">{(c.financialBalance || 0).toLocaleString()} {c.financialCurrency || 'SAR'}</td>
                                  </tr>
                                ))
                              ) : activeReport === 'shipping_companies' ? (
                                filteredData.shippingCompanies.map(sc => (
                                  <tr key={sc.id} className="border-b border-slate-300 font-medium">
                                    <td className="p-3 border-r border-slate-300 font-bold">{sc.name}</td>
                                    <td className="p-3 border-r border-slate-300 text-center font-bold text-[#d4af37] text-[10px] uppercase">{sc.type || 'INTERNATIONAL'}</td>
                                    <td className="p-3 border-r border-slate-300 font-mono text-slate-500">{sc.phone || '-'}</td>
                                    <td className="p-3 text-right font-mono font-black text-rose-500">-{sc.dueAmount?.toLocaleString() || 0} YER</td>
                                  </tr>
                                ))
                              ) : activeReport === 'users' ? (
                                filteredData.users.map(u => (
                                  <tr key={u.id} className="border-b border-slate-300 font-medium">
                                    <td className="p-3 border-r border-slate-300 font-bold">{u.fullName}</td>
                                    <td className="p-3 border-r border-slate-300 uppercase text-slate-650 font-semibold">{u.role || '-'}</td>
                                    <td className="p-3 border-r border-slate-300 font-mono">{(u.baseSalary || 0).toLocaleString()} YER</td>
                                    <td className="p-3 text-right font-mono font-black">{(u.financialBalance || 0).toLocaleString()} YER</td>
                                  </tr>
                                ))
                              ) : (
                                filteredData.orders.map(o => (
                                  <tr key={o.id} className="border-b border-slate-300 font-medium">
                                    <td className="p-3 border-r border-slate-300 font-mono text-[#d4af37]">{o.orderNumber}</td>
                                    <td className="p-3 border-r border-slate-300">{o.customerName}</td>
                                    <td className="p-3 border-r border-slate-300 uppercase">{o.orderStatus}</td>
                                    <td className="p-3 text-right font-mono font-black">{o.totalPrice?.toLocaleString()} YER</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Summary calculation parameters */}
                  <div className="flex justify-end mb-6">
                    <div className="w-1/2 border border-slate-300 rounded-xl p-4 space-y-2 text-xs">
                      <div className="flex justify-between border-b pb-1">
                        <span>{isAr ? 'المجموع المؤشر للحركات:' : 'Aggregate volume:'}</span>
                        <strong className="font-mono">
                          {activeReport === 'expenses' ? `${reportMetrics.costs.toLocaleString()} YER` :
                            activeReport === 'account_ledger' ? `${accountTransactions.length} Record` :
                              `${reportMetrics.revenue.toLocaleString()} YER`}
                        </strong>
                      </div>
                      <div className="flex justify-between font-black text-[#000000]">
                        <span>{isAr ? 'التصديق المالي والتدقيق المعتمد:' : 'Certified final balance:'}</span>
                        <strong className="font-mono">APPROVED</strong>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Barcode */}
                  {printSettings.showBarcode && (
                    <div className="flex flex-col items-center justify-center py-2 mb-6">
                      <div className="w-44 h-8 border bg-slate-100 flex items-center justify-center text-[8px] font-mono tracking-[5px] font-black text-slate-500 border-slate-300">
                        ||||||||||||||||||||||||||||||
                      </div>
                      <span className="text-[8px] font-mono mt-1 text-slate-400">ALX-SWIFT-REPORT-{format(new Date(), 'yyyyMMdd')}</span>
                    </div>
                  )}

                  {/* Footer instructions */}
                  <div className="text-center text-[10px] text-slate-500 italic font-bold mb-8">
                    <p className="leading-relaxed leading-4">{printSettings.footerTextAr}</p>
                    <p className="font-mono mt-1 leading-4">{printSettings.footerTextEn}</p>
                  </div>

                  {/* Print signatures slots */}
                  {printSettings.showSignatures && (
                    <div className="grid grid-cols-3 gap-3 text-center text-[8px] font-semibold border-t pt-4">
                      <div className="flex flex-col">
                        <span className="text-slate-400 italic mb-6">
                          {isAr
                            ? (printSettings.signature1Ar || 'توقيع المستلم والعميل')
                            : (printSettings.signature1En || 'Client Signature')}
                        </span>
                        <div className="border-b w-full" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 italic mb-6">
                          {isAr
                            ? (printSettings.signature2Ar || 'اعتماد المحاسب المسؤول والتدقيق')
                            : (printSettings.signature2En || 'Accountant Sign')}
                        </span>
                        <div className="border-b w-full" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 italic mb-6">
                          {isAr
                            ? (printSettings.signature3Ar || 'مسؤول مستند المدير والختم')
                            : (printSettings.signature3En || 'General Director Stamp')}
                        </span>
                        <div className="border-b w-full" />
                      </div>
                    </div>
                  )}

                </div>

              </div>

            </div>

            {/* Print and Export Controls */}
            <div className="p-4 bg-black/40 border-t border-slate-850 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-6 py-2.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-black"
              >
                {isAr ? 'إلغاء المعاينة' : 'Cancel'}
              </button>
              <button
                onClick={triggerNativePrint}
                className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black font-black rounded-xl shadow-lg transition flex items-center gap-1.5 text-xs"
              >
                <Printer className="w-4 h-4" />
                {isAr ? 'تنفيذ الطباعة المباشرة' : 'Initiate Printing'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
