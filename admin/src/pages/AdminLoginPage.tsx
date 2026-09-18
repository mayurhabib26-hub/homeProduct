import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, AdminApiError } from '../api/client';
import { Button } from '../components/ui/Button';

/**
 * The only login page in the system.
 *
 * Seven elements and nothing else: no registration, no password reset, no
 * remember-me. Each omission is a deliberate reduction in attack surface,
 * argued in docs/ADMIN.md §4.1.
 */
export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockedFor, setLockedFor] = useState(0);
  const tick = useRef<number>(0);

  // A countdown sets an expectation; "try again later" does not.
  useEffect(() => {
    if (lockedFor <= 0) return;
    tick.current = window.setInterval(() => setLockedFor((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(tick.current);
  }, [lockedFor]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminApi.login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof AdminApiError && (err.code === 'ACCOUNT_LOCKED' || err.code === 'RATE_LIMITED')) {
        setLockedFor(60);
      }
      // Whatever the server said — it deliberately never reveals which half
      // was wrong.
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
      setBusy(false);
    }
  };

  const locked = lockedFor > 0;
  const mmss = `${String(Math.floor(lockedFor / 60)).padStart(2, '0')}:${String(lockedFor % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-[#FAF6F0] grid place-items-center px-4">
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center gap-2 mb-6">
          <span
            aria-hidden="true"
            className="grid place-items-center w-12 h-12 rounded-xl bg-[#87380F] text-[#FAF6F0] text-sm font-bold"
          >
            SV
          </span>
          <span className="text-center leading-tight">
            <span className="block text-sm font-semibold">S V Home Products</span>
            <span className="block text-[11px] text-[#483828]/55">Admin Panel — for internal use only</span>
          </span>
        </div>

        <form onSubmit={submit} className="bg-white border border-[#EBD9BC] rounded-xl p-5 space-y-4">
          <div>
            <h1 className="text-lg font-semibold">Welcome back</h1>
            <p className="text-xs text-[#483828]/60 mt-0.5">Sign in to continue.</p>
          </div>

          <div>
            <label htmlFor="admin-email" className="block text-xs font-semibold mb-1">Email</label>
            <input
              id="admin-email" type="email" autoComplete="email" autoFocus required
              value={email} onChange={(e) => setEmail(e.target.value)}
              aria-describedby={error ? 'admin-login-error' : undefined}
              aria-invalid={Boolean(error)}
              className="w-full min-h-11 rounded-md border border-[#EBD9BC] bg-[#FAF6F0] px-3 text-sm"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold mb-1">Password</label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                aria-describedby={error ? 'admin-login-error' : undefined}
                aria-invalid={Boolean(error)}
                className="w-full min-h-11 rounded-md border border-[#EBD9BC] bg-[#FAF6F0] pl-3 pr-20 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 px-2 rounded text-xs font-semibold text-[#87380F]"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <p id="admin-login-error" role="alert" className="text-xs text-[#A33A28]">
              {locked ? `Too many attempts. Try again in ${mmss}.` : error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy || locked}>
            {busy ? 'Signing in…' : locked ? `Locked — ${mmss}` : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
};
