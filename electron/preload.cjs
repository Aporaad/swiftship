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
});
