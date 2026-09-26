import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const projectRoot = process.cwd();
const adapterPath = path.resolve(projectRoot, 'src/lib/supabase-adapter.ts');

export default defineConfig(() => ({
  root: projectRoot,
  base: '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.PORT) || 3000,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {
      ignored: ['**/dist-electron/**', '**/dist/**'],
    },
    allowedHosts: true as true,
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 3000,
    allowedHosts: true as true,
  },
  build: {
    outDir: path.resolve(projectRoot, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          maps: ['leaflet', 'react-leaflet'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': projectRoot,
      '../lib/supabase-adapter': adapterPath,
      './src/lib/supabase-adapter': adapterPath,
      '@supabase/supabase': adapterPath,
      '@google-cloud/supabase': adapterPath,
    },
  },
}));
