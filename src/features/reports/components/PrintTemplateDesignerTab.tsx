import React from 'react';
import { RefreshCw, Save, Palette, RotateCcw, Download as DownloadIcon, Check, Eye } from 'lucide-react';
import type { PrintTemplateSettings } from '../types/reports.types';
import { notificationService } from '../../../services/notificationService';

export type { PrintTemplateSettings } from '../types/reports.types';

interface PrintTemplateDesignerTabProps {
  isAr: boolean;
  printSettings: PrintTemplateSettings;
  setPrintSettings: React.Dispatch<React.SetStateAction<PrintTemplateSettings>>;
  savingTemplate: boolean;
  handleSavePrintSettings: () => void;
  handleResetPrintSettings: () => void;
}

export const PrintTemplateDesignerTab: React.FC<PrintTemplateDesignerTabProps> = ({
  isAr,
  printSettings,
  setPrintSettings,
  savingTemplate,
  handleSavePrintSettings,
  handleResetPrintSettings,
}) => {
  return (
        /* TEMPLATE SETTINGS AND PRINT FORMS VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in no-print">

          {/* LEFT: Custom Template Editor Controls Panel */}
          <div className="lg:col-span-5 bg-[#111114] border border-slate-850 p-6 rounded-3xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <div>
                <h3 className="text-sm font-black text-white">{isAr ? 'محرر تصميم قوالب الطباعة' : 'Print Template Customizer'}</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{isAr ? 'تخصيص الهوية والشكل الخارجي والبيانات' : 'Branding & Layout Configuration'}</p>
              </div>
              <button
                onClick={handleSavePrintSettings}
                disabled={savingTemplate}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#d4af37] hover:bg-yellow-600 disabled:opacity-50 text-black text-xs font-black rounded-xl transition"
              >
                {savingTemplate ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isAr ? 'حفظ التغييرات' : 'Save Config'}
              </button>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {/* Paper Layout size options */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? 'حجم ونسق ورقة الطباعة' : 'Print Layout Canvas Size'}</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'A4', label: isAr ? 'ورق مالي A4 طولي' : 'A4 Portrait' },
                    { id: 'A4_Landscape', label: isAr ? 'ورق مالي A4 عرضي' : 'A4 Landscape' },
                    { id: '80mm', label: isAr ? 'شريط حراري 80mm' : '80mm Thermal Receipt' },
                    { id: '58mm', label: isAr ? 'شريط حراري 58mm' : '58mm Thermal Receipt' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setPrintSettings(prev => ({ ...prev, paperSize: opt.id as any }))}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-black text-center transition ${printSettings.paperSize === opt.id ? 'bg-[#d4af37]/15 text-[#d4af37] border-[#d4af37]' : 'bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-400'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Branding Titles (Arabic / English) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">{isAr ? 'عنوان رأس الورقة (عربي)' : 'Header Title (AR)'}</label>
                  <input
                    type="text"
                    value={printSettings.headerTitleAr}
                    onChange={e => setPrintSettings(p => ({ ...p, headerTitleAr: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-550 uppercase">{isAr ? 'عنوان الرأس (إنجليزي)' : 'Header Title (EN)'}</label>
                  <input
                    type="text"
                    value={printSettings.headerTitleEn}
                    onChange={e => setPrintSettings(p => ({ ...p, headerTitleEn: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              {/* Subtitles Description details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">{isAr ? 'العنوان الفرعي (عربي)' : 'Subtitle (AR)'}</label>
                  <input
                    type="text"
                    value={printSettings.subtitleAr}
                    onChange={e => setPrintSettings(p => ({ ...p, subtitleAr: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-550 uppercase">{isAr ? 'العنوان الفرعي (إنجليزي)' : 'Subtitle (EN)'}</label>
                  <input
                    type="text"
                    value={printSettings.subtitleEn}
                    onChange={e => setPrintSettings(p => ({ ...p, subtitleEn: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              {/* Tax Register options */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase block">{isAr ? 'الرقم الضريبي الموحد للمنشأة' : 'Corporate Tax ID Registration'}</label>
                <input
                  type="text"
                  value={printSettings.taxNumber}
                  onChange={e => setPrintSettings(p => ({ ...p, taxNumber: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-850 text-xs font-mono font-bold text-[#d4af37] rounded-xl px-3 py-2 outline-none"
                />
              </div>

              {/* Layout Custom Margins */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 block uppercase">{isAr ? 'هوامش ومقاسات محاذاة الصفحة' : 'Layout Margin Borders'}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'none', label: isAr ? 'بلا هوامش (0)' : 'No Margin' },
                    { id: 'minimal', label: isAr ? 'هوامش ضيقة (5mm)' : 'Minimal' },
                    { id: 'default', label: isAr ? 'افتراضي (12mm)' : 'Standard' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setPrintSettings(prev => ({ ...prev, margins: opt.id as any }))}
                      className={`px-3 py-2 rounded-lg border text-[11px] font-bold text-center transition ${printSettings.margins === opt.id ? 'bg-[#d4af37]/15 text-[#d4af37] border-[#d4af37]' : 'bg-slate-950 border-slate-850 text-slate-400'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout Font Size Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 block uppercase">{isAr ? 'حجم الخط الأساسي في مستند الفاتورة' : 'Invoice Typography Font Size'}</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'xs', label: isAr ? 'صغير جداً' : 'XS' },
                    { id: 'sm', label: isAr ? 'صغير' : 'Small' },
                    { id: 'md', label: isAr ? 'متوسط' : 'Medium' },
                    { id: 'lg', label: isAr ? 'كبير' : 'Large' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setPrintSettings(prev => ({ ...prev, fontSize: opt.id as any }))}
                      className={`px-1 py-1.5 rounded border text-[10px] font-black text-center transition ${printSettings.fontSize === opt.id ? 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]' : 'bg-slate-950 border-slate-850 text-slate-400'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle Switches */}
              <div className="space-y-2 border-t border-slate-850 pt-4">
                <span className="text-[10px] text-slate-550 block font-black uppercase tracking-widest mb-1">{isAr ? 'عناصر وهوامش المخرجات' : 'Toggle Specific Print Components'}</span>

                <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl cursor-pointer hover:bg-slate-900/50 transition">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-white">{isAr ? 'إدراج شعار سويفت شيب' : 'Include Corporate Identity Logo'}</span>
                    <span className="text-[9.5px] text-slate-500">{isAr ? 'عرض الشعار أعلى الرأس' : 'Render top logo overlay'}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={printSettings.showLogo}
                    onChange={e => setPrintSettings(p => ({ ...p, showLogo: e.target.checked }))}
                    className="w-4 h-4 text-[#d4af37] accent-[#d4af37] rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl cursor-pointer hover:bg-slate-900/50 transition">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-white">{isAr ? 'إظهار الرمز الشريطي والباركود' : 'Show Transaction Barcode'}</span>
                    <span className="text-[9.5px] text-slate-500">{isAr ? 'تسهيل التدقيق والمسح الضوئي للشحنة' : 'Fast receipt scanning barcode'}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={printSettings.showBarcode}
                    onChange={e => setPrintSettings(p => ({ ...p, showBarcode: e.target.checked }))}
                    className="w-4 h-4 text-[#d4af37] accent-[#d4af37] rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl cursor-pointer hover:bg-slate-900/50 transition">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-white">{isAr ? 'دمج مربعات التواقيع والاعتماد' : 'Add Auditor Signature Boxes'}</span>
                    <span className="text-[9.5px] text-slate-550">{isAr ? 'إضافة توقيع (المستلم، المحاسب، المدير العام)' : 'Render client, accountant, & admin signature slots'}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={printSettings.showSignatures}
                    onChange={e => setPrintSettings(p => ({ ...p, showSignatures: e.target.checked }))}
                    className="w-4 h-4 text-[#d4af37] accent-[#d4af37] rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl cursor-pointer hover:bg-slate-900/50 transition">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-white">{isAr ? 'تاريخ وقت المستند تلقائياً' : 'Show Datetime Stamps'}</span>
                    <span className="text-[9.5px] text-slate-550">{isAr ? 'طبع تاريخ ووقت المعاملة اللحظي' : 'Affix timestamp to print document'}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={(printSettings as any).showDateTime}
                    onChange={e => setPrintSettings(p => ({ ...p, showDateTime: e.target.checked }))}
                    className="w-4 h-4 text-[#d4af37] accent-[#d4af37] rounded"
                  />
                </label>
              </div>

              {/* Footer text (Arabic) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase block">{isAr ? 'ملاحظات وبنود تذييل الفاتورة (عربي)' : 'Footer Terms Text (AR)'}</label>
                <textarea
                  rows={2}
                  value={printSettings.footerTextAr}
                  onChange={e => setPrintSettings(p => ({ ...p, footerTextAr: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Footer text (English) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-550 uppercase block">{isAr ? 'ملاحظات وبنود تذييل الفاتورة (إنجليزي)' : 'Footer Terms Text (EN)'}</label>
                <textarea
                  rows={2}
                  value={printSettings.footerTextEn || ''}
                  onChange={e => setPrintSettings(p => ({ ...p, footerTextEn: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Table style */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 block uppercase">{isAr ? 'نمط الجدول والتأثير البصري للبيانات' : 'Ledger Table Border Layout'}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'solid', label: isAr ? 'خطوط متصلة' : 'Solid Border' },
                    { id: 'dashed', label: isAr ? 'متقطع رياضي' : 'Dashed Lines' },
                    { id: 'minimal', label: isAr ? 'بسيط مفرغ' : 'Minimal' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPrintSettings(prev => ({ ...prev, tableStyle: opt.id as any }))}
                      className={`px-2 py-2 rounded-xl border text-[11px] font-bold text-center transition ${(printSettings as any).tableStyle === opt.id ? 'bg-[#d4af37]/15 text-[#d4af37] border-[#d4af37]' : 'bg-slate-950 border-slate-850 text-slate-400'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 block uppercase">{isAr ? 'نوع الخط وهندسة الكلمات المطبوعة' : 'Typography Font Family'}</label>
                <select
                  value={(printSettings as any).fontFamily || 'Cairo'}
                  onChange={e => setPrintSettings(p => ({ ...p, fontFamily: e.target.value as any }))}
                  className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                >
                  <option value="Cairo">{isAr ? 'Cairo (خط دبي السلس - افتراضي)' : 'Cairo (Modern AR Sans)'}</option>
                  <option value="Inter">{isAr ? 'Inter (خط هندسي عالمي مفصل)' : 'Inter (International Sans)'}</option>
                  <option value="Segoe UI">{isAr ? 'Segoe UI (واجهة كشوفات الأعمال)' : 'Segoe UI (Systems Standard)'}</option>
                  <option value="JetBrains Mono">{isAr ? 'JetBrains Mono (جمالية الأكواد والرياضيات)' : 'JetBrains Mono (Technical Mono)'}</option>
                </select>
              </div>

              {/* Logo custom upload system */}
              <div className="space-y-1.5 pt-2 border-t border-slate-850">
                <label className="text-[10px] font-black text-slate-400 block uppercase">{isAr ? 'شعار وهوية العلامة التجارية المطبوعة' : 'Business Branding Logo'}</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder={isAr ? 'ضع رابط صورة الشعار URL (أو ارفع ملف بالأسفل)' : 'Logo Image URL Link'}
                    value={printSettings.logoUrl}
                    onChange={e => setPrintSettings(p => ({ ...p, logoUrl: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 text-xs font-mono text-white rounded-xl px-3 py-2 outline-none focus:border-[#d4af37]"
                  />

                  <div className="relative border border-dashed border-slate-800 hover:border-[#d4af37]/35 rounded-xl bg-slate-950 p-3 text-center cursor-pointer transition">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setPrintSettings(p => ({ ...p, logoUrl: reader.result as string }));
                            notificationService.notify({
                              title: isAr ? 'تم تحميل الشعار' : 'Logo Uploaded',
                              message: isAr ? 'تم تحويل الصورة محلياً وحفظ هوية الرأس بنجاح' : 'Custom picture loaded successfully',
                              type: 'success'
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400 text-xs py-1">
                      <DownloadIcon className="w-4 h-4 text-[#d4af37]" />
                      <span className="font-extrabold">{isAr ? 'اسحب أو اختر ملف صورة كشعار من جهازك' : 'Choose local image file'}</span>
                      <span className="text-[9px] text-slate-600">JPG, PNG, WEBP, SVG</span>
                    </div>
                  </div>

                  {printSettings.logoUrl && (
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-850 p-2 rounded-xl">
                      <img src={printSettings.logoUrl} alt="Logo preview" className="h-8 max-w-[130px] object-contain rounded bg-white p-1" />
                      <button
                        type="button"
                        onClick={() => setPrintSettings(p => ({ ...p, logoUrl: '' }))}
                        className="text-[10px] text-red-400 hover:text-red-300 font-extrabold px-2.5 py-1 bg-red-500/10 rounded-lg"
                      >
                        {isAr ? 'حذف الشعار التعبيري' : 'Delete Logo'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Signature custom titles editor */}
              <div className="space-y-3.5 border-t border-slate-850 pt-3">
                <span className="text-[10px] text-slate-550 block font-black uppercase tracking-widest">{isAr ? 'تخصيص أسماء وعناوين مربعات التواقيع' : 'Custom Auditor Signature Labels'}</span>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400">{isAr ? 'توقيع 1 (عربي)' : 'Sign 1 (AR)'}</label>
                      <input
                        type="text"
                        value={printSettings.signature1Ar || ''}
                        onChange={e => setPrintSettings(p => ({ ...p, signature1Ar: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#d4af37]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500">{isAr ? 'توقيع 1 (إنجليزي)' : 'Sign 1 (EN)'}</label>
                      <input
                        type="text"
                        value={printSettings.signature1En || ''}
                        onChange={e => setPrintSettings(p => ({ ...p, signature1En: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400">{isAr ? 'توقيع 2 (عربي)' : 'Sign 2 (AR)'}</label>
                      <input
                        type="text"
                        value={printSettings.signature2Ar || ''}
                        onChange={e => setPrintSettings(p => ({ ...p, signature2Ar: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#d4af37]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500">{isAr ? 'توقيع 2 (إنجليزي)' : 'Sign 2 (EN)'}</label>
                      <input
                        type="text"
                        value={printSettings.signature2En || ''}
                        onChange={e => setPrintSettings(p => ({ ...p, signature2En: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400">{isAr ? 'توقيع 3 (عربي)' : 'Sign 3 (AR)'}</label>
                      <input
                        type="text"
                        value={printSettings.signature3Ar || ''}
                        onChange={e => setPrintSettings(p => ({ ...p, signature3Ar: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#d4af37]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500">{isAr ? 'توقيع 3 (إنجليزي)' : 'Sign 3 (EN)'}</label>
                      <input
                        type="text"
                        value={printSettings.signature3En || ''}
                        onChange={e => setPrintSettings(p => ({ ...p, signature3En: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-850 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preset design styling colors selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-450 block uppercase">{isAr ? 'لون الهوية والمحاور المالية للمستند' : 'Corporate Identity Hex color'}</label>
                <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-2.5 rounded-xl">
                  {['#d4af37', '#10b981', '#ef4444', '#3b82f6', '#000000', '#f59e0b', '#8b5cf6'].map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setPrintSettings(prev => ({ ...prev, primaryColor: col }))}
                      className="w-7 h-7 rounded-full border border-slate-800 transition transform hover:scale-110 flex items-center justify-center relative"
                      style={{ backgroundColor: col }}
                    >
                      {printSettings.primaryColor === col && <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />}
                    </button>
                  ))}

                  {/* Hex input and inline standard color picker */}
                  <div className="flex items-center gap-1.5 border-l border-slate-850 pl-3 ml-2 shrink-0">
                    <input
                      type="color"
                      value={printSettings.primaryColor}
                      onChange={e => setPrintSettings(p => ({ ...p, primaryColor: e.target.value }))}
                      className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={printSettings.primaryColor}
                      onChange={e => setPrintSettings(p => ({ ...p, primaryColor: e.target.value }))}
                      className="w-16 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[9.5px] font-mono text-[#d4af37]"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT: Live print mock visualization box */}
          <div className="lg:col-span-7 space-y-4">
            <span className="text-xs font-black text-[#d4af37] uppercase flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              {isAr ? 'شاشة الرصد والمعاينة المباشرة واللحظية للقالب' : 'Live Interactive Visual Output Sandbox'}
            </span>

            {/* Simulated Sheet container reflecting their exact selected paper size */}
            <div className="bg-slate-950/60 border border-slate-850 p-6 rounded-3xl flex justify-center shadow-inner overflow-x-auto min-h-[500px]">
              <div
                className={`bg-white text-black p-6 rounded-xl shadow-2xl relative border border-slate-300 text-start`}
                style={{
                  width: printSettings.paperSize.startsWith('80mm') ? '300px' : printSettings.paperSize.startsWith('58mm') ? '240px' : '520px',
                  minHeight: '400px',
                  fontFamily: `"${(printSettings as any).fontFamily || 'Cairo'}", sans-serif`,
                  fontSize: printSettings.fontSize === 'xs' ? '10px' : printSettings.fontSize === 'sm' ? '12px' : printSettings.fontSize === 'md' ? '14px' : '16px'
                }}
              >

                {/* Simulated Stamp Logo */}
                {printSettings.showLogo && (
                  <div className="flex justify-center mb-4 border-b pb-3 border-slate-200">
                    {printSettings.logoUrl ? (
                      <img src={printSettings.logoUrl} alt="Logo" className="h-10 object-contain max-w-[180px] p-0.5 bg-white rounded" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-mono font-black" style={{ backgroundColor: printSettings.primaryColor }}>SS</div>
                        <span className="font-mono font-black text-xs tracking-widest text-[#000000]">SWIFTSHIP</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Company Headers from Editor */}
                <div className="text-center space-y-1 mb-5">
                  <h4 className="font-extrabold text-[15px] leading-tight" style={{ color: printSettings.primaryColor }}>{printSettings.headerTitleAr}</h4>
                  <h5 className="font-mono font-bold text-[11px] text-slate-600 tracking-wider uppercase leading-none">{printSettings.headerTitleEn}</h5>
                  <p className="text-[10px] text-slate-500 font-bold">{printSettings.subtitleAr}</p>
                  <p className="text-[9px] font-mono text-slate-400 font-semibold uppercase">{printSettings.subtitleEn}</p>
                </div>

                {/* Document Subtitle based on layout */}
                <div className="border border-slate-300 bg-slate-100 p-2.5 rounded-lg text-center font-bold text-[11px] mb-4">
                  <span>{isAr ? 'سند مالي مؤقت ومصادق / شحن بضائع مستحقة' : 'Receipt Voucher - Cargo Ledger'}</span>
                </div>

                {/* Mock data specs */}
                <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-600 border-b pb-3 mb-4">
                  <div>
                    <span>{isAr ? 'الرقم المرجعي للمستند:' : 'Doc Reference:'} </span>
                    <strong className="text-black font-mono">ALX-ORD-1153</strong>
                  </div>
                  <div className="text-right">
                    <span>{isAr ? 'كود العقد المالي:' : 'Account Ledger:'} </span>
                    <strong className="text-black font-mono">110-CUST399</strong>
                  </div>
                  <div>
                    <span>{isAr ? 'التاريخ الفعلي:' : 'Submission Date:'} </span>
                    <strong className="text-black font-mono">2026-06-11</strong>
                  </div>
                  <div className="text-right">
                    <span>{isAr ? 'الرقابة الضريبية:' : 'Corporate Tax ID:'} </span>
                    <strong className="text-black font-mono">{printSettings.taxNumber}</strong>
                  </div>
                </div>

                {/* Mock Items list */}
                <div className="space-y-2 text-[10px] border-b pb-4 mb-4">
                  <div className="flex justify-between font-bold text-slate-500 border-b pb-1">
                    <span>{isAr ? 'البيانات وتوصيف الحركة' : 'Item Particulars'}</span>
                    <span>{isAr ? 'القيمة الإجمالية' : 'Cost sum'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isAr ? 'شحن طرد كرتون ومواد تجميع خاصة' : 'Procure and Parcel Cargo Courier'}</span>
                    <strong className="font-mono">1,150 SAR</strong>
                  </div>
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>{isAr ? 'خدمات التغليف المؤمن (صندوق خشبي)' : 'Solid Wood Packaging Services'}</span>
                    <strong className="font-mono">50 SAR</strong>
                  </div>
                  <div className="flex justify-between font-black text-xs pt-1.5 border-t border-dashed">
                    <span>{isAr ? 'الرصيد الصافي المجمع:' : 'Net Aggregate Total:'}</span>
                    <span className="font-mono text-emerald-600">1,200 SAR</span>
                  </div>
                </div>

                {/* Simulated Barcode */}
                {printSettings.showBarcode && (
                  <div className="flex flex-col items-center justify-center py-2 mb-4">
                    <div className="w-36 h-6 border bg-slate-100 flex items-center justify-center text-[7px] font-mono tracking-[4px] font-bold text-slate-500 border-slate-200">
                      |||||||||||||||||||||||
                    </div>
                    <span className="text-[7.5px] font-mono mt-1 text-slate-400">ALX-1153-CUST</span>
                  </div>
                )}

                {/* Footer notes text */}
                <div className="text-center text-[9px] text-slate-500 italic font-bold mb-6">
                  <p className="leading-relaxed leading-3">{printSettings.footerTextAr}</p>
                  <p className="font-mono mt-1 leading-3">{printSettings.footerTextEn}</p>
                </div>

                {/* Verified Signature layout */}
                {printSettings.showSignatures && (
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[7px] font-bold border-t pt-3">
                    <div className="flex flex-col">
                      <span className="text-slate-400 italic mb-4">
                        {isAr
                          ? (printSettings.signature1Ar || 'توقيع المستلم والعميل')
                          : (printSettings.signature1En || 'Recipient Stamp')}
                      </span>
                      <div className="border-b w-full" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-400 italic mb-4">
                        {isAr
                          ? (printSettings.signature2Ar || 'اعتماد المحاسب المسؤول')
                          : (printSettings.signature2En || 'Corporate Auditor')}
                      </span>
                      <div className="border-b w-full" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-400 italic mb-4">
                        {isAr
                          ? (printSettings.signature3Ar || 'المدير العام والختم')
                          : (printSettings.signature3En || 'Corporate Director')}
                      </span>
                      <div className="border-b w-full" />
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
  );
};
