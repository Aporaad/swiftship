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
      const accountLink = { accountId: account.id };
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
