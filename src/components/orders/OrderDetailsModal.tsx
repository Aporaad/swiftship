import React, { useRef, useEffect } from 'react';
import { X, Truck, Printer } from 'lucide-react';
import QRCode from 'qrcode';
import CopyToClipboard from '../CopyToClipboard';
import { safeToDate } from '../../lib/supabase';
import { generateOrderInvoicePDF } from '../../reports/OrderInvoicePrint';

interface OrderDetailsModalProps {
  isOpen: boolean;
  selectedOrder: any;
  onClose: () => void;
  isAr: boolean;
  settings: any;
  orderStatusesList: any;
}

export default function OrderDetailsModal({
  isOpen,
  selectedOrder,
  onClose,
  isAr,
  settings,
  orderStatusesList,
}: OrderDetailsModalProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (isOpen && selectedOrder && qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        selectedOrder.trackingNumber || selectedOrder.orderNumber || '',
        {
          width: 140,
          margin: 1.5,
          color: {
            dark: '#030712',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('QR code generation error:', error);
        }
      );
    }
  }, [isOpen, selectedOrder]);

  if (!isOpen || !selectedOrder) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden text-start shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-955 border-b border-slate-800 flex justify-between items-center text-xs font-black text-white">
          <span>{isAr ? 'تفاصيل الفاتورة وتتبع الشحنة الرقمي' : 'Invoice Details & Tracking Profile'}</span>
          <button
            onClick={onClose}
            className="text-slate-400 bg-slate-800 p-1 rounded-lg cursor-pointer hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-350 text-xs custom-scrollbar">
          {/* QR Code and Key Track IDs Section */}
          <div className="bg-slate-955 border border-[#d4af37]/20 p-5 rounded-2xl flex flex-col md:flex-row items-center gap-6">
            {/* QR Code Draw Area */}
            <div className="bg-white p-3 rounded-2xl shadow-lg border-2 border-[#d4af37] flex flex-col items-center justify-center shrink-0">
              <canvas ref={qrCanvasRef} className="w-[140px] h-[140px]"></canvas>
              <span className="text-[10px] text-slate-500 font-black tracking-tight mt-1.5 uppercase select-all">
                {selectedOrder.trackingNumber || selectedOrder.orderNumber || ''}
              </span>
            </div>

            {/* Key Labels & Action Copier */}
            <div className="flex-1 space-y-2 text-center md:text-start w-full">
              <span className="text-[9px] text-[#d4af37] bg-[#d4af37]/10 font-black px-2 py-0.5 rounded-full uppercase tracking-widest inline-block">
                {isAr ? 'رمز تتبع الشحنة الموحد' : 'Logistic Courier Tracking Key'}
              </span>

              <h4 className="text-white text-lg font-black tracking-tight select-all">
                {selectedOrder.trackingNumber || selectedOrder.orderNumber || 'ALX-XXXX-XXXX'}
              </h4>

              <p className="text-slate-400 text-[11px] leading-relaxed">
                {isAr
                  ? 'امسح الرمز السريع (QR) أعلاه بواسطة كاميرا الكاشير أو الموزع للوصول اللوجستي وتحديث حالة الطرد بسرعة خاطفة.'
                  : 'Scan the quick QR code with courier scanner terminal to instantly register driver dispatch status.'}
              </p>

              <div className="pt-1 flex flex-wrap justify-center md:justify-start gap-2">
                <CopyToClipboard
                  text={selectedOrder.trackingNumber || selectedOrder.orderNumber || ''}
                  showIconOnly={false}
                  label={isAr ? 'نسخ رمز التتبع الموحد' : 'Copy Tracking ID'}
                  labelCopied={isAr ? 'تم نسخ الرمز!' : 'Copied Tracking ID!'}
                  className="px-4 py-2.5 text-[11px] rounded-xl font-black"
                />
              </div>
            </div>
          </div>

          {/* General Order Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3 bg-slate-950/20 p-4 border border-slate-800/60 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-slate-850 pb-1">
                {isAr ? 'الزبون والحساب' : 'Customer Account'}
              </span>
              <div className="space-y-1">
                <div className="text-slate-400 font-bold">
                  {isAr ? 'الاسم الائتماني:' : 'Client Name:'} <span className="text-white">{selectedOrder.customerName || selectedOrder.customer?.name || selectedOrder.customer?.fullName || '—'}</span>
                </div>
                <div className="text-slate-400 font-bold">
                  {isAr ? 'رقم الهاتف:' : 'Phone Key:'} <span className="text-white font-mono select-all">{selectedOrder.customerPhone || selectedOrder.customer?.phone || '—'}</span>
                </div>
                {selectedOrder.locationYemen && (
                  <div className="text-slate-400 font-bold">
                    {isAr ? 'أماكن التوصيل لليمن:' : 'Yemen Destination:'} <span className="text-white font-mono">{selectedOrder.locationYemen}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 bg-slate-950/20 p-4 border border-slate-800/60 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-slate-850 pb-1">
                {isAr ? 'البيانات اللوجيتسية' : 'Logistics Route'}
              </span>
              <div className="space-y-1">
                <div className="text-slate-400 font-bold">
                  {isAr ? 'حالة الشحنة الطردية:' : 'Cargo Current State:'}{' '}
                  {(() => {
                    const currentStatusItem = orderStatusesList.find(s => s.sortOrder == selectedOrder.order_status_id || s.sortOrder == selectedOrder.order_status_id || s.id == selectedOrder.order_status_id);
                    return (
                      <span className="px-2.5 py-0.5 rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/5 text-[#d4af37] font-bold max-w-max text-[10px]">
                        {selectedOrder.order_status_id + ' : ' + (isAr ? currentStatusItem?.nameAr : currentStatusItem?.nameEn) /*مهم: هنا يجب جلب اسم المرحله من جدول المراحل بناء على رقم المرحله*/}
                      </span>
                    );
                  })()}
                </div>
                <div className="text-slate-400 font-bold">
                  {isAr ? 'قناة التعبئة والمصدر:' : 'Sales Cargo Source:'}{' '}
                  <span className="text-white">{selectedOrder.orderSourceName || selectedOrder.source?.name || selectedOrder.orderSourceType || 'App'}</span>
                </div>
                <div className="text-slate-400 font-bold">
                  {isAr ? 'تاريخ المعاملة:' : 'Invoice Date:'}{' '}
                  <span className="text-white font-mono">{safeToDate(selectedOrder.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Balance Status Card */}
          <div className="bg-slate-955 border border-slate-800 p-4 rounded-xl space-y-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-slate-850 pb-1">
              {isAr ? 'كشف الرصيد وتفاصيل السداد المالي' : 'Financial breakdown'}
            </span>

            {/* Cost Breakdown Details */}
            <div className="flex flex-col gap-1 text-[11px] font-bold text-slate-400 mb-3 border-b border-slate-850 pb-3">
              <div className="flex justify-between">
                <span>{isAr ? 'تكلفة المنتجات الأصلية:' : 'Original Products:'}</span>
                <span className="text-slate-300 font-mono">
                  {(selectedOrder.productsSum !== undefined
                    ? selectedOrder.productsSum
                    : (parseFloat(selectedOrder.totalCostSAR) - parseFloat(selectedOrder.profitCompanySAR || 0) - parseFloat(selectedOrder.shippingCostSAR || 0) - parseFloat(selectedOrder.packagingFee || 0))
                  ).toLocaleString()} SAR
                </span>
              </div>
              {selectedOrder.couponEnabled && (parseFloat(selectedOrder.couponRate) > 0) && (
                <div className="flex justify-between text-rose-450/90">
                  <span>{isAr ? 'كوبون الخصم للمشتريات (مبلغ):' : 'Purchase Coupon Discount:'}</span>
                  <span className="font-mono">-{parseFloat(selectedOrder.couponRate).toLocaleString()} SAR</span>
                </div>
              )}
              {parseFloat(selectedOrder.shippingCostSAR || '0') > 0 && (
                <div className="flex justify-between">
                  <span>{isAr ? 'تكلفة الشحن والتخليص:' : 'Shipping Cost:'}</span>
                  <span className="text-slate-300 font-mono">{parseFloat(selectedOrder.shippingCostSAR).toLocaleString()} SAR</span>
                </div>
              )}
              {parseFloat(selectedOrder.profitCompanySAR || '0') > 0 && (
                <div className="flex justify-between">
                  <span>{isAr ? 'رسوم اخرى:' : 'other fees:'}</span>
                  <span className="text-slate-300 font-mono">{parseFloat(selectedOrder.profitCompanySAR).toLocaleString()} SAR</span>
                </div>
              )}
              {parseFloat(selectedOrder.packagingFee || '0') > 0 && (
                <div className="flex justify-between">
                  <span>{isAr ? 'رسوم التغليف:' : 'Packaging Fee:'}</span>
                  <span className="text-slate-300 font-mono">{parseFloat(selectedOrder.packagingFee).toLocaleString()} SAR</span>
                </div>
              )}
              {parseFloat(selectedOrder.deliveryCourierFee || '0') > 0 && (
                <div className="flex justify-between text-yellow-400/80">
                  <span>{isAr ? 'أجرة التوصيل الداخلي:' : 'Internal Delivery Wage:'}</span>
                  <span className="font-mono">{parseFloat(selectedOrder.deliveryCourierFee).toLocaleString()} YER</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="bg-slate-955 border border-slate-800 p-2.5 rounded-lg flex flex-col justify-between">
                <span className="text-[10px] text-slate-500 font-bold">{isAr ? 'إجمالي قيمة الفاتورة' : 'Total Invoice Due'}</span>
                <span className="font-mono text-white text-xs font-black mt-1">
                  {((parseFloat(selectedOrder.amountPaid) || 0) + (parseFloat(selectedOrder.amountRemaining) || 0)).toLocaleString()} YER
                </span>
              </div>
              <div className="bg-emerald-950/10 border border-emerald-950/20 p-2.5 rounded-lg flex flex-col justify-between">
                <span className="text-[10px] text-emerald-400 font-bold">{isAr ? 'المقدار المقبوض' : 'Settled Balance'}</span>
                <span className="font-mono text-emerald-400 text-xs font-black mt-1">
                  {(parseFloat(selectedOrder.amountPaid) || 0).toLocaleString()} YER
                </span>
              </div>
              <div className="bg-rose-950/10 border border-rose-950/20 p-2.5 rounded-lg flex flex-col justify-between">
                <span className="text-[10px] text-rose-455 font-bold">{isAr ? 'المديونية المتبقية' : 'Remaining Arrears'}</span>
                <span className="font-mono text-rose-455 text-xs font-black mt-1">
                  {(parseFloat(selectedOrder.amountRemaining) || 0).toLocaleString()} YER
                </span>
              </div>
            </div>
          </div>

          {/* Items Table inside current ledger */}
          {selectedOrder.items && selectedOrder.items.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block pb-1 border-b border-slate-850">
                {isAr ? 'تفاصيل المشتريات ومشتملات الطرد' : 'Cargo manifests & items'}
              </span>
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden pr-2">
                <table className="w-full text-start text-[11px]">
                  <thead className="bg-slate-955 text-slate-500 font-black text-[10px] border-b border-slate-850">
                    <tr>
                      <th className="p-2.5 text-right">{isAr ? 'المنتج' : 'Product'}</th>
                      <th className="p-2.5 text-center">{isAr ? 'نوع التغليف' : 'Packaging'}</th>
                      <th className="p-2.5 text-center">{isAr ? 'الكمية' : 'Qty'}</th>
                      <th className="p-2.5 text-center">{isAr ? 'رابط المنتج' : 'Link'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {selectedOrder.items.map((it: any, index: number) => (
                      <tr key={index}>
                        <td className="p-2.5 text-white font-bold">{it.productName || (isAr ? `طرد رقم ${index + 1}` : `Cargo item ${index + 1}`)}</td>
                        <td className="p-2.5 text-center">
                          {it.packagingOptionName ? (
                            <span className="bg-amber-950/40 text-amber-300 border border-amber-800/50 px-2 py-0.5 rounded text-[9px] font-bold">
                              📦 {it.packagingOptionName}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-300 font-bold">{it.quantity || 1}</td>
                        <td className="p-2.5 text-center">
                          {it.productUrl ? (
                            <a href={it.productUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-white underline font-bold">
                              {isAr ? 'الرابط خارجي' : 'External link'}
                            </a>
                          ) : (
                            <span className="text-slate-650">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Shipping Details Tracks Timeline */}
          {selectedOrder.shippingDetails && selectedOrder.shippingDetails.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Truck className="w-5 h-5 text-[#d4af37]" />
                <span className="text-xs font-black text-white uppercase tracking-widest block">
                  {isAr ? 'مسارات الشحن وتفاصيل الترانزيت اللوجستي' : 'Logistics Manifests & Shipping Steps'}
                </span>
              </div>

              <div className="relative border-r-2 border-slate-800 mr-2 md:mr-4 pr-4 md:pr-6 space-y-6 py-2 animate-fade-in text-start">
                {selectedOrder.shippingDetails.map((sh: any, index: number) => {
                  const isDelivered = !!sh.deliveryDate;
                  const hasSea = sh.shippingType === 'بحري';
                  const hasAir = sh.shippingType === 'جوي';

                  let typeColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                  let typeIcon = '🚛';
                  let typeLabel = isAr ? 'شحن بري - مقطورات لوجستية' : 'Overland Cargo';
                  if (hasAir) {
                    typeColor = 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
                    typeIcon = '✈️';
                    typeLabel = isAr ? 'شحن جوي - كيجو سريع' : 'Air Freight';
                  } else if (hasSea) {
                    typeColor = 'bg-indigo-500/10 text-indigo-400 border border-indigo-505/20';
                    typeIcon = '🚢';
                    typeLabel = isAr ? 'شحن بحري - حاويات اقتصادية' : 'Ocean Cargo';
                  }

                  return (
                    <div key={index} className="relative group">
                      <div className={`absolute -right-[23px] md:-right-[35px] top-1.5 w-4 h-4 rounded-full border-4 border-slate-900 z-10 flex items-center justify-center transition-all ${isDelivered ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse'
                        }`} />

                      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition duration-300 shadow-md">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[#d4af37] bg-[#d4af37]/5 px-2.5 py-1 rounded-lg border border-[#d4af37]/20">
                              {isAr ? `الشحنة #${index + 1}` : `Shipment #${index + 1}`}
                            </span>
                            <span className="text-sm font-black text-slate-200">{sh.shippingCompany}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {sh.shippingCategoryName && (
                              <span className="bg-cyan-950/40 text-cyan-300 border border-cyan-800/50 px-2.5 py-1 rounded-full text-[10px] font-black">
                                ⚡️ {sh.shippingCategoryName}
                              </span>
                            )}
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1.5 ${typeColor}`}>
                              <span>{typeIcon}</span>
                              <span>{typeLabel}</span>
                            </span>

                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1.5 ${isDelivered
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-505/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                              }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                              <span>{isDelivered ? (isAr ? 'تم التسليم والمطابقة' : 'Delivered & Matched') : (isAr ? 'تحت الترانزيت 🕒' : 'In Transit 🕒')}</span>
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-7 items-center bg-slate-950/40 p-3 rounded-2xl border border-slate-850/60 text-center">
                          <div className="col-span-3 text-start px-2">
                            <span className="block text-[9px] text-slate-500 uppercase font-black tracking-wider mb-0.5">{isAr ? 'من (مصدر التصدير)' : 'Origin Point'}</span>
                            <span className="text-white font-extrabold text-sm flex items-center gap-1">
                              📍 {sh.shippingSource || (isAr ? 'بلد المصدر' : 'Source')}
                            </span>
                          </div>
                          <div className="col-span-1 flex flex-col items-center justify-center">
                            <span className="text-xs font-black text-slate-650">➔</span>
                          </div>
                          <div className="col-span-3 text-start px-2 border-r border-slate-850 pr-4">
                            <span className="block text-[9px] text-slate-500 uppercase font-black tracking-wider mb-0.5">{isAr ? 'إلى (وجهة الاستقبال)' : 'Destination Point'}</span>
                            <span className="text-[#d4af37] font-extrabold text-sm flex items-center gap-1">
                              🏁 {sh.shippingDestination || (isAr ? 'البلد المستقبل' : 'Destination')}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/20 p-3.5 rounded-xl text-[11px] border border-slate-850/30">
                          <div>
                            <span className="block text-[9px] text-slate-500 font-black mb-1">{isAr ? 'تاريخ انطلاق الشحن' : 'Dispatch Date'}</span>
                            <span className="text-slate-300 font-black font-mono">{sh.shippingDate || '—'}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-slate-500 font-black mb-1">{isAr ? 'المدة المقدرة للنقل' : 'Transit Duration'}</span>
                            <span className="text-slate-300 font-bold bg-slate-800/40 px-2 py-0.5 rounded-md inline-block">{sh.shippingDuration || (isAr ? 'غير محدد' : 'N/A')}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-slate-500 font-black mb-1">{isAr ? 'الوصول المتوقع لليمن' : 'Expected Arrival'}</span>
                            <span className="text-slate-300 font-extrabold">{sh.expectedArrival || '—'}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-slate-500 font-black mb-1">{isAr ? 'تاريخ الاستلام الفعلي' : 'Actual Completion'}</span>
                            <span className={`font-mono font-black ${isDelivered ? 'text-emerald-400 bg-emerald-950/10 px-2.5 py-0.5 rounded-md inline-block' : 'text-slate-500 font-bold'}`}>
                              {sh.deliveryDate ? sh.deliveryDate : (isAr ? 'قيد الانتظار ⏳' : 'Pending ⏳')}
                            </span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-[11px] font-mono flex-wrap gap-2 bg-slate-950/30 -mx-5 -mb-5 p-4 rounded-b-2xl">
                          <div className="flex gap-4">
                            <div className="text-start">
                              <span className="text-slate-500 font-sans text-[10px] block">{isAr ? 'أجرة النقل:' : 'Freight Cost:'}</span>
                              <span className="text-white font-extrabold text-xs">
                                {(parseFloat(sh.shippingCost) || 0).toLocaleString()} <span className="text-[10px] font-normal font-sans">SAR</span>
                              </span>
                            </div>
                            {sh.packagingFees ? (
                              <div className="text-start border-r border-slate-800 pr-4">
                                <span className="text-slate-500 font-sans text-[10px] block">{isAr ? 'أجور التغليف والصناديق:' : 'Packaging Fees:'}</span>
                                <span className="text-slate-300 font-bold text-xs">
                                  {(parseFloat(sh.packagingFees) || 0).toLocaleString()} <span className="text-[10px] font-normal font-sans">SAR</span>
                                </span>
                              </div>
                            ) : null}
                          </div>

                          <div className="text-end bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-850">
                            <span className="text-[9px] text-slate-500 font-sans block leading-none mb-1">{isAr ? 'إجمالي تكاليف هذه الشحنة:' : 'Segment Total Fees:'}</span>
                            <span className="text-emerald-400 font-black text-sm">
                              {((parseFloat(sh.shippingCost) || 0) + (parseFloat(sh.packagingFees) || 0)).toLocaleString()}{' '}
                              <span className="text-[10px] font-sans">SAR</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Yemen Delivery Summary */}
              {(() => {
                const totalTransitDays = (selectedOrder.shippingDetails || []).reduce(
                  (sum: number, s: any) => sum + (parseInt(s.shippingDuration) || 0), 0
                );
                const yemenDuration = settings?.defaultYemenDeliveryDuration ?? 5;
                const totalExpected = totalTransitDays + yemenDuration;
                const lastDispatch = (selectedOrder.shippingDetails || []).reduce((latest: string, s: any) => {
                  return s.shippingDate > latest ? s.shippingDate : latest;
                }, '');
                let yemenArrivalDate = '';
                if (lastDispatch) {
                  const d = new Date(lastDispatch);
                  d.setDate(d.getDate() + totalExpected);
                  yemenArrivalDate = d.toISOString().split('T')[0];
                }
                return (
                  <div className="p-4 bg-slate-950/60 border border-[#d4af37]/20 rounded-2xl text-[11px] font-bold mt-2">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
                      <Truck className="w-4 h-4 text-[#d4af37]" />
                      <span className="text-[10px] text-[#d4af37] font-black uppercase tracking-widest">
                        {isAr ? 'ملخص التسليم النهائي لليمن' : 'Yemen Final Delivery Summary'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <span className="text-[9px] text-slate-500 block mb-1">{isAr ? 'مجموع أيام الشحن:' : 'Total Transit Days:'}</span>
                        <span className="font-mono text-amber-400 font-black">{totalTransitDays} {isAr ? 'يوم' : 'd'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block mb-1">{isAr ? 'مدة التوصيل لليمن (إعدادات):' : 'Yemen Delivery (Settings):'}</span>
                        <span className="font-mono text-blue-400 font-black">{yemenDuration} {isAr ? 'يوم' : 'd'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block mb-1">{isAr ? 'المدة الإجمالية المتوقعة:' : 'Total Expected Duration:'}</span>
                        <span className="font-mono text-emerald-400 font-black text-sm">{totalExpected} {isAr ? 'يوم' : 'days'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block mb-1">{isAr ? 'تاريخ التسليم لليمن المتوقع:' : 'Est. Yemen Arrival:'}</span>
                        <span className="font-mono text-[#d4af37] font-black">{yemenArrivalDate || '—'}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="p-4 bg-slate-955 border-t border-slate-850 flex justify-end gap-2 shrink-0">
          <button
            onClick={() => generateOrderInvoicePDF(selectedOrder, isAr, settings)}
            className="px-5 py-2.5 bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] text-black rounded-xl transition font-extrabold flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <Printer className="w-4 h-4" />
            {isAr ? '🖨️ إصدار فاتورة للعميل' : 'Print Invoice PDF'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-850 text-slate-455 hover:text-white rounded-xl transition font-bold text-xs"
          >
            {isAr ? 'إغلاق نافذة التفاصيل' : 'Close Details'}
          </button>
        </div>
      </div>
    </div>
  );
}
