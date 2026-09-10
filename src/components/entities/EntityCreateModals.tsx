import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe, MapPin, Phone, Truck, User, X, ShieldCheck, Calendar, Key, Lock, CheckCircle2, Building2, Briefcase } from 'lucide-react';
import { addDoc, collection, db, doc, setDoc, updateDoc } from '../../lib/supabase-firebase-adapter';
import { financialAccountService } from '../../services/financialAccountService';
import { activityLogService } from '../../services/activityLogService';
import { notificationService } from '../../services/notificationService';
import LocationMapPickerModal from '../common/LocationMapPickerModal';
import { portalUserService } from '../../services/portalUserService';
import { validatePasswordFields } from '../../utils/passwordUtils';

type SharedProps = {
  isOpen: boolean;
  onClose: () => void;
  isAr: boolean;
  settings: any;
};

function ModalShell({
  children,
  title,
  onClose,
  maxWidth = 'max-w-4xl lg:max-w-5xl',
  headerExtra
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  maxWidth?: string;
  headerExtra?: React.ReactNode;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[1000000] isolate flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className={`flex w-full ${maxWidth} max-h-[94vh] flex-col overflow-hidden rounded-3xl border border-[#d4af37]/30 bg-slate-900 shadow-2xl transition-all`}>
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4 text-xs font-black text-white">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-[#d4af37]">{title}</span>
            {headerExtra}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-800/80 p-2 text-slate-400 transition hover:bg-rose-500/20 hover:text-rose-400" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER CREATE MODAL
// ─────────────────────────────────────────────────────────────────────────────
export function CustomerCreateModal({
  isOpen,
  onClose,
  isAr,
  settings,
  initialName = '',
  onCreated
}: SharedProps & { initialName?: string; onCreated: (customer: any) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'details' | 'portal'>('basic');
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [previewId, setPreviewId] = useState('cust_1130-????');

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    country: 'اليمن',
    company_name: '',
    id_number: '',
    max_debt: 0,
    gps_location: '',
    lat: 15.3694,
    lng: 44.1910,
    notes: ''
  });

  const [createPortalUser, setCreatePortalUser] = useState(false);
  const [portalFormData, setPortalFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    portal_role: 'client'
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
      setFormData({
        fullName: initialName,
        phone: '',
        email: '',
        address: '',
        city: '',
        country: 'اليمن',
        company_name: '',
        id_number: '',
        max_debt: 0,
        gps_location: '',
        lat: 15.3694,
        lng: 44.1910,
        notes: ''
      });
      setCreatePortalUser(false);
      setPortalFormData({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        portal_role: 'client'
      });
      financialAccountService.getNextAccountIdentifiers('customer').then(res => {
        setPreviewId(`cust_${res.accountCode}`);
      }).catch(() => { });
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const passwordValidation = validatePasswordFields(
    portalFormData.password,
    portalFormData.confirmPassword,
    isAr,
    createPortalUser
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !formData.fullName.trim() || !formData.phone.trim()) {
      return notificationService.notify({
        title: isAr ? 'بيانات ناقصة' : 'Missing Data',
        message: isAr ? 'يرجى كتابة اسم العميل الكامل ورقم الهاتف' : 'Full name and phone required',
        type: 'error'
      });
    }

    if (createPortalUser) {
      if (!portalFormData.username.trim()) {
        return notificationService.notify({
          title: isAr ? 'اسم المستخدم مطلوب' : 'Username Required',
          message: isAr ? 'يرجى كتابة اسم المستخدم للدخول للموقع' : 'Please enter portal username',
          type: 'error'
        });
      }
      if (!passwordValidation.isValid) {
        return notificationService.notify({
          title: isAr ? 'خطأ في كلمة المرور' : 'Password Error',
          message: passwordValidation.errorMessage,
          type: 'error'
        });
      }
    }

    setSubmitting(true);
    try {
      const { accountCode } = await financialAccountService.getNextAccountIdentifiers('customer');
      const id = `cust_${accountCode}`;

      const customerPayload = {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        gps_location: formData.gps_location,
        notes: formData.notes.trim(),
        createdAt: Date.now()
      };

      const reference = await addDoc(id, collection(db, 'customers'), customerPayload);
      const account = await financialAccountService.createAccountForEntity('customer', reference.id, formData.fullName, settings.currency || 'SAR');

      let portalUserId = '';
      if (createPortalUser) {
        const portalRes = await portalUserService.createPortalUser(
          {
            username: portalFormData.username.trim(),
            email: portalFormData.email.trim() || formData.email.trim(),
            password: portalFormData.password,
            portal_role: portalFormData.portal_role || 'client',
            approval_status: 'approved',
            customerId: reference.id,
            linkedAccId: account.id,
            fullName: formData.fullName,
            phone: formData.phone
          },
          {
            address: formData.address,
            gps_location: formData.gps_location,
            city: formData.city,
            country: formData.country,
            company_name: formData.company_name,
            id_number: formData.id_number,
            max_debt: Number(formData.max_debt) || 0,
            notes: formData.notes
          }
        );
        portalUserId = portalRes.id;
      } else {
        await portalUserService.saveCustomerDetails(reference.id, '', {
          address: formData.address,
          gps_location: formData.gps_location,
          city: formData.city,
          country: formData.country,
          company_name: formData.company_name,
          id_number: formData.id_number,
          max_debt: Number(formData.max_debt) || 0,
          notes: formData.notes
        });
      }

      const customer = {
        id: reference.id,
        ...formData,
        financialAccountId: account.id,
        financialAccountCode: account.accountCode,
        portalUserId
      };

      activityLogService.log('add_customer', formData.fullName, { ...formData });

      notificationService.notify({
        title: isAr ? 'تم تسجيل العميل' : 'Customer Enrolled',
        message: isAr
          ? `تم حفظ العميل وتفاصيله الإضافية ${createPortalUser ? 'وإنشاء حساب الموقع المباشر له' : ''} بنجاح`
          : `Customer ${formData.fullName} saved successfully`,
        type: 'success'
      });

      onCreated(customer);
      onClose();
    } catch (error: any) {
      console.error(error);
      notificationService.notify({
        title: isAr ? 'تعذر إنشاء العميل' : 'Customer creation failed',
        message: error?.message || (isAr ? 'تعذر حفظ العميل.' : 'Unable to save customer.'),
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const currentDateStr = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });

  return (
    <>
      <ModalShell
        title={isAr ? 'تسجيل ونمذجة عميل جديد' : 'Register New Customer'}
        onClose={onClose}
        maxWidth="max-w-4xl lg:max-w-5xl"
        headerExtra={
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 px-3 py-1 text-[11px] font-black text-[#d4af37]">
              🆔 {previewId}
            </span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-[11px] font-black text-emerald-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {currentDateStr}
            </span>
          </div>
        }
      >
        {/* Top Header Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-6 py-3 shrink-0">
          {/* Tab Selection */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${activeTab === 'basic'
                  ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
            >
              {isAr ? '📋 البيانات الأساسية' : 'Basic Info'}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${activeTab === 'details'
                  ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
            >
              {isAr ? '🗺️ التفاصيل والموقع (cust_details)' : 'Extra Details & GPS'}
            </button>

            {createPortalUser && (
              <button
                type="button"
                onClick={() => setActiveTab('portal')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition animate-pulse ${activeTab === 'portal'
                    ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20'
                    : 'bg-amber-500/20 text-[#d4af37] border border-amber-500/30 hover:bg-amber-500/30'
                  }`}
              >
                {isAr ? '🌐 مستخدم الموقع (portal_users)' : 'Portal User'}
              </button>
            )}
          </div>

          {/* Create Portal User Toggle Button at Top Action Bar */}
          <button
            type="button"
            onClick={() => {
              const next = !createPortalUser;
              setCreatePortalUser(next);
              if (next) setActiveTab('portal');
              else if (activeTab === 'portal') setActiveTab('basic');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 border ${createPortalUser
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                : 'bg-amber-500/10 text-[#d4af37] border-amber-500/30 hover:bg-amber-500/20'
              }`}
          >
            <Globe className="w-4 h-4" />
            {createPortalUser
              ? (isAr ? '✓ إلغاء ربط مستخدم الموقع' : '✓ Unlink Portal User')
              : (isAr ? '🌐 إنشاء مستخدم في الموقع' : '🌐 Create Website User')}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-6 text-start">
          {/* TAB 1: BASIC INFO */}
          {activeTab === 'basic' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-black/40 border border-slate-800 space-y-4">
                <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4" /> {isAr ? 'معلومات العميل الشخصية والرسمية' : 'Customer Official Info'}
                </h3>
                <FormField label={isAr ? 'الاسم الثلاثي أو الرباعي للعميل' : 'Full Customer Name'} required icon={<User className="h-4 w-4" />}>
                  <input required value={formData.fullName} onChange={(event) => setFormData({ ...formData, fullName: event.target.value })} className={inputClass} placeholder="أحمد محمد سالم..." />
                </FormField>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label={isAr ? 'رقم الهاتف (الواتساب)' : 'Phone'} required icon={<Phone className="h-4 w-4" />}>
                    <input required value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} className={inputClass} placeholder="770000000" />
                  </FormField>

                  <FormField label={isAr ? 'البريد الإلكتروني الأساسي' : 'Email'}>
                    <input type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} className={inputClass} placeholder="customer@domain.com" />
                  </FormField>
                </div>
              </div>

              <FormField label={isAr ? 'ملاحظات وتصنيفات إدارية' : 'Administrative notes'}>
                <textarea rows={3} value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} className={inputClass} placeholder="أي ملاحظات خاصة..." />
              </FormField>
            </div>
          )}

          {/* TAB 2: EXTRA DETAILS & GPS */}
          {activeTab === 'details' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-black/40 border border-slate-800 space-y-4">
                <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> {isAr ? 'بيانات العنوان والسجل التجاري' : 'Address & Commercial Registry'}
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label={isAr ? 'الدولة' : 'Country'}>
                    <input value={formData.country} onChange={(event) => setFormData({ ...formData, country: event.target.value })} className={inputClass} />
                  </FormField>
                  <FormField label={isAr ? 'المدينة / المحافظة' : 'City'}>
                    <input value={formData.city} onChange={(event) => setFormData({ ...formData, city: event.target.value })} placeholder="صنعاء / عدن..." className={inputClass} />
                  </FormField>
                </div>

                <FormField label={isAr ? 'العنوان التفصيلي ومحل الإقامة' : 'Address'} icon={<MapPin className="h-4 w-4" />}>
                  <input value={formData.address} onChange={(event) => setFormData({ ...formData, address: event.target.value })} placeholder="المنطقة، الشارع، رقم المنزل..." className={inputClass} />
                </FormField>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label={isAr ? 'اسم الشركة / المؤسسة' : 'Company Name'}>
                    <input value={formData.company_name} onChange={(event) => setFormData({ ...formData, company_name: event.target.value })} className={inputClass} />
                  </FormField>
                  <FormField label={isAr ? 'السجل التجاري / رقم الهوية' : 'ID / Register Number'}>
                    <input value={formData.id_number} onChange={(event) => setFormData({ ...formData, id_number: event.target.value })} className={inputClass} />
                  </FormField>
                </div>

                <FormField label={isAr ? 'سقف الدين الأقصى المسموح (ريال)' : 'Max Debt Limit'}>
                  <input type="number" min="0" value={formData.max_debt} onChange={(event) => setFormData({ ...formData, max_debt: parseFloat(event.target.value) || 0 })} className={inputClass} />
                </FormField>
              </div>

              {/* Map GPS Location picker trigger */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-[#d4af37] flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {isAr ? 'تثبيت موقع GPS على الخريطة التفاعلية' : 'GPS Location on Map'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsMapOpen(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[#d4af37] text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <MapPin className="w-4 h-4" />
                    {isAr ? 'فتح الخريطة التفاعلية لتثبيت المكان 🗺️' : 'Open Interactive Map 🗺️'}
                  </button>
                </div>

                <input
                  type="text"
                  readOnly
                  value={formData.gps_location}
                  placeholder="https://maps.google.com/?q=..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs font-mono font-bold text-slate-300 outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 3: WEBSITE PORTAL USER (portal_users) */}
          {activeTab === 'portal' && createPortalUser && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-5 rounded-2xl bg-black/40 border border-amber-500/30 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> {isAr ? 'بيانات حساب تسجيل الدخول للموقع (portal_users)' : 'Website Credentials'}
                  </h3>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                    {isAr ? 'ربط تلقائي بالعميل' : 'Auto Linked'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label={isAr ? 'اسم المستخدم للموقع *' : 'Portal Username *'} required icon={<User className="h-4 w-4" />}>
                    <input
                      required
                      type="text"
                      placeholder="client_username"
                      value={portalFormData.username}
                      onChange={(e) => setPortalFormData({ ...portalFormData, username: e.target.value })}
                      className={inputClass}
                    />
                  </FormField>

                  <FormField label={isAr ? 'البريد الإلكتروني للدخول' : 'Portal Email'} icon={<Phone className="h-4 w-4" />}>
                    <input
                      type="email"
                      placeholder="client@web.com"
                      value={portalFormData.email}
                      onChange={(e) => setPortalFormData({ ...portalFormData, email: e.target.value })}
                      className={inputClass}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label={isAr ? 'كلمة المرور للموقع *' : 'Portal Password *'} required icon={<Lock className="h-4 w-4" />}>
                    <input
                      required
                      type="password"
                      placeholder="••••••••"
                      value={portalFormData.password}
                      onChange={(e) => setPortalFormData({ ...portalFormData, password: e.target.value })}
                      className={inputClass}
                    />
                  </FormField>

                  <FormField label={isAr ? 'تأكيد كلمة المرور *' : 'Confirm Password *'} required icon={<Lock className="h-4 w-4" />}>
                    <input
                      required
                      type="password"
                      placeholder="••••••••"
                      value={portalFormData.confirmPassword}
                      onChange={(e) => setPortalFormData({ ...portalFormData, confirmPassword: e.target.value })}
                      className={inputClass}
                    />
                  </FormField>
                </div>

                {/* Live Password Strength Indicator */}
                {portalFormData.password && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-400">{isAr ? 'قوة كلمة المرور:' : 'Password Strength:'}</span>
                      <span className={passwordValidation.strengthColor}>{passwordValidation.strengthLabel}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${passwordValidation.strengthScore >= 80 ? 'bg-emerald-500' : passwordValidation.strengthScore >= 60 ? 'bg-yellow-500' : 'bg-rose-500'
                          }`}
                        style={{ width: `${passwordValidation.strengthScore}%` }}
                      />
                    </div>
                    {portalFormData.confirmPassword !== undefined && portalFormData.confirmPassword !== '' && (
                      <div className="text-[11px] font-bold text-slate-400">
                        {portalFormData.password === portalFormData.confirmPassword ? (
                          <span className="text-emerald-400 flex items-center gap-1">✓ {isAr ? 'كلمتا المرور متطابقتان' : 'Passwords match'}</span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1">✕ {isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <FormField label={isAr ? 'نوع دور المستخدم في الموقع' : 'Portal Role'}>
                  <select
                    value={portalFormData.portal_role}
                    onChange={(e) => setPortalFormData({ ...portalFormData, portal_role: e.target.value })}
                    className={inputClass}
                  >
                    <option value="client">{isAr ? 'عميل افتراضي (Client)' : 'Default Client'}</option>
                    <option value="dealer">{isAr ? 'تاجر / موزع (Dealer)' : 'Dealer'}</option>
                    <option value="vip">{isAr ? 'عميل ممتاز (VIP)' : 'VIP Client'}</option>
                  </select>
                </FormField>
              </div>
            </div>
          )}

          {/* Bottom Footer Metadata Display & Submit Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4 shrink-0">
            <div className="flex items-center gap-4 text-[11px] text-slate-400 font-bold">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {isAr ? 'حساب مالي تلقائي (1130)' : 'Auto Account (1130)'}
              </span>
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-[#d4af37]" />
                {createPortalUser ? (isAr ? 'سيتم إنشاء حساب الموقع' : 'Portal User Active') : (isAr ? 'بدون حساب موقع' : 'No Portal User')}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-400 transition hover:bg-slate-800">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-gradient-to-r from-[#d4af37] via-amber-500 to-yellow-600 px-6 py-2.5 text-xs font-black text-black transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {submitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'تأمين وحفظ بيانات العميل 💾' : 'Save Customer 💾')}
              </button>
            </div>
          </div>
        </form>
      </ModalShell>

      <LocationMapPickerModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        initialData={{
          country: formData.country,
          city: formData.city,
          street: formData.address,
          addressDetails: formData.address,
          lat: formData.lat,
          lng: formData.lng,
          gps_location: formData.gps_location
        }}
        onSelectLocation={(data) => {
          setFormData(prev => ({
            ...prev,
            country: data.country || prev.country,
            city: data.city || prev.city,
            address: [data.governorate, data.city, data.street, data.addressDetails].filter(Boolean).join(' - ') || prev.address,
            lat: data.lat || prev.lat,
            lng: data.lng || prev.lng,
            gps_location: data.gps_location || prev.gps_location
          }));
        }}
        isAr={isAr}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE CREATE MODAL
// ─────────────────────────────────────────────────────────────────────────────
export function EmployeeCreateModal({
  isOpen,
  onClose,
  isAr,
  settings,
  onCreated
}: SharedProps & { onCreated: (employee: any) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'details' | 'system'>('basic');
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [previewId, setPreviewId] = useState('emp_1140-????');

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    country: 'اليمن',
    gps_location: '',
    lat: 15.3694,
    lng: 44.1910,
    jobsType: 'إداري',
    monthlySalary: 0,
    currency: 'YER',
    commissionRate: 0,
    notes: ''
  });

  const [createSystemUser, setCreateSystemUser] = useState(false);
  const [systemFormData, setSystemFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    systemPin: '',
    role: 'Staff'
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
      setFormData({
        fullName: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        country: 'اليمن',
        gps_location: '',
        lat: 15.3694,
        lng: 44.1910,
        jobsType: 'إداري',
        monthlySalary: 0,
        currency: settings?.currency || 'YER',
        commissionRate: 0,
        notes: ''
      });
      setCreateSystemUser(false);
      setSystemFormData({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        systemPin: '',
        role: 'Staff'
      });
      financialAccountService.getNextAccountIdentifiers('employee').then(res => {
        setPreviewId(`emp_${res.accountCode}`);
      }).catch(() => { });
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const passwordValidation = validatePasswordFields(
    systemFormData.password,
    systemFormData.confirmPassword,
    isAr,
    createSystemUser
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !formData.fullName.trim()) {
      return notificationService.notify({
        title: isAr ? 'خطأ' : 'Validation Error',
        message: isAr ? 'يرجى كتابة اسم الموظف الكامل' : 'Full name is required',
        type: 'error'
      });
    }

    if (createSystemUser) {
      if (!systemFormData.username.trim()) {
        return notificationService.notify({
          title: isAr ? 'اسم المستخدم مطلوب' : 'Username Required',
          message: isAr ? 'يرجى كتابة اسم المستخدم للنظام' : 'Please enter system username',
          type: 'error'
        });
      }
      if (!passwordValidation.isValid) {
        return notificationService.notify({
          title: isAr ? 'خطأ في كلمة المرور' : 'Password Error',
          message: passwordValidation.errorMessage,
          type: 'error'
        });
      }
    }

    setSubmitting(true);
    try {
      const { accountCode } = await financialAccountService.getNextAccountIdentifiers('employee');
      const newId = `emp_${accountCode}`;
      const now = Date.now();

      const empData = {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        country: formData.country.trim(),
        gps_location: formData.gps_location,
        jobsType: formData.jobsType,
        monthlySalary: Number(formData.monthlySalary) || 0,
        currency: formData.currency,
        commissionRate: Number(formData.commissionRate) || 0,
        notes: formData.notes.trim(),
        disabled: false,
        createdAt: now
      };

      await setDoc(doc(db, 'employees', newId), empData);

      const account = await financialAccountService.createAccountForEntity(
        'employee',
        newId,
        formData.fullName.trim(),
        formData.currency,
        Number(formData.monthlySalary) || 0
      );

      let systemUserId = '';
      if (createSystemUser) {
        const userId = 'usr_' + Math.random().toString(36).substring(2, 11);
        const userPayload = {
          id: userId,
          username: systemFormData.username.trim(),
          email: systemFormData.email.trim() || formData.email.trim() || `${systemFormData.username.trim()}@system.local`,
          password: systemFormData.password,
          systemPin: systemFormData.systemPin.trim(),
          fullName: formData.fullName.trim(),
          phone: formData.phone.trim(),
          role: systemFormData.role || 'Staff',
          disabled: false,
          linkedType: 'employee',
          linkedEntity: newId,
          createdAt: now
        };
        await setDoc(doc(db, 'users', userId), userPayload);
        systemUserId = userId;
      }

      const createdEmp = {
        id: newId,
        ...empData,
        financialAccountId: account.id,
        financialAccountCode: account.accountCode,
        systemUserId
      };

      activityLogService.log('add_employee', formData.fullName, { ...formData });
      notificationService.notify({
        title: isAr ? 'إضافة موظف' : 'Employee Added',
        message: isAr ? `تمت إضافة الموظف ${formData.fullName} بنجاح` : `Employee ${formData.fullName} created`,
        type: 'success'
      });

      onCreated(createdEmp);
      onClose();
    } catch (error: any) {
      console.error(error);
      notificationService.notify({
        title: isAr ? 'تعذر إنشاء الموظف' : 'Employee creation failed',
        message: error?.message || (isAr ? 'حدث خطأ أثناء حفظ بيانات الموظف' : 'Error saving employee'),
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const currentDateStr = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });

  return (
    <>
      <ModalShell
        title={isAr ? 'إضافة موظف كادر جديد وتقسيم البيانات' : 'Register New Employee'}
        onClose={onClose}
        maxWidth="max-w-4xl lg:max-w-5xl"
        headerExtra={
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 px-3 py-1 text-[11px] font-black text-[#d4af37]">
              🆔 {previewId}
            </span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-[11px] font-black text-emerald-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {currentDateStr}
            </span>
          </div>
        }
      >
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-6 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${activeTab === 'basic'
                  ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
            >
              {isAr ? '📋 البيانات الوظيفية والمالية' : 'Basic & Payroll'}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${activeTab === 'details'
                  ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
            >
              {isAr ? '🗺️ العنوان والموقع الجغرافي' : 'Address & GPS'}
            </button>

            {createSystemUser && (
              <button
                type="button"
                onClick={() => setActiveTab('system')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition animate-pulse ${activeTab === 'system'
                    ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20'
                    : 'bg-amber-500/20 text-[#d4af37] border border-amber-500/30 hover:bg-amber-500/30'
                  }`}
              >
                {isAr ? '👤 مستخدم النظام (users)' : 'System User'}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !createSystemUser;
              setCreateSystemUser(next);
              if (next) setActiveTab('system');
              else if (activeTab === 'system') setActiveTab('basic');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 border ${createSystemUser
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                : 'bg-amber-500/10 text-[#d4af37] border-amber-500/30 hover:bg-amber-500/20'
              }`}
          >
            <User className="w-4 h-4" />
            {createSystemUser
              ? (isAr ? '✓ إلغاء حساب النظام' : '✓ Unlink System User')
              : (isAr ? '💻 إنشاء مستخدم في النظام' : '💻 Create System User')}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-6 text-start">
          {activeTab === 'basic' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-black/40 border border-slate-800 space-y-4">
                <FormField label={isAr ? 'الاسم الكامل للموظف *' : 'Employee Full Name *'} required icon={<User className="h-4 w-4" />}>
                  <input required value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className={inputClass} />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label={isAr ? 'رقم الهاتف' : 'Phone'} icon={<Phone className="h-4 w-4" />}>
                    <input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputClass} />
                  </FormField>
                  <FormField label={isAr ? 'البريد الإلكتروني' : 'Email'}>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField label={isAr ? 'المسمى الوظيفي' : 'Job Title'} icon={<Briefcase className="h-4 w-4" />}>
                    <select value={formData.jobsType} onChange={(e) => setFormData({ ...formData, jobsType: e.target.value })} className={inputClass}>
                      <option value="إداري">{isAr ? 'إداري / عام' : 'Administrative'}</option>
                      <option value="محاسب">{isAr ? 'محاسب مالي' : 'Accountant'}</option>
                      <option value="أمين مستودع">{isAr ? 'أمين مستودع' : 'Warehouse Manager'}</option>
                      <option value="خدمة عملاء">{isAr ? 'خدمة عملاء' : 'Customer Service'}</option>
                      <option value="مدير فرع">{isAr ? 'مدير فرع' : 'Branch Manager'}</option>
                    </select>
                  </FormField>

                  <FormField label={isAr ? 'الراتب الشهري الأساسي' : 'Monthly Salary'}>
                    <input type="number" min="0" value={formData.monthlySalary} onChange={(e) => setFormData({ ...formData, monthlySalary: parseFloat(e.target.value) || 0 })} className={inputClass} />
                  </FormField>

                  <FormField label={isAr ? 'عملة صرف الراتب' : 'Salary Currency'}>
                    <select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className={inputClass}>
                      <option value="YER">ريال يمني (YER)</option>
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                    </select>
                  </FormField>
                </div>
              </div>

              <FormField label={isAr ? 'ملاحظات إدارية' : 'Notes'}>
                <textarea rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className={inputClass} />
              </FormField>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-black/40 border border-slate-800 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label={isAr ? 'الدولة' : 'Country'}>
                    <input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className={inputClass} />
                  </FormField>
                  <FormField label={isAr ? 'المدينة' : 'City'}>
                    <input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className={inputClass} />
                  </FormField>
                </div>

                <FormField label={isAr ? 'العنوان التفصيلي' : 'Address'} icon={<MapPin className="h-4 w-4" />}>
                  <input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputClass} />
                </FormField>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-[#d4af37] flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {isAr ? 'تثبيت موقع GPS على الخريطة التفاعلية' : 'GPS Location on Map'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsMapOpen(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[#d4af37] text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <MapPin className="w-4 h-4" />
                    {isAr ? 'فتح الخريطة التفاعلية لتثبيت المكان 🗺️' : 'Open Interactive Map 🗺️'}
                  </button>
                </div>

                <input
                  type="text"
                  readOnly
                  value={formData.gps_location}
                  placeholder="https://maps.google.com/?q=..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs font-mono font-bold text-slate-300 outline-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'system' && createSystemUser && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-5 rounded-2xl bg-black/40 border border-amber-500/30 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> {isAr ? 'بيانات حساب تسجيل الدخول بالنظام (users)' : 'System User Credentials'}
                  </h3>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                    {isAr ? 'ربط تلقائي بالموظف' : 'Auto Linked'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label={isAr ? 'اسم المستخدم للنظام *' : 'System Username *'} required icon={<User className="h-4 w-4" />}>
                    <input
                      required
                      type="text"
                      placeholder="emp_user"
                      value={systemFormData.username}
                      onChange={(e) => setSystemFormData({ ...systemFormData, username: e.target.value })}
                      className={inputClass}
                    />
                  </FormField>

                  <FormField label={isAr ? 'البريد الإلكتروني للنظام' : 'System Email'}>
                    <input
                      type="email"
                      placeholder="emp@system.local"
                      value={systemFormData.email}
                      onChange={(e) => setSystemFormData({ ...systemFormData, email: e.target.value })}
                      className={inputClass}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label={isAr ? 'كلمة المرور للنظام *' : 'System Password *'} required icon={<Lock className="h-4 w-4" />}>
                    <input
                      required
                      type="password"
                      placeholder="••••••••"
                      value={systemFormData.password}
                      onChange={(e) => setSystemFormData({ ...systemFormData, password: e.target.value })}
                      className={inputClass}
                    />
                  </FormField>

                  <FormField label={isAr ? 'تأكيد كلمة المرور *' : 'Confirm Password *'} required icon={<Lock className="h-4 w-4" />}>
                    <input
                      required
                      type="password"
                      placeholder="••••••••"
                      value={systemFormData.confirmPassword}
                      onChange={(e) => setSystemFormData({ ...systemFormData, confirmPassword: e.target.value })}
                      className={inputClass}
                    />
                  </FormField>
                </div>

                {/* Password validation indicator */}
                {systemFormData.password && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-400">{isAr ? 'قوة كلمة المرور:' : 'Password Strength:'}</span>
                      <span className={passwordValidation.strengthColor}>{passwordValidation.strengthLabel}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${passwordValidation.strengthScore >= 80 ? 'bg-emerald-500' : passwordValidation.strengthScore >= 60 ? 'bg-yellow-500' : 'bg-rose-500'
                          }`}
                        style={{ width: `${passwordValidation.strengthScore}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label={isAr ? 'رمز PIN السريع (اختياري)' : 'System PIN'} icon={<Key className="h-4 w-4" />}>
                    <input
                      type="password"
                      maxLength={6}
                      placeholder="1234"
                      value={systemFormData.systemPin}
                      onChange={(e) => setSystemFormData({ ...systemFormData, systemPin: e.target.value })}
                      className={inputClass}
                    />
                  </FormField>

                  <FormField label={isAr ? 'صلاحية الموظف في النظام' : 'System Role'}>
                    <select
                      value={systemFormData.role}
                      onChange={(e) => setSystemFormData({ ...systemFormData, role: e.target.value })}
                      className={inputClass}
                    >
                      <option value="Staff">{isAr ? 'موظف عادي (Staff)' : 'Staff'}</option>
                      <option value="Accountant">{isAr ? 'محاسب مالي (Accountant)' : 'Accountant'}</option>
                      <option value="WarehouseManager">{isAr ? 'أمين مستودع (Warehouse Manager)' : 'Warehouse Manager'}</option>
                      <option value="Admin">{isAr ? 'مدير نظام كامل (Admin)' : 'Admin'}</option>
                    </select>
                  </FormField>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4 shrink-0">
            <div className="flex items-center gap-4 text-[11px] text-slate-400 font-bold">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {isAr ? 'حساب مالي تلقائي (2130)' : 'Auto Payroll (2130)'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-400 transition hover:bg-slate-800">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-gradient-to-r from-[#d4af37] via-amber-500 to-yellow-600 px-6 py-2.5 text-xs font-black text-black transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {submitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ بيانات الموظف 💾' : 'Save Employee 💾')}
              </button>
            </div>
          </div>
        </form>
      </ModalShell>

      <LocationMapPickerModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        initialData={{
          country: formData.country,
          city: formData.city,
          street: formData.address,
          addressDetails: formData.address,
          lat: formData.lat,
          lng: formData.lng,
          gps_location: formData.gps_location
        }}
        onSelectLocation={(data) => {
          setFormData(prev => ({
            ...prev,
            country: data.country || prev.country,
            city: data.city || prev.city,
            address: [data.governorate, data.city, data.street, data.addressDetails].filter(Boolean).join(' - ') || prev.address,
            lat: data.lat || prev.lat,
            lng: data.lng || prev.lng,
            gps_location: data.gps_location || prev.gps_location
          }));
        }}
        isAr={isAr}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COURIER CREATE MODAL
// ─────────────────────────────────────────────────────────────────────────────
export function CourierCreateModal({
  isOpen,
  onClose,
  isAr,
  settings,
  onCreated
}: SharedProps & { onCreated: (courier: any) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'details' | 'system'>('basic');
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [previewId, setPreviewId] = useState('cour_1150-????');

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    country: 'اليمن',
    gpsLocation: '',
    lat: 15.3694,
    lng: 44.1910,
    commissionRate: 0,
    notes: '',
    courierType: 'local' as 'sourcing' | 'local'
  });

  const [createSystemUser, setCreateSystemUser] = useState(false);
  const [systemFormData, setSystemFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    systemPin: '',
    role: 'Courier'
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
      setFormData({
        fullName: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        country: 'اليمن',
        gpsLocation: '',
        lat: 15.3694,
        lng: 44.1910,
        commissionRate: 0,
        notes: '',
        courierType: 'local'
      });
      setCreateSystemUser(false);
      setSystemFormData({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        systemPin: '',
        role: 'Courier'
      });
      financialAccountService.getNextAccountIdentifiers('courier').then(res => {
        setPreviewId(`cour_${res.accountCode}`);
      }).catch(() => { });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const passwordValidation = validatePasswordFields(
    systemFormData.password,
    systemFormData.confirmPassword,
    isAr,
    createSystemUser
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !formData.fullName.trim() || !formData.phone.trim()) {
      return notificationService.notify({
        title: isAr ? 'خطأ' : 'Validation Error',
        message: isAr ? 'يرجى كتابة اسم المندوب الكامل ورقم الهاتف' : 'Full name and phone required',
        type: 'error'
      });
    }

    if (createSystemUser) {
      if (!systemFormData.username.trim()) {
        return notificationService.notify({
          title: isAr ? 'اسم المستخدم مطلوب' : 'Username Required',
          message: isAr ? 'يرجى كتابة اسم المستخدم للنظام' : 'Please enter system username',
          type: 'error'
        });
      }
      if (!passwordValidation.isValid) {
        return notificationService.notify({
          title: isAr ? 'خطأ في كلمة المرور' : 'Password Error',
          message: passwordValidation.errorMessage,
          type: 'error'
        });
      }
    }

    setSubmitting(true);
    try {
      const { accountCode } = await financialAccountService.getNextAccountIdentifiers('courier');
      const newId = `cour_${accountCode}`;
      const now = Date.now();

      const courierData = {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        gpsLocation: formData.gpsLocation,
        disabled: false,
        commissionRate: Number(formData.commissionRate) || 0,
        notes: formData.notes.trim(),
        courierType: formData.courierType,
        createdAt: now
      };

      await setDoc(doc(db, 'couriers', newId), courierData);
      const account = await financialAccountService.createAccountForEntity('courier', newId, formData.fullName.trim(), 'YER');

      let systemUserId = '';
      if (createSystemUser) {
        const userId = 'usr_' + Math.random().toString(36).substring(2, 11);
        const userPayload = {
          id: userId,
          username: systemFormData.username.trim(),
          email: systemFormData.email.trim() || formData.email.trim() || `${systemFormData.username.trim()}@courier.local`,
          password: systemFormData.password,
          systemPin: systemFormData.systemPin.trim(),
          fullName: formData.fullName.trim(),
          phone: formData.phone.trim(),
          role: 'Courier',
          disabled: false,
          linkedType: 'courier',
          linkedEntity: newId,
          createdAt: now
        };
        await setDoc(doc(db, 'users', userId), userPayload);
        systemUserId = userId;
      }

      const createdCourier = {
        id: newId,
        ...courierData,
        financialAccountId: account.id,
        financialAccountCode: account.accountCode,
        systemUserId
      };

      activityLogService.log('add_courier', formData.fullName, { ...formData });
      notificationService.notify({
        title: isAr ? 'إضافة مندوب' : 'Courier Added',
        message: isAr ? `تمت إضافة المندوب ${formData.fullName} بنجاح` : `Courier ${formData.fullName} added`,
        type: 'success'
      });

      onCreated(createdCourier);
      onClose();
    } catch (error: any) {
      console.error(error);
      notificationService.notify({
        title: isAr ? 'تعذر إنشاء المندوب' : 'Courier creation failed',
        message: error?.message || (isAr ? 'حدث خطأ أثناء حفظ بيانات المندوب' : 'Error saving courier'),
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const currentDateStr = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });

  return (
    <>
      <ModalShell
        title={isAr ? 'إضافة وتسجيل مندوب شحن وتوصيل' : 'Register New Courier'}
        onClose={onClose}
        maxWidth="max-w-4xl lg:max-w-5xl"
        headerExtra={
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 px-3 py-1 text-[11px] font-black text-[#d4af37]">
              🆔 {previewId}
            </span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-[11px] font-black text-emerald-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {currentDateStr}
            </span>
          </div>
        }
      >
        {/* Top Controls Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-6 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${activeTab === 'basic'
                  ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
            >
              {isAr ? '📋 البيانات الأساسية ونوع المندوب' : 'Basic & Type'}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${activeTab === 'details'
                  ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
            >
              {isAr ? '🗺️ الموقع الجغرافي والخريطة' : 'Address & Map'}
            </button>

            {createSystemUser && (
              <button
                type="button"
                onClick={() => setActiveTab('system')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition animate-pulse ${activeTab === 'system'
                    ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20'
                    : 'bg-amber-500/20 text-[#d4af37] border border-amber-500/30 hover:bg-amber-500/30'
                  }`}
              >
                {isAr ? '👤 مستخدم النظام (users)' : 'System User'}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !createSystemUser;
              setCreateSystemUser(next);
              if (next) setActiveTab('system');
              else if (activeTab === 'system') setActiveTab('basic');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 border ${createSystemUser
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                : 'bg-amber-500/10 text-[#d4af37] border-amber-500/30 hover:bg-amber-500/20'
              }`}
          >
            <Truck className="w-4 h-4" />
            {createSystemUser
              ? (isAr ? '✓ إلغاء حساب النظام' : '✓ Unlink System User')
              : (isAr ? '💻 إنشاء مستخدم في النظام' : '💻 Create System User')}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-6 text-start">
          {activeTab === 'basic' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-black/40 border border-slate-800 space-y-4">
                <FormField label={isAr ? 'الاسم الكامل للمندوب *' : 'Courier Full Name *'} required icon={<User className="h-4 w-4" />}>
                  <input required value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className={inputClass} placeholder="علي عبدالمجيد..." />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label={isAr ? 'رقم الهاتف *' : 'Phone *'} required icon={<Phone className="h-4 w-4" />}>
                    <input required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputClass} placeholder="771111111" />
                  </FormField>

                  <FormField label={isAr ? 'البريد الإلكتروني' : 'Email'}>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} placeholder="courier@domain.com" />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label={isAr ? 'تخصص ونوع المندوب' : 'Courier Specialty'}>
                    <select
                      value={formData.courierType}
                      onChange={(e) => setFormData({ ...formData, courierType: e.target.value as 'local' | 'sourcing' })}
                      className={inputClass}
                    >
                      <option value="local">{isAr ? '🚚 مندوب توصيل محلي (داخل اليمن)' : 'Local Delivery Courier'}</option>
                      <option value="sourcing">{isAr ? '📦 مندوب شحن وتوريد دولي / مصانع' : 'International Sourcing Courier'}</option>
                    </select>
                  </FormField>

                  <FormField label={isAr ? 'نسبة / عمولة التوصيل (ريال)' : 'Commission Rate'}>
                    <input type="number" min="0" value={formData.commissionRate} onChange={(e) => setFormData({ ...formData, commissionRate: parseFloat(e.target.value) || 0 })} className={inputClass} />
                  </FormField>
                </div>
              </div>

              <FormField label={isAr ? 'ملاحظات إدارية' : 'Notes'}>
                <textarea rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className={inputClass} placeholder="أي معلومات أو قيود..." />
              </FormField>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-black/40 border border-slate-800 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label={isAr ? 'الدولة' : 'Country'}>
                    <input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className={inputClass} />
                  </FormField>
                  <FormField label={isAr ? 'المدينة' : 'City'}>
                    <input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className={inputClass} />
                  </FormField>
                </div>

                <FormField label={isAr ? 'العنوان التفصيلي' : 'Address'} icon={<MapPin className="h-4 w-4" />}>
                  <input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputClass} />
                </FormField>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-[#d4af37] flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {isAr ? 'تثبيت موقع GPS على الخريطة التفاعلية' : 'GPS Location on Map'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsMapOpen(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[#d4af37] text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <MapPin className="w-4 h-4" />
                    {isAr ? 'فتح الخريطة التفاعلية لتثبيت المكان 🗺️' : 'Open Interactive Map 🗺️'}
                  </button>
                </div>

                <input
                  type="text"
                  readOnly
                  value={formData.gpsLocation}
                  placeholder="https://maps.google.com/?q=..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs font-mono font-bold text-slate-300 outline-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'system' && createSystemUser && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-5 rounded-2xl bg-black/40 border border-amber-500/30 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-xs font-black text-[#d4af37] uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> {isAr ? 'بيانات حساب تسجيل الدخول بالنظام (users)' : 'System Courier Credentials'}
                  </h3>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                    {isAr ? 'ربط تلقائي بالمندوب' : 'Auto Linked'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label={isAr ? 'اسم المستخدم للنظام *' : 'Courier Username *'} required icon={<User className="h-4 w-4" />}>
                    <input
                      required
                      type="text"
                      placeholder="courier_user"
                      value={systemFormData.username}
                      onChange={(e) => setSystemFormData({ ...systemFormData, username: e.target.value })}
                      className={inputClass}
                    />
                  </FormField>

                  <FormField label={isAr ? 'البريد الإلكتروني للنظام' : 'System Email'}>
                    <input
                      type="email"
                      placeholder="courier@system.local"
                      value={systemFormData.email}
                      onChange={(e) => setSystemFormData({ ...systemFormData, email: e.target.value })}
                      className={inputClass}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label={isAr ? 'كلمة المرور للنظام *' : 'System Password *'} required icon={<Lock className="h-4 w-4" />}>
                    <input
                      required
                      type="password"
                      placeholder="••••••••"
                      value={systemFormData.password}
                      onChange={(e) => setSystemFormData({ ...systemFormData, password: e.target.value })}
                      className={inputClass}
                    />
                  </FormField>

                  <FormField label={isAr ? 'تأكيد كلمة المرور *' : 'Confirm Password *'} required icon={<Lock className="h-4 w-4" />}>
                    <input
                      required
                      type="password"
                      placeholder="••••••••"
                      value={systemFormData.confirmPassword}
                      onChange={(e) => setSystemFormData({ ...systemFormData, confirmPassword: e.target.value })}
                      className={inputClass}
                    />
                  </FormField>
                </div>

                {systemFormData.password && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-400">{isAr ? 'قوة كلمة المرور:' : 'Password Strength:'}</span>
                      <span className={passwordValidation.strengthColor}>{passwordValidation.strengthLabel}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${passwordValidation.strengthScore >= 80 ? 'bg-emerald-500' : passwordValidation.strengthScore >= 60 ? 'bg-yellow-500' : 'bg-rose-500'
                          }`}
                        style={{ width: `${passwordValidation.strengthScore}%` }}
                      />
                    </div>
                  </div>
                )}

                <FormField label={isAr ? 'رمز PIN السريع (اختياري)' : 'System PIN'} icon={<Key className="h-4 w-4" />}>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="1234"
                    value={systemFormData.systemPin}
                    onChange={(e) => setSystemFormData({ ...systemFormData, systemPin: e.target.value })}
                    className={inputClass}
                  />
                </FormField>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4 shrink-0">
            <div className="flex items-center gap-4 text-[11px] text-slate-400 font-bold">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {isAr ? 'حساب مالي تلقائي (2120)' : 'Auto Account (2120)'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-400 transition hover:bg-slate-800">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-gradient-to-r from-[#d4af37] via-amber-500 to-yellow-600 px-6 py-2.5 text-xs font-black text-black transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {submitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ بيانات المندوب 💾' : 'Save Courier 💾')}
              </button>
            </div>
          </div>
        </form>
      </ModalShell>

      <LocationMapPickerModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        initialData={{
          country: formData.country,
          city: formData.city,
          street: formData.address,
          addressDetails: formData.address,
          lat: formData.lat,
          lng: formData.lng,
          gps_location: formData.gpsLocation
        }}
        onSelectLocation={(data) => {
          setFormData(prev => ({
            ...prev,
            country: data.country || prev.country,
            city: data.city || prev.city,
            address: [data.governorate, data.city, data.street, data.addressDetails].filter(Boolean).join(' - ') || prev.address,
            lat: data.lat || prev.lat,
            lng: data.lng || prev.lng,
            gpsLocation: data.gps_location || prev.gpsLocation
          }));
        }}
        isAr={isAr}
      />
    </>
  );
}

export function SourceCreateModal({ isOpen, onClose, isAr, settings, onCreated }: SharedProps & { onCreated: (source: any) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ source_name: '', type: 'App', source_url: '', contact_info: '', location: '', notes: '' });
  useEffect(() => { if (isOpen) setFormData({ source_name: '', type: 'App', source_url: '', contact_info: '', location: '', notes: '' }); }, [isOpen]);
  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !formData.source_name.trim()) return;
    setSubmitting(true);
    try {
      const id = `SRC-${Math.random().toString(36).substring(2, 11)}`;
      const source = { id, ...formData, name: formData.source_name, createdAt: Date.now() };
      await addDoc(id, collection(db, 'sources'), source);
      const account = await financialAccountService.createAccountForEntity('source', id, formData.source_name, settings.currency || settings.defaultOrderCurrency || 'YER', undefined, { accountPrefix: '2140', parentCode: '2140', accountType: 'Liability', notes: `حساب ذمم مصدر طلبات: ${formData.source_name}`, updateEntity: false });
      const accountLink = { accountId: account.id, financialAccountId: account.id, financialAccountCode: account.accountCode };
      await updateDoc(doc(db, 'sources', id), accountLink);
      Object.assign(source, accountLink);
      activityLogService.log('add_source', formData.source_name, { ...formData });
      notificationService.notify({ title: isAr ? 'إضافة مصدر شراء جديد' : 'Source Added', message: isAr ? `تمت إضافة المصدر ${formData.source_name} بنجاح` : `New order supply source ${formData.source_name} recorded`, type: 'success' });
      onCreated(source);
      onClose();
    } catch (error: any) {
      console.error(error);
      notificationService.notify({ title: isAr ? 'تعذر إنشاء المصدر' : 'Source creation failed', message: error?.message || (isAr ? 'تعذر حفظ المصدر.' : 'Unable to save source.'), type: 'error' });
    } finally { setSubmitting(false); }
  };

  return <ModalShell title={isAr ? 'تقييد مصدر توريد جديد' : 'Create Supply Source'} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4 overflow-y-auto p-5 text-start">
      <FormField label={isAr ? 'اسم مصدر الشراء' : 'Source name'} required icon={<Globe className="h-4 w-4" />}><input required value={formData.source_name} onChange={(event) => setFormData({ ...formData, source_name: event.target.value })} className={inputClass} /></FormField>
      <FormField label={isAr ? 'نوع المصدر' : 'Source type'}><select value={formData.type} onChange={(event) => setFormData({ ...formData, type: event.target.value })} className={inputClass}><option value="App">App</option><option value="Factory">Factory</option><option value="SHEIN">SHEIN</option></select></FormField>
      <FormField label={isAr ? 'رابط المصدر' : 'Source URL'}><input type="url" value={formData.source_url} onChange={(event) => setFormData({ ...formData, source_url: event.target.value })} className={inputClass} /></FormField>
      <FormField label={isAr ? 'بيانات الاتصال' : 'Contact information'}><input value={formData.contact_info} onChange={(event) => setFormData({ ...formData, contact_info: event.target.value })} className={inputClass} /></FormField>
      <FormField label={isAr ? 'الموقع' : 'Location'}><input value={formData.location} onChange={(event) => setFormData({ ...formData, location: event.target.value })} className={inputClass} /></FormField>
      <FormField label={isAr ? 'ملاحظات' : 'Notes'}><textarea rows={2} value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} className={inputClass} /></FormField>
      <ModalActions isAr={isAr} submitting={submitting} onClose={onClose} />
    </form>
  </ModalShell>;
}

export function ShippingCompanyCreateModal({ isOpen, onClose, isAr, settings, onCreated }: SharedProps & { onCreated: (company: any) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', contact_person: '', phone: '', tracking_url: '', address: '', notes: '' });
  useEffect(() => { if (isOpen) setFormData({ name: '', contact_person: '', phone: '', tracking_url: '', address: '', notes: '' }); }, [isOpen]);
  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !formData.name.trim()) return;
    setSubmitting(true);
    try {
      const id = `SC-${Math.random().toString(36).substring(2, 11)}`;
      const company = { id, ...formData, createdAt: Date.now() };
      await addDoc(id, collection(db, 'shipping_companies'), company);
      const account = await financialAccountService.createAccountForEntity('shipping_company', id, formData.name, settings.currency || settings.defaultOrderCurrency || 'YER', undefined, { accountPrefix: '2150', parentCode: '2150', accountType: 'Liability', notes: `حساب ذمم شركة شحن: ${formData.name}`, updateEntity: false });
      const accountLink = { accountId: account.id, financialAccountId: account.id, financialAccountCode: account.accountCode };
      await updateDoc(doc(db, 'shipping_companies', id), accountLink);
      Object.assign(company, accountLink);
      activityLogService.log('add_shipping_company', formData.name, { ...formData });
      notificationService.notify({ title: isAr ? 'إضافة شركة شحن جديدة' : 'Shipping Company Added', message: isAr ? `تمت إضافة شركة الشحن ${formData.name} بنجاح` : `New shipping carrier ${formData.name} registered`, type: 'success' });
      onCreated(company);
      onClose();
    } catch (error: any) {
      console.error(error);
      notificationService.notify({ title: isAr ? 'تعذر إنشاء شركة الشحن' : 'Shipping company creation failed', message: error?.message || (isAr ? 'تعذر حفظ شركة الشحن.' : 'Unable to save shipping company.'), type: 'error' });
    } finally { setSubmitting(false); }
  };

  return <ModalShell title={isAr ? 'إضافة شركة شحن جديدة' : 'Add Shipping Company'} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4 overflow-y-auto p-5 text-start">
      <FormField label={isAr ? 'اسم شركة الشحن' : 'Shipping company name'} required icon={<Truck className="h-4 w-4" />}><input required value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className={inputClass} /></FormField>
      <FormField label={isAr ? 'مسؤول الاتصال' : 'Contact person'}><input value={formData.contact_person} onChange={(event) => setFormData({ ...formData, contact_person: event.target.value })} className={inputClass} /></FormField>
      <FormField label={isAr ? 'رقم الهاتف' : 'Phone'}><input value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} className={inputClass} /></FormField>
      <FormField label={isAr ? 'رابط تتبع الشحنات' : 'Tracking URL'}><input type="url" value={formData.tracking_url} onChange={(event) => setFormData({ ...formData, tracking_url: event.target.value })} className={inputClass} /></FormField>
      <FormField label={isAr ? 'العنوان' : 'Address'}><input value={formData.address} onChange={(event) => setFormData({ ...formData, address: event.target.value })} className={inputClass} /></FormField>
      <FormField label={isAr ? 'ملاحظات' : 'Notes'}><textarea rows={2} value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} className={inputClass} /></FormField>
      <ModalActions isAr={isAr} submitting={submitting} onClose={onClose} />
    </form>
  </ModalShell>;
}

const inputClass = 'w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-bold text-white outline-none transition focus:border-[#d4af37]/60';

function FormField({ label, children, required = false, icon }: { label: string; children: React.ReactNode; required?: boolean; icon?: React.ReactNode }) {
  return <div><label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">{icon}{label}{required ? ' *' : ''}</label>{children}</div>;
}

function ModalActions({ isAr, submitting, onClose }: { isAr: boolean; submitting: boolean; onClose: () => void }) {
  return <div className="flex justify-end gap-3 border-t border-slate-800 pt-4"><button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-400 transition hover:bg-slate-800">{isAr ? 'إلغاء' : 'Cancel'}</button><button type="submit" disabled={submitting} className="rounded-xl bg-gradient-to-r from-[#d4af37] to-yellow-600 px-5 py-2.5 text-xs font-black text-black transition disabled:opacity-50">{submitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'تأمين وحفظ البيانات' : 'Save')}</button></div>;
}

