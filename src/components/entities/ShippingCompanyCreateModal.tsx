import { SharedProps, ModalShell, inputClass, FormField, ModalActions } from './entityModalHelpers';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe, MapPin, Phone, Truck, User, X, ShieldCheck, Calendar, Key, Lock, CheckCircle2, Building2, Briefcase } from 'lucide-react';
import { sourcesApiDataGateway } from '../../features/sources/services/sourcesApiDataGateway';
import { notificationService } from '../../services/notificationService';
import LocationMapPickerModal from '../common/LocationMapPickerModal';
import { portalUserService } from '../../services/portalUserService';
import { validatePasswordFields } from '../../utils/passwordUtils';





// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER CREATE MODAL
// ─────────────────────────────────────────────────────────────────────────────

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
      const company = await sourcesApiDataGateway.createShippingCompany({ name: formData.name.trim(), phone: formData.phone.trim() || undefined, trackingUrlTemplate: formData.tracking_url.trim() || undefined, address: formData.address.trim() || undefined });
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
