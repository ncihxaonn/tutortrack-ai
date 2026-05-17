import React, { useState } from 'react';
import { BookOpen, Lock, Mail } from 'lucide-react';
import { useAuth } from '../lib/authContext';

const LoginPage: React.FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
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
          <p className="text-sm text-stone-500 mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
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
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-[11px] text-stone-400 text-center mt-6">
          Account access is provisioned by the site owner.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
