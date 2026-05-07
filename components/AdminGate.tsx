import React, { useState } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';

const ADMIN_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined)?.trim();
const SESSION_KEY = 'tt_admin_auth';

export function isAdminAuthenticated(): boolean {
  if (!ADMIN_PASSWORD) return true; // no admin password set → open (acts as warning state)
  return sessionStorage.getItem(SESSION_KEY) === 'yes';
}

export function lockAdmin() {
  sessionStorage.removeItem(SESSION_KEY);
}

const AdminGate: React.FC<{ onUnlock: () => void }> = ({ onUnlock }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  const attempt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ADMIN_PASSWORD || value === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'yes');
      onUnlock();
    } else {
      setError(true);
      setShaking(true);
      setValue('');
      setTimeout(() => setShaking(false), 500);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className={`bg-white rounded-2xl border border-cream-border shadow-lg p-8 w-full max-w-sm ${shaking ? 'animate-shake' : ''}`}>
        <div className="flex flex-col items-center mb-6">
          <div className="bg-stone-900 p-3 rounded-xl mb-4">
            <ShieldAlert className="w-7 h-7 text-coral-300" />
          </div>
          <h2 className="font-serif text-xl font-semibold text-stone-900 tracking-tight">Admin Access</h2>
          <p className="text-sm text-stone-500 mt-1 text-center">This page contains financial information. Enter the admin password to continue.</p>
        </div>

        {!ADMIN_PASSWORD && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg p-3 mb-4">
            ⚠️ <strong>VITE_ADMIN_PASSWORD</strong> isn't set. The page is currently open to anyone.
          </div>
        )}

        <form onSubmit={attempt} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="password"
              value={value}
              onChange={e => { setValue(e.target.value); setError(false); }}
              placeholder="Admin password"
              autoFocus
              className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors ${
                error
                  ? 'border-red-300 bg-red-50 focus:ring-red-200 text-red-700 placeholder-red-300'
                  : 'border-cream-border focus:ring-coral-200 focus:border-coral-400'
              }`}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 text-center">Incorrect password.</p>
          )}
          <button
            type="submit"
            className="w-full bg-stone-900 hover:bg-stone-800 text-white font-medium py-3 rounded-xl transition-colors text-sm"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminGate;
