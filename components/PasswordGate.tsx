import React, { useState } from 'react';
import { BookOpen, Lock } from 'lucide-react';

const CORRECT_PASSWORD = (import.meta.env.VITE_SITE_PASSWORD as string | undefined)?.trim();
const SESSION_KEY = 'tt_auth';

export function isAuthenticated(): boolean {
  if (!CORRECT_PASSWORD) return true; // no password set → open
  return sessionStorage.getItem(SESSION_KEY) === 'yes';
}

const PasswordGate: React.FC<{ onUnlock: () => void }> = ({ onUnlock }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  const attempt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!CORRECT_PASSWORD || value === CORRECT_PASSWORD) {
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
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className={`bg-white rounded-2xl border border-cream-border shadow-lg p-8 w-full max-w-sm ${shaking ? 'animate-shake' : ''}`}>
        <div className="flex flex-col items-center mb-8">
          <div className="bg-coral-600 p-3 rounded-xl mb-4">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-serif text-2xl font-semibold text-stone-900 tracking-tight">TutorTrack</h1>
          <p className="text-sm text-stone-500 mt-1">Enter your password to continue</p>
        </div>

        <form onSubmit={attempt} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="password"
              value={value}
              onChange={e => { setValue(e.target.value); setError(false); }}
              placeholder="Password"
              autoFocus
              className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors ${
                error
                  ? 'border-red-300 bg-red-50 focus:ring-red-200 text-red-700 placeholder-red-300'
                  : 'border-cream-border focus:ring-coral-200 focus:border-coral-400'
              }`}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 text-center">Incorrect password. Try again.</p>
          )}
          <button
            type="submit"
            className="w-full bg-coral-600 hover:bg-coral-700 text-white font-medium py-3 rounded-xl transition-colors text-sm"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordGate;
