import React from 'react';
import { CheckCircle, FileText, Printer, X } from 'lucide-react';

interface LedgerEntryPreviewProps {
  isAr: boolean;
  selectedLedgerEntry: any | null;
  setSelectedLedgerEntry: React.Dispatch<React.SetStateAction<any | null>>;
  triggerPrint: (title: string, elementId: string) => void;
}

export default function LedgerEntryPreview({
  isAr,
  selectedLedgerEntry,
  setSelectedLedgerEntry,
  triggerPrint,
}: LedgerEntryPreviewProps) {
  return (
    <>
      {/* MODAL 2: DETAIL PREVIEW OF INDIVIDUAL LEDGER JOURNAL */}
      {selectedLedgerEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-start font-sans">
          <div className="bg-[#121215] border border-slate-850 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="p-5 border-b border-slate-850 flex justify-between items-center bg-[#07070a]/40 shrink-0">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <FileText className="w-4 h-4 text-[#d4af37]" />
                  {isAr ? 'معاينة القيد المالي والترحيل الدفتري' : 'Financial Main Entry Preview'}
                </h3>
                <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                  {isAr ? `رمز المستند المالي المرجعي: ${selectedLedgerEntry.refNumber}` : `Voucher Ref Node: ${selectedLedgerEntry.refNumber}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLedgerEntry(null)}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-200">
              <div className="bg-black/40 border border-slate-850/60 p-6 rounded-2xl space-y-6 relative overflow-hidden">
                <div className="absolute right-4 top-4 border-2 border-dashed border-[#d4af37]/20 rounded-full px-3 py-1 font-mono text-[9px] text-[#d4af37]/20 uppercase tracking-widest font-black rotate-12 select-none pointer-events-none">
                  {isAr ? 'مُقيد ومُرّحَل' : 'POSTED & VERIFIED'}
                </div>

                <div className="flex justify-between items-start border-b border-slate-805 pb-4">
                  <div>
                    <h4 className="text-sm font-black text-white">{isAr ? 'ألكس للخدمات اللوجستية' : 'alx Logistics'}</h4>
                    <p className="text-[10px] text-slate-500 font-medium">{isAr ? 'قسم الشؤون المالية والحسابات' : 'Finance & Accounts Division'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 text-[9px] uppercase block font-black">{isAr ? 'نوع المستند' : 'Voucher Type'}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${selectedLedgerEntry.type === 'Debit'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-452 border border-rose-500/20 text-rose-400'
                      }`}>
                      {selectedLedgerEntry.type === 'Debit'
                        ? (isAr ? 'سند قبض / مدين' : 'Receipt / Debit')
                        : (isAr ? 'سند صرف / دائن' : 'Payment / Credit')
                      }
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block font-medium mb-1">{isAr ? 'رمز المعاملة المالي' : 'Transaction Ref No.'}</span>
                    <span className="text-[#d4af37] font-mono font-bold bg-[#1a1a1e] px-2.5 py-1 rounded-lg border border-slate-800 inline-block">{selectedLedgerEntry.refNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block font-medium mb-1">{isAr ? 'تاريخ الترحيل الدفتري' : 'Posting Timestamp'}</span>
                    <span className="text-white font-mono font-bold block mt-1">
                      {selectedLedgerEntry.date.toLocaleDateString()} {selectedLedgerEntry.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-slate-500 text-[10px] uppercase block font-medium mb-1">{isAr ? 'البيان وعنوان قيد اليومية' : 'Particulars / Journal Title'}</span>
                    <span className="text-slate-100 font-extrabold text-xs block bg-slate-900/60 p-3 rounded-xl border border-slate-805">{selectedLedgerEntry.title}</span>
                  </div>

                  {selectedLedgerEntry.notes && (
                    <div className="col-span-2">
                      <span className="text-slate-500 text-[10px] uppercase block font-medium mb-1">{isAr ? 'التفاصيل والملاحظات' : 'Detailed Narrative'}</span>
                      <span className="text-slate-350 font-medium block bg-slate-900/40 p-3 rounded-xl border border-slate-855 text-[11px] whitespace-pre-wrap">{selectedLedgerEntry.notes}</span>
                    </div>
                  )}

                  {/* Balanced Double-Entry Accounts representation */}
                  <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/40 p-4 rounded-2xl border border-slate-850/80">
                    <div className="bg-emerald-950/20 border border-emerald-800/30 p-3 rounded-xl">
                      <span className="text-emerald-400 text-[10px] uppercase block font-black mb-1 tracking-wider flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                        {isAr ? 'الطرف المدين (من حـ/)' : 'Debit Account (Dr.)'}
                      </span>
                      <span className="text-white font-bold text-xs block mt-1">
                        {selectedLedgerEntry.debitPartyName || (isAr ? 'الخزينة العامة' : 'General Treasury')}
                      </span>
                      <span className="text-emerald-400 font-mono font-black text-xs block mt-1">
                        +{selectedLedgerEntry.amountOriginal.toLocaleString()} {selectedLedgerEntry.currencyOriginal}
                      </span>
                    </div>

                    <div className="bg-rose-950/20 border border-rose-800/30 p-3 rounded-xl">
                      <span className="text-rose-400 text-[10px] uppercase block font-black mb-1 tracking-wider flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
                        {isAr ? 'الطرف الدائن (إلى حـ/)' : 'Credit Account (Cr.)'}
                      </span>
                      <span className="text-white font-bold text-xs block mt-1">
                        {selectedLedgerEntry.creditPartyName || (isAr ? 'الخزينة العامة' : 'General Treasury')}
                      </span>
                      <span className="text-rose-400 font-mono font-black text-xs block mt-1">
                        -{selectedLedgerEntry.amountOriginal.toLocaleString()} {selectedLedgerEntry.currencyOriginal}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block font-medium mb-1">{isAr ? 'نوع ومجال الترحيل' : 'Posting Origin / Domain'}</span>
                    <span className="text-slate-350 font-mono text-[10px] uppercase bg-slate-900 px-2 py-0.5 border border-slate-850 rounded-md inline-block">{selectedLedgerEntry.module}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block font-medium mb-1">{isAr ? 'حالة التوازن المحاسبي' : 'Balanced Status'}</span>
                    <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      {isAr ? 'متوازن ومقبوض (قيد مزدوج)' : 'Balanced Double Entry'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="text-slate-500 text-[9px] uppercase block font-black mb-0.5">{isAr ? 'إجمالي مبلغ القيد المتوازن' : 'Net Book Value'}</span>
                    <span className="text-lg font-mono font-black text-[#d4af37]">
                      {selectedLedgerEntry.amountOriginal.toLocaleString()} {selectedLedgerEntry.currencyOriginal}
                    </span>
                  </div>
                  {selectedLedgerEntry.currencyOriginal !== 'YER' && (
                    <div className="text-right border-l border-slate-850 pl-4">
                      <span className="text-slate-500 text-[9px] uppercase block font-black mb-0.5">{isAr ? 'المعادل بالعملة اليمنية YER' : 'Yemeni Rial FX Equivalent'}</span>
                      <span className="text-white font-mono font-black text-sm">
                        ≈ {selectedLedgerEntry.amount.toLocaleString()} YER
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-4 text-center text-[9px] text-slate-500 border-t border-slate-805 leading-relaxed">
                  <div>
                    <span className="block font-black uppercase mb-1">{isAr ? 'المُعدّ / المحاسب' : 'Prepared Accountant'}</span>
                    <span className="block border-b border-dashed border-slate-800 py-3"></span>
                  </div>
                  <div>
                    <span className="block font-black uppercase mb-1">{isAr ? 'توقيع المستلم' : 'Recipient Handover'}</span>
                    <span className="block border-b border-dashed border-slate-800 py-3"></span>
                  </div>
                  <div>
                    <span className="block font-black uppercase mb-1">{isAr ? 'المصادقة المالية' : 'Controller Sanction'}</span>
                    <span className="block border-b border-dashed border-slate-800 py-3"></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-[#0a0a0d] border-t border-slate-850 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedLedgerEntry(null)}
                className="w-1/3 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-350 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerPrint(
                    isAr ? `سند قيد مالي ${selectedLedgerEntry.refNumber}` : `Financial Voucher ${selectedLedgerEntry.refNumber}`,
                    'single-voucher-print-wrapper'
                  );
                }}
                className="w-2/3 bg-gradient-to-r from-[#d4af37] to-[#f3e3a0] hover:scale-[1.01] hover:brightness-110 active:scale-100 text-black py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                {isAr ? 'طباعة القيد بتنسيق رسمي' : 'Print Voucher Document'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* HIDDEN PRINT WRAPPER FOR SINGLE JOURNAL VOUCHER */}
      <div id="single-voucher-print-wrapper" style={{ display: 'none' }}>
        {selectedLedgerEntry && (
          <div style={{ padding: '20px', direction: isAr ? 'rtl' : 'ltr', fontFamily: 'Cairo, system-ui, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px double #d4af37', paddingBottom: '15px', marginBottom: '20px' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
                  {isAr ? 'ألكس للخدمات اللوجستية وتوصيل الطرود' : 'alx Cargo & Logistics Co.'}
                </h1>
                <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#555' }}>
                  {isAr ? 'الجمهورية اليمنية - صنعاء | مستند مقيد آلياً' : 'Republic of Yemen - Sanaa | Electronically Posted Document'}
                </p>
              </div>
              <div style={{ textAlign: isAr ? 'left' : 'right' }}>
                <h2 style={{ margin: 0, fontSize: '16px', color: '#d4af37', fontWeight: '900' }}>
                  {isAr ? 'سند قيد مالي مزدوج متوازن' : 'BALANCED JOURNAL VOUCHER'}
                </h2>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#111' }}>
                  {isAr ? 'رقم المستند: ' : 'Voucher No: '} {selectedLedgerEntry.refNumber}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '12px', marginBottom: '20px', borderBottom: '1px solid #ddd', paddingBottom: '15px' }}>
              <div>
                <strong>{isAr ? 'البيان الإجمالي:' : 'Particulars:'}</strong> {selectedLedgerEntry.title}
              </div>
              <div>
                <strong>{isAr ? 'تاريخ المعاملة:' : 'Transaction Date:'}</strong> {selectedLedgerEntry.date.toLocaleDateString()} {selectedLedgerEntry.date.toLocaleTimeString()}
              </div>
              <div>
                <strong>{isAr ? 'الطرف المدين:' : 'Debit Party:'}</strong> {selectedLedgerEntry.debitPartyName || '—'}
              </div>
              <div>
                <strong>{isAr ? 'الطرف الدائن:' : 'Credit Party:'}</strong> {selectedLedgerEntry.creditPartyName || '—'}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f7' }}>
                  <th style={{ border: '1px solid #ccc', padding: '10px', textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'الجانب المحاسبي' : 'Ledger Leg Side'}</th>
                  <th style={{ border: '1px solid #ccc', padding: '10px', textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'اسم الحساب والجهة' : 'Account Name'}</th>
                  <th style={{ border: '1px solid #ccc', padding: '10px', textAlign: isAr ? 'left' : 'right' }}>{isAr ? 'المبلغ' : 'Amount'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #eee', padding: '10px', color: '#059669', fontWeight: 'bold' }}>
                    {isAr ? 'من حـ/ (الطرف المدين)' : 'Debit Leg (Dr.)'}
                  </td>
                  <td style={{ border: '1px solid #eee', padding: '10px' }}>
                    {selectedLedgerEntry.debitPartyName || '—'}
                  </td>
                  <td style={{ border: '1px solid #eee', padding: '10px', textAlign: isAr ? 'left' : 'right', fontWeight: 'bold', color: '#059669' }}>
                    +{selectedLedgerEntry.amountOriginal.toLocaleString()} {selectedLedgerEntry.currencyOriginal}
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #eee', padding: '10px', color: '#dc2626', fontWeight: 'bold' }}>
                    {isAr ? 'إلى حـ/ (الطرف الدائن)' : 'Credit Leg (Cr.)'}
                  </td>
                  <td style={{ border: '1px solid #eee', padding: '10px' }}>
                    {selectedLedgerEntry.creditPartyName || '—'}
                  </td>
                  <td style={{ border: '1px solid #eee', padding: '10px', textAlign: isAr ? 'left' : 'right', fontWeight: 'bold', color: '#dc2626' }}>
                    -{selectedLedgerEntry.amountOriginal.toLocaleString()} {selectedLedgerEntry.currencyOriginal}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: '25px', padding: '12px', border: '1px solid #e3cc9a', borderRadius: '8px', backgroundColor: '#fffdf6', fontSize: '12px', fontWeight: 'bold' }}>
              <span>{isAr ? 'صافي القيمة الدفترية: ' : 'Net Amount: '}</span>
              <span>{selectedLedgerEntry.amountOriginal.toLocaleString()} {selectedLedgerEntry.currencyOriginal} (≈ {selectedLedgerEntry.amount.toLocaleString()} YER)</span>
            </div>

            <div style={{ marginTop: '50px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', fontSize: '11px', textAlign: 'center' }}>
              <div>
                <p style={{ fontWeight: 'bold', margin: '0 0 40px 0' }}>{isAr ? 'توقيع المحاسب والمُعدّ' : 'Prepared By'}</p>
                <div style={{ borderBottom: '1px dashed #aaa', width: '80%', margin: '0 auto' }}></div>
              </div>
              <div>
                <p style={{ fontWeight: 'bold', margin: '0 0 40px 0' }}>{isAr ? 'توقيع المستلم / العميل' : 'Received By'}</p>
                <div style={{ borderBottom: '1px dashed #aaa', width: '80%', margin: '0 auto' }}></div>
              </div>
              <div>
                <p style={{ fontWeight: 'bold', margin: '0 0 40px 0' }}>{isAr ? 'الاعتماد المالي / الإدارة' : 'Financial Controller'}</p>
                <div style={{ borderBottom: '1px dashed #aaa', width: '80%', margin: '0 auto' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
