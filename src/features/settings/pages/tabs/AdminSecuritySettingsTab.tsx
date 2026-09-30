import React from 'react';
import { Shield, Key, Database, Download, Upload, Trash2, AlertTriangle, Lock } from 'lucide-react';
import { SectionCard, FieldLabel, FieldInput } from './settingsHelpers';

export function AdminSecuritySettingsTab({
  isAr,
  settings,
  setSettings,
  role,
  hasPermission,
  showPinInput,
  setShowPinInput,
  currentPinInput,
  setCurrentPinInput,
  newPinInput,
  setNewPinInput,
  confirmPinInput,
  setConfirmPinInput,
  handleUpdateSystemPin,
  backups = [],
  backupLoading,
  isAutoBackupRunning,
  handleCreateBackup,
  handleRestoreBackup,
  handleExportDatabaseJSON,
  handleImportDatabaseJSON,
  handlePurgeAuditLogs,
  handleResetDemoData,
  purgeDays,
  setPurgeDays,
  showPinSection,
  setShowPinSection
}: any) {
  return (
    <div className="space-y-5 animate-fade-slide-in">
      {/* System Security PIN */}
      <SectionCard title={isAr ? 'رمز حماية النظام (System PIN)' : 'System Security PIN'} icon={Lock}>
        <div className="space-y-4">
          <p className="text-xs text-slate-400 font-bold">
            {isAr ? 'رمز الحماية المالي والإداري للحسابات والتأكيدات الحساسة' : 'Security PIN for administrative & financial confirmations'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <FieldLabel>{isAr ? 'الرمز الحالي' : 'Current PIN'}</FieldLabel>
              <FieldInput type="password" value={currentPinInput || ''} onChange={(e: any) => setCurrentPinInput(e.target.value)} placeholder="••••" maxLength={6} className="font-mono text-center" />
            </div>
            <div>
              <FieldLabel>{isAr ? 'الرمز الجديد' : 'New PIN'}</FieldLabel>
              <FieldInput type="password" value={newPinInput || ''} onChange={(e: any) => setNewPinInput(e.target.value)} placeholder="••••" maxLength={6} className="font-mono text-center" />
            </div>
            <div>
              <FieldLabel>{isAr ? 'تأكيد الرمز الجديد' : 'Confirm PIN'}</FieldLabel>
              <FieldInput type="password" value={confirmPinInput || ''} onChange={(e: any) => setConfirmPinInput(e.target.value)} placeholder="••••" maxLength={6} className="font-mono text-center" />
            </div>
          </div>
          <button type="button" onClick={handleUpdateSystemPin} className="px-5 py-2.5 bg-[#d4af37] text-black font-black text-xs rounded-xl hover:bg-amber-500 transition">
            {isAr ? 'تحديث رمز PIN الحماية' : 'Update Security PIN'}
          </button>
        </div>
      </SectionCard>

      {/* Database Backup & Restore */}
      <SectionCard title={isAr ? 'النسخ الاحتياطي واستعادة البيانات' : 'Database Backup & Restore'} icon={Database}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button type="button" onClick={handleCreateBackup} disabled={backupLoading} className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-2xl flex items-center justify-between hover:bg-emerald-950/40 transition">
            <div className="text-start">
              <span className="text-xs font-black text-emerald-400 block">{isAr ? 'إنشاء نسخة احتياطية جديدة' : 'Create New Backup'}</span>
              <span className="text-[10px] text-slate-400">{isAr ? 'حفظ النسخة في قاعدة البيانات والملفات' : 'Save backup copy to storage'}</span>
            </div>
            <Download className="w-5 h-5 text-emerald-400" />
          </button>

          <button type="button" onClick={handleImportDatabaseJSON} disabled={backupLoading} className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-2xl flex items-center justify-between hover:bg-amber-950/40 transition">
            <div className="text-start">
              <span className="text-xs font-black text-amber-400 block">{isAr ? 'استعادة نسخة احتياطية من ملف' : 'Restore Backup File'}</span>
              <span className="text-[10px] text-slate-400">{isAr ? 'رفع ملف JSON واستعادة الجداول' : 'Upload JSON backup file'}</span>
            </div>
            <Upload className="w-5 h-5 text-amber-400" />
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
