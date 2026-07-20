import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Pull SUPABASE_* from .env even though they don't have the VITE_ prefix —
  // Vite would otherwise hide them. We expose them via import.meta.env for the
  // legacy fallback in lib/env.ts.
  const env = loadEnv(mode, '.', '');
  const exposed: Record<string, string> = {};
  for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY']) {
    if (env[k]) exposed[`import.meta.env.${k}`] = JSON.stringify(env[k]);
  }

  return {
    server: {
      // Honour PORT when the harness assigns one; 3000 stays the default.
      port: Number(process.env.PORT) || 3000,
      host: '0.0.0.0'
    },
    plugins: [react()],
    define: exposed,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.')
      }
    },
    build: {
      // Split heavy libs into their own chunks so the main bundle stays small
      // and lazily loaded routes (charts, AI, admin) don't drag everything in.
      rollupOptions: {
        output: {
          manualChunks: {
            recharts: ['recharts'],
            supabase: ['@supabase/supabase-js']
          }
        }
      }
    }
  };
});
