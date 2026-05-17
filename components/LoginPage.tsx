import React, { useState } from 'react';
import { BookOpen, Lock, Mail } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { ENV } from '../lib/env';

const LoginPage: React.FC = () => {
  const { signIn } = useAuth();

  // If VITE_AUTH_EMAIL is set, the login form hides the email field — you
  // type only the password and we sign in with the baked-in address.
  const fixedEmail = ENV.AUTH_EMAIL;
  const [email, setEmail] = useState(fixedEmail ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn((fixedEmail ?? email).trim(), password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-cream-border shadow-lg p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-coral-600 p-3 rounded-xl mb-4">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-serif text-2xl font-semibold text-stone-900 tracking-tight">TutorTrack</h1>
          <p className="text-sm text-stone-500 mt-1">
            {fixedEmail ? 'Enter your password to continue' : 'Sign in to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!fixedEmail && (
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                placeholder="you@example.com"
                aria-label="Email"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-cream-border text-sm focus:outline-none focus:ring-2 focus:ring-coral-200 focus:border-coral-400"
              />
            </div>
          )}
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoFocus={!!fixedEmail}
              autoComplete="current-password"
              placeholder="Password"
              aria-label="Password"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-cream-border text-sm focus:outline-none focus:ring-2 focus:ring-coral-200 focus:border-coral-400"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-coral-600 hover:bg-coral-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors text-sm"
          >
            {submitting ? 'Signing in…' : (fixedEmail ? 'Unlock' : 'Sign In')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
