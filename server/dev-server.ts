/**
 * خادم التطوير — Vite Dev Server
 * Development Server — configures and attaches Vite middleware for local development.
 *
 * هذا الملف مُستخرج من server.ts لعزل منطق خادم Vite.
 * Extracted from server.ts to isolate Vite dev server configuration.
 *
 * ملاحظة: هذا الملف للتطوير فقط ولا يُستخدم في بيئة الإنتاج.
 * Note: This file is used only in development — not referenced in production.
 */

import type { Express } from 'express';
import express from 'express';
import path from 'path';
import fs from 'fs';

/**
 * يُرفق Vite middleware في وضع التطوير.
 * Attaches Vite middleware in development mode.
 *
 * @param app - تطبيق Express / Express application
 */
export async function attachViteDevMiddleware(app: Express): Promise<void> {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  console.log('[DevServer] Vite dev middleware attached');
}

/**
 * يُرفق خدمة الملفات الثابتة من مجلد dist في وضع الإنتاج.
 * Attaches static file serving from dist directory in production mode.
 *
 * @param app - تطبيق Express / Express application
 * @param currentDirPath - المسار الحالي للملف / Current file directory path
 */
export function attachProductionStaticFiles(app: Express, currentDirPath: string): void {
  const resourcesPath = process.env.RESOURCES_PATH || '';

  const possibleDistPaths = [
    resourcesPath ? path.join(resourcesPath, 'app', 'dist') : '',
    path.join(currentDirPath, 'dist'),
    path.join(currentDirPath, '..', 'dist'),
    path.resolve(process.cwd(), 'dist'),
  ].filter(Boolean);

  let distPath: string | undefined;
  for (const p of possibleDistPaths) {
    const indexFile = path.join(p, 'index.html');
    const exists = fs.existsSync(indexFile);
    console.log(`[DevServer] Production: Checking distPath: ${p} — Exists: ${exists}`);
    if (exists) {
      distPath = p;
      break;
    }
  }

  if (distPath) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath!, 'index.html'));
    });
    console.log('[DevServer] Production: Serving static files from:', distPath);
  } else {
    console.error('[DevServer] CRITICAL: dist directory missing in production');
    app.get('*', (_req, res) => {
      res.status(503).send(`
        <!DOCTYPE html><html dir="rtl" lang="ar">
        <head><meta charset="UTF-8"><title>alx</title>
        <style>body{font-family:sans-serif;background:#0a0f1e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column}
        h1{color:#f59e0b}p{color:#94a3b8;max-width:400px;text-align:center}</style></head>
        <body><h1>⚠️ خطأ في التثبيت</h1>
        <p>ملفات التطبيق مفقودة. يرجى إعادة تثبيت alx.</p>
        <p style="font-size:12px;color:#475569">dist not found in: ${possibleDistPaths.join(', ')}</p>
        </body></html>`);
    });
  }
}
