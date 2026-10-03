import { SharedProps, ModalShell, inputClass, FormField, ModalActions } from './entityModalHelpers';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe, MapPin, Phone, Truck, User, X, ShieldCheck, Calendar, Key, Lock, CheckCircle2, Building2, Briefcase } from 'lucide-react';
import { addDoc, collection, db, doc, setDoc, updateDoc } from '../../data/legacy/legacy-compat.ts';
import { financialAccountService } from '../../services/financialAccountService';
import { activityLogService } from '../../services/activityLogService';
import { notificationService } from '../../services/notificationService';
import LocationMapPickerModal from '../common/LocationMapPickerModal';
import { portalUserService } from '../../services/portalUserService';
import { validatePasswordFields } from '../../utils/passwordUtils';





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
            linkedCustomerId: reference.id,
            accountId: account.id,
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
        accountId: account.id,
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