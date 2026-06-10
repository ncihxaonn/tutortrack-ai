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
  readonly VITE_ADMIN_PASSWORD?: string;
  // Optional: pre-baked email to use behind the scenes so the login screen
  // can show only a password field. When set, the LoginPage hides the email
  // input and signs in with this address + the typed password.
  readonly VITE_AUTH_EMAIL?: string;
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
  ADMIN_PASSWORD: pickFirst('VITE_ADMIN_PASSWORD'),
  AUTH_EMAIL: pickFirst('VITE_AUTH_EMAIL'),
  IS_DEV: env.DEV === true,
  IS_PROD: env.PROD === true
};
