'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// ============================================================
// Context Bridge — كشف API آمن للواجهة الأمامية
// ============================================================
contextBridge.exposeInMainWorld('electronAPI', {
  // معلومات التطبيق
  getVersion: () => ipcRenderer.invoke('app:version'),
  getLogPath: () => ipcRenderer.invoke('app:log-path'),

  // تعريف البيئة
  isElectron: true,
  platform:   process.platform,

  // ─── حفظ الملفات (Save Dialog) ─────────────────────────────
  // buffer يجب أن يكون Uint8Array
  saveFile: (opts) => ipcRenderer.invoke('dialog:save-file', opts),

  // ─── الإشعارات الأصلية (Native OS Notifications) ───────────
  showNotification: (opts) => ipcRenderer.invoke('notify:show', opts),

  // ─── الطباعة عبر Electron WebContents ──────────────────────
  printPage: (opts) => ipcRenderer.invoke('print:page', opts),

  // ─── فتح مسار في مستكشف الملفات ─────────────────────────────
  openPath: (targetPath) => ipcRenderer.invoke('shell:open-path', targetPath),
});
