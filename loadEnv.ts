// ─────────────────────────────────────────────────────────────────────────────
// loadEnv.ts — يُحمَّل هذا الملف أولاً قبل أي موديول آخر
// يضمن أن متغيرات البيئة موجودة في process.env قبل تهيئة Supabase وغيره
// ─────────────────────────────────────────────────────────────────────────────
import path from 'path';
import fs from 'fs';
import { config as dotenvConfig } from 'dotenv';

const resourcesPath = process.env.RESOURCES_PATH ?? '';

const envPaths = [
  // Electron production: resources/app/.env (مُمرَّر من main.cjs)
  resourcesPath ? path.join(resourcesPath, 'app', '.env') : '',
  // نفس مجلد server.cjs عند التشغيل مباشرةً
  path.join(__dirname, '.env'),
  // مجلد أعلى (resources/) احتياطي
  path.join(__dirname, '..', '.env'),
  // CWD
  path.join(process.cwd(), '.env'),
].filter(Boolean);

let loaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenvConfig({ path: envPath, override: true });
    console.log(`[Server] Loaded .env from: ${envPath}`);
    loaded = true;
    break;
  }
}

if (!loaded) {
  console.warn('[Server] WARNING: No .env file found in any expected location.');
  console.warn('[Server] Searched:', envPaths);
}

console.log(`[Server] SUPABASE_URL: ${process.env.SUPABASE_URL ? 'PRESENT' : 'MISSING'}`);
