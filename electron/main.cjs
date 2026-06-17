'use strict';

const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs   = require('fs');

// ============================================================
// CONFIG
// ============================================================
const SERVER_PORT = 3000;
const SERVER_URL  = `http://localhost:${SERVER_PORT}`;
const IS_DEV      = process.env.NODE_ENV === 'development';
const MAX_WAIT_MS = 30000; // 30 ثانية للانتظار حتى يجهز السيرفر

let mainWindow    = null;
let serverProcess = null;

// ============================================================
// LOGGING
// ============================================================
let LOG_FILE;
try {
  LOG_FILE = path.join(app.getPath('userData'), 'swiftship.log');
} catch (_) {
  LOG_FILE = path.join(__dirname, '..', 'swiftship.log');
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(LOG_FILE, line); } catch (_) {}
}

// ============================================================
// تشغيل خادم Express في الخلفية
// ============================================================
function startExpressServer() {
  return new Promise((resolve, reject) => {
    log('[Electron] Starting Express server...');

    let command, args, spawnOpts;

    if (IS_DEV) {
      // ── وضع التطوير: تشغيل server.ts عبر tsx ─────────────
      const appRoot    = path.join(__dirname, '..');
      const serverFile = path.join(appRoot, 'server.ts');
      command   = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      args      = ['tsx', serverFile];
      spawnOpts = {
        cwd:   appRoot,
        env:   { ...process.env, NODE_ENV: 'development', PORT: String(SERVER_PORT) },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      };
    } else {
      // ── وضع الإنتاج: تشغيل dist/server.cjs المُجمَّع ─────
      // electron-builder يضع الـ extraResources في process.resourcesPath
      const serverFile = path.join(process.resourcesPath, 'app', 'server.cjs');
      log(`[Electron] Server path: ${serverFile}`);
      log(`[Electron] Server exists: ${fs.existsSync(serverFile)}`);

      // استخدام node الموجود في مسار النظام
      command   = process.platform === 'win32' ? 'node.exe' : 'node';
      args      = [serverFile];
      spawnOpts = {
        cwd:   path.join(process.resourcesPath, 'app'),
        env:   {
          ...process.env,
          NODE_ENV:       'production',
          PORT:           String(SERVER_PORT),
          RESOURCES_PATH: process.resourcesPath,
        },
        stdio:    ['ignore', 'pipe', 'pipe'],
        shell:    false,
        detached: false,
      };
    }

    log(`[Electron] Spawning: ${command} ${args.join(' ')}`);
    serverProcess = spawn(command, args, spawnOpts);

    serverProcess.stdout.on('data', (d) => log(`[Server] ${d.toString().trim()}`));
    serverProcess.stderr.on('data', (d) => log(`[Server ERR] ${d.toString().trim()}`));

    serverProcess.on('error', (err) => {
      log(`[Electron] Server spawn error: ${err.message}`);
      reject(err);
    });

    serverProcess.on('exit', (code, signal) => {
      log(`[Electron] Server exited — code=${code} signal=${signal}`);
      if (code !== 0 && code !== null && mainWindow) {
        dialog.showErrorBox(
          'SwiftShip — خطأ في الخادم',
          `توقّف الخادم الداخلي بشكل غير متوقع (كود الخروج: ${code}).\nيرجى إعادة تشغيل البرنامج.\n\nملف السجل: ${LOG_FILE}`
        );
      }
    });

    // انتظر حتى يستجيب الخادم
    waitForServer(`${SERVER_URL}/api/health`, MAX_WAIT_MS)
      .then(resolve)
      .catch(reject);
  });
}

// ============================================================
// الانتظار حتى يصبح الخادم جاهزاً (polling)
// ============================================================
function waitForServer(url, maxWait) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function check() {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          log(`[Electron] Server ready at ${url}`);
          resolve();
        } else {
          scheduleCheck();
        }
        res.resume(); // consume response to free socket
      }).on('error', () => scheduleCheck());
    }

    function scheduleCheck() {
      if (Date.now() - start >= maxWait) {
        reject(new Error(`Server did not start within ${maxWait / 1000} seconds.\nCheck log: ${LOG_FILE}`));
      } else {
        setTimeout(check, 500);
      }
    }

    check();
  });
}

// ============================================================
// إنشاء نافذة التطبيق الرئيسية
// ============================================================
function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');

  mainWindow = new BrowserWindow({
    width:     1400,
    height:    900,
    minWidth:  1024,
    minHeight: 700,
    show:  false,   // نخفيها حتى تكتمل لتجنب الوميض
    title: 'SwiftShip — نظام إدارة الشحنات',
    backgroundColor: '#0f172a',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,

    webPreferences: {
      // ✅ المسار الصحيح للـ preload بامتداد .cjs
      preload:          path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
      webSecurity:      true,
    },

    frame:           true,
    autoHideMenuBar: true,
    titleBarStyle:   'default',
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (IS_DEV) mainWindow.webContents.openDevTools({ mode: 'detach' });
    log('[Electron] Main window shown');
  });

  // فتح الروابط الخارجية في المتصفح الافتراضي
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ============================================================
// دورة حياة التطبيق
// ============================================================
app.whenReady().then(async () => {
  log('[Electron] App ready — starting server...');

  try {
    await startExpressServer();
    createWindow();
  } catch (err) {
    log(`[Electron] FATAL: ${err.message}`);
    dialog.showErrorBox(
      'SwiftShip — فشل التشغيل',
      `تعذّر تشغيل الخادم الداخلي:\n\n${err.message}\n\nيرجى مراجعة ملف السجل:\n${LOG_FILE}`
    );
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// إنهاء العمليات الفرعية عند إغلاق التطبيق
app.on('before-quit', () => {
  log('[Electron] App quitting — stopping server...');
  if (serverProcess) {
    try { serverProcess.kill('SIGTERM'); } catch (_) {}
    serverProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ============================================================
// IPC Handlers
// ============================================================
ipcMain.handle('app:version',  () => app.getVersion());
ipcMain.handle('app:log-path', () => LOG_FILE);
