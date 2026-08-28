import { useState } from 'react';
import { Edit3, Plus, Save, Trash2, X } from 'lucide-react';
import { financialEntrySettingsService } from '../../services/financialEntrySettingsService';
import type { FinanceEntryType, FinanceModule } from './EntryForm';

interface Props {
  modules: FinanceModule[];
  entryTypes: FinanceEntryType[];
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onChanged: () => void;
}

type Editor = {
  kind: 'module' | 'type';
  id: string;
  code: string;
  nameAr: string;
  moduleId: string;
  active: boolean;
  exists: boolean;
} | null;

export default function EntrySettingsTab({ modules, entryTypes, canView, canCreate, canEdit, canDelete, onChanged }: Props) {
  const [editor, setEditor] = useState<Editor>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const startModule = (module?: FinanceModule) => setEditor({
    kind: 'module', id: module?.id || `module_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`,
    code: module?.code || '', nameAr: module?.nameAr || '', moduleId: '', active: module?.isActive ?? true, exists: Boolean(module),
  });
  const startType = (type?: FinanceEntryType) => setEditor({
    kind: 'type', id: type?.id || `type_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`,
    code: type?.code || '', nameAr: type?.nameAr || '', moduleId: type?.moduleId || modules.find((item) => item.isActive !== false)?.id || '', active: type?.isActive ?? true, exists: Boolean(type),
  });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor || !editor.code.trim() || !editor.nameAr.trim() || (editor.kind === 'type' && !editor.moduleId)) {
      setError('أكمل الرمز والاسم والفئة المرتبطة للنوع.');
      return;
    }
    if ((editor.exists && !canEdit) || (!editor.exists && !canCreate)) {
      setError('لا تملك الصلاحية اللازمة لحفظ إعدادات القيود.');
      return;
    }
    try {
      setBusy(true); setError('');
      await financialEntrySettingsService.manage(editor.exists ? 'update' : 'create', editor.kind, editor.id, {
        code: editor.code.trim(), nameAr: editor.nameAr.trim(), nameEn: editor.nameAr.trim(),
        moduleId: editor.kind === 'type' ? editor.moduleId : undefined, isActive: editor.active,
      });
      setEditor(null);
      onChanged();
    } catch (cause: any) {
      setError(cause?.message || 'تعذر حفظ إعداد القيد؛ تحقق من صلاحيات الجلسة أو تفرد الرمز.');
    } finally { setBusy(false); }
  };

  const remove = async (kind: 'module' | 'type', id: string, name: string) => {
    if (!canDelete) return setError('لا تملك تصريح حذف إعدادات القيود.');
    if (!window.confirm(`سيُحذف ${kind === 'module' ? 'فئة' : 'نوع'} القيد «${name}». لا تحذف إلا سجلًا غير مستخدم. هل تريد المتابعة؟`)) return;
    try {
      setBusy(true); setError('');
      await financialEntrySettingsService.manage('delete', kind, id);
      onChanged();
    } catch (cause: any) {
      setError(cause?.message || 'تعذر حذف الإعداد؛ قد يكون مستخدمًا في قيود قائمة أو لا تملك الصلاحية.');
    } finally { setBusy(false); }
  };

  if (!canView) return <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-8 text-center text-sm font-bold text-slate-400">لا تملك صلاحية استعراض إعدادات القيود.</div>;
  return <section className="space-y-4" dir="rtl">
    <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <div><h2 className="text-lg font-black text-white">إعدادات القيود</h2><p className="mt-1 text-xs text-slate-400">تدار الفئات والأنواع عبر إجراء خلفي يتحقق من جلسة المستخدم وصلاحية العملية.</p></div>
      {canCreate && <div className="flex gap-2"><button onClick={() => startModule()} className="inline-flex items-center gap-1 rounded-lg border border-[#d4af37]/35 px-3 py-2 text-xs font-bold text-[#f4d870]"><Plus className="h-4 w-4" />فئة</button><button onClick={() => startType()} className="inline-flex items-center gap-1 rounded-lg bg-[#d4af37] px-3 py-2 text-xs font-black text-slate-950"><Plus className="h-4 w-4" />نوع</button></div>}
    </header>
    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
    {editor && <form onSubmit={save} className="grid gap-3 rounded-2xl border border-[#d4af37]/30 bg-slate-950 p-5 md:grid-cols-2">
      <h3 className="md:col-span-2 font-black text-white">{editor.kind === 'module' ? 'فئة قيد' : 'نوع قيد'} {editor.exists ? '— تعديل' : '— جديد'}</h3>
      <label className="text-xs font-bold text-slate-300">الرمز<input value={editor.code} onChange={(e) => setEditor({ ...editor, code: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 font-mono text-white" /></label>
      <label className="text-xs font-bold text-slate-300">الاسم العربي<input value={editor.nameAr} onChange={(e) => setEditor({ ...editor, nameAr: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white" /></label>
      {editor.kind === 'type' && <label className="text-xs font-bold text-slate-300">الفئة<select value={editor.moduleId} onChange={(e) => setEditor({ ...editor, moduleId: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white">{modules.map((module) => <option key={module.id} value={module.id}>{module.nameAr}{module.isActive === false ? ' — معطلة' : ''}</option>)}</select></label>}
      <label className="text-xs font-bold text-slate-300">الحالة<select value={editor.active ? 'active' : 'inactive'} onChange={(e) => setEditor({ ...editor, active: e.target.value === 'active' })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"><option value="active">نشط ومتاح للإنشاء</option><option value="inactive">معطّل ومحفوظ للتاريخ</option></select></label>
      <div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={() => setEditor(null)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-300"><X className="h-4 w-4" />إلغاء</button><button disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-[#d4af37] px-4 py-2 text-sm font-black text-slate-950"><Save className="h-4 w-4" />{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button></div>
    </form>}
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5"><h3 className="font-black text-white">فئات القيود</h3><div className="mt-4 space-y-2">{modules.map((module) => <div key={module.id} className="flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-sm"><span className="font-bold text-slate-200">{module.nameAr}</span><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${module.isActive === false ? 'bg-slate-700 text-slate-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{module.isActive === false ? 'معطّلة' : 'نشطة'}</span><code className="text-[10px] text-slate-500">{module.code}</code>{canEdit && <button onClick={() => startModule(module)} className="text-sky-300" title="تعديل"><Edit3 className="h-4 w-4" /></button>}{canDelete && <button disabled={busy} onClick={() => void remove('module', module.id, module.nameAr)} className="text-rose-300" title="حذف"><Trash2 className="h-4 w-4" /></button>}</div></div>)}</div></div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5"><h3 className="font-black text-white">أنواع القيود</h3><div className="mt-4 space-y-2">{entryTypes.map((type) => <div key={type.id} className="flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-sm"><span className="font-bold text-slate-200">{type.nameAr}</span><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${type.isActive === false ? 'bg-slate-700 text-slate-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{type.isActive === false ? 'معطّل' : 'نشط'}</span><code className="text-[10px] text-slate-500">{type.code}</code>{canEdit && <button onClick={() => startType(type)} className="text-sky-300" title="تعديل"><Edit3 className="h-4 w-4" /></button>}{canDelete && <button disabled={busy} onClick={() => void remove('type', type.id, type.nameAr)} className="text-rose-300" title="حذف"><Trash2 className="h-4 w-4" /></button>}</div></div>)}</div></div>
    </div>
  </section>;
}
