// Centralised, typed access to environment variables. Throws at startup
// (rather than runtime) if a required value is missing, so deploys fail loud.
//
// Historically these were referenced as plain process.env.* names; Vite-style
// VITE_* are preferred for new deployments, but we accept the legacy names too
// so existing Vercel projects don't break on upgrade.

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_ANON_KEY?: string;
  readonly VITE_SITE_PASSWORD?: string;
  readonly VITE_ADMIN_PASSWORD?: string;
  readonly VITE_GEMINI_PROXY_URL?: string;
  readonly DEV?: boolean;
  readonly PROD?: boolean;
}

const env = (import.meta as unknown as { env: ImportMetaEnv }).env;

const pickFirst = (...keys: (keyof ImportMetaEnv)[]): string | undefined => {
  for (const k of keys) {
    const v = env[k];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return undefined;
};

const required = (label: string, ...keys: (keyof ImportMetaEnv)[]): string => {
  const v = pickFirst(...keys);
  if (!v) throw new Error(`Missing required env var: ${label}. Set it in .env.local for dev and in your Vercel project for production.`);
  return v;
};

export const ENV = {
  SUPABASE_URL: required('VITE_SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_URL'),
  SUPABASE_ANON_KEY: required('VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'),
  SITE_PASSWORD: pickFirst('VITE_SITE_PASSWORD'),
  ADMIN_PASSWORD: pickFirst('VITE_ADMIN_PASSWORD'),
  // Proxy URL for the Gemini-backed AI features. Defaults to the bundled
  // serverless function path on the same origin in production.
  GEMINI_PROXY_URL: pickFirst('VITE_GEMINI_PROXY_URL') ?? '/api/ai',
  IS_DEV: env.DEV === true,
  IS_PROD: env.PROD === true
};
