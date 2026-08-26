import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe, MapPin, Phone, Truck, User, X } from 'lucide-react';
import { addDoc, collection, db } from '../../lib/supabase';
import { financialAccountService } from '../../services/financialAccountService';
import { activityLogService } from '../../services/activityLogService';
import { notificationService } from '../../services/notificationService';

type SharedProps = {
  isOpen: boolean;
  onClose: () => void;
  isAr: boolean;
  settings: any;
};

function ModalShell({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[1000000] isolate flex items-center justify-center bg-slate-950 p-4">
      <div className="flex w-full max-w-lg max-h-[92vh] flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 p-4 text-xs font-black text-white">
          <span>{title}</span>
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-800 p-1 text-slate-400 transition hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function CustomerCreateModal({ isOpen, onClose, isAr, settings, initialName = '', onCreated }: SharedProps & { initialName?: string; onCreated: (customer: any) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', phone: '', email: '', gps_location: '', address: '', notes: '' });

  useEffect(() => {
    if (isOpen) setFormData({ fullName: initialName, phone: '', email: '', gps_location: '', address: '', notes: '' });
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !formData.fullName.trim() || !formData.phone.trim()) return;
    setSubmitting(true);
    try {
      const { accountCode } = await financialAccountService.getNextAccountIdentifiers('customer');
      const id = `cust_${accountCode}`;
      const reference = await addDoc(id, collection(db, 'customers'), { ...formData, createdAt: Date.now() });
      const account = await financialAccountService.createAccountForEntity('customer', reference.id, formData.fullName, settings.currency || 'SAR');
      const customer = { id: reference.id, ...formData, financialAccountId: account.id, financialAccountCode: account.accountCode };
      activityLogService.log('add_customer', formData.fullName, { ...formData });
      notificationService.notify({ title: isAr ? 'إضافة عميل' : 'Customer Added', message: isAr ? `تمت إضافة العميل ${formData.fullName} وإنشاء حسابه المالي تلقائياً` : `Customer ${formData.fullName} added with auto-generated financial account`, type: 'success' });
      onCreated(customer);
      onClose();
    } catch (error: any) {
      console.error(error);
      notificationService.notify({ title: isAr ? 'تعذر إنشاء العميل' : 'Customer creation failed', message: error?.message || (isAr ? 'تعذر حفظ العميل.' : 'Unable to save customer.'), type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return <ModalShell title={isAr ? 'تسجيل عميل جديد ومطابقة الحساب بالكامل' : 'Register New Customer'} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4 overflow-y-auto p-5 text-start">
      <FormField label={isAr ? 'الاسم الثلاثي أو الرباعي للعميل' : 'Full Customer Name'} required icon={<User className="h-4 w-4" />}><input required value={formData.fullName} onChange={(event) => setFormData({ ...formData, fullName: event.target.value })} className={inputClass} /></FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><FormField label={isAr ? 'رقم الهاتف (الواتساب)' : 'Phone'} required icon={<Phone className="h-4 w-4" />}><input required value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} className={inputClass} /></FormField><FormField label={isAr ? 'البريد الإلكتروني' : 'Email'}><input type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} className={inputClass} /></FormField></div>
      <FormField label={isAr ? 'العنوان وتفاصيل التوزيع' : 'Address'} icon={<MapPin className="h-4 w-4" />}><input value={formData.address} onChange={(event) => setFormData({ ...formData, address: event.target.value })} className={inputClass} /></FormField>
      <FormField label={isAr ? 'رابط الموقع الجغرافي (GPS)' : 'GPS link'}><input value={formData.gps_location} onChange={(event) => setFormData({ ...formData, gps_location: event.target.value })} className={inputClass} /></FormField>
      <FormField label={isAr ? 'ملاحظات وتصنيفات إدارية' : 'Administrative notes'}><textarea rows={2} value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} className={inputClass} /></FormField>
      <ModalActions isAr={isAr} submitting={submitting} onClose={onClose} />
    </form>
  </ModalShell>;
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
      const account = await financialAccountService.createAccountForEntity('source', id, formData.source_name, settings.currency || settings.defaultOrderCurrency || 'YER', undefined, { accountPrefix: '2140', parentCode: '2140', accountType: 'Liability', notes: `حساب ذمم مصدر طلبات: ${formData.source_name}`, updateEntity: false });
      const source = { id, ...formData, name: formData.source_name, accountId: account.id, financialAccountId: account.id, financialAccountCode: account.accountCode, createdAt: Date.now() };
      await addDoc(id, collection(db, 'sources'), source);
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
      const account = await financialAccountService.createAccountForEntity('shipping_company', id, formData.name, settings.currency || settings.defaultOrderCurrency || 'YER', undefined, { accountPrefix: '2150', parentCode: '2150', accountType: 'Liability', notes: `حساب ذمم شركة شحن: ${formData.name}`, updateEntity: false });
      const company = { id, ...formData, accountId: account.id, financialAccountId: account.id, financialAccountCode: account.accountCode, createdAt: Date.now() };
      await addDoc(id, collection(db, 'shipping_companies'), company);
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
  return <div><label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">{icon}{label}{required ? ' *' : ''}</label>{children}</div>;
}

function ModalActions({ isAr, submitting, onClose }: { isAr: boolean; submitting: boolean; onClose: () => void }) {
  return <div className="flex justify-end gap-3 border-t border-slate-800 pt-4"><button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-400 transition hover:bg-slate-800">{isAr ? 'إلغاء' : 'Cancel'}</button><button type="submit" disabled={submitting} className="rounded-xl bg-gradient-to-r from-[#d4af37] to-yellow-600 px-5 py-2.5 text-xs font-black text-black transition disabled:opacity-50">{submitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'تأمين وحفظ البيانات' : 'Save')}</button></div>;
}
