import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // base: './' مطلوب حتى تعمل المسارات بشكل صحيح داخل Electron
    base: './',
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist',
      // تحسين الإنتاج
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            maps: ['leaflet', 'react-leaflet'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
        'firebase/app': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        'firebase/auth': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        'firebase/firestore': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        'firebase/firestore/lite': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        'firebase-admin/app': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        'firebase-admin/auth': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        'firebase-admin/firestore': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        'firebase-admin': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        '@firebase/firestore': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        '@google-cloud/firestore': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
      },
    },
    server: {
      // منفذ ثابت للـ dev server (Express يعمل على 3000)
      port: 5173,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
