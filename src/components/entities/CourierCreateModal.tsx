import { SharedProps, ModalShell, inputClass, FormField, ModalActions } from './entityModalHelpers';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe, MapPin, Phone, Truck, User, X, ShieldCheck, Calendar, Key, Lock, CheckCircle2, Building2, Briefcase } from 'lucide-react';
import { addDoc, collection, db, doc, setDoc, updateDoc } from '../../lib/supabase-adapter';
import { financialAccountService } from '../../services/financialAccountService';
import { activityLogService } from '../../services/activityLogService';
import { notificationService } from '../../services/notificationService';
import LocationMapPickerModal from '../common/LocationMapPickerModal';
import { portalUserService } from '../../services/portalUserService';
import { validatePasswordFields } from '../../utils/passwordUtils';





// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER CREATE MODAL
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
        accountId: account.id,
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
