import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist',
    },
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
        'firebase/app': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        'firebase/auth': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        'firebase/firestore': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        'firebase-admin/app': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        'firebase-admin/auth': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        'firebase-admin': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        '@firebase/firestore': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
        '@google-cloud/firestore': path.resolve(process.cwd(), './src/lib/supabase-firebase-adapter.ts'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
