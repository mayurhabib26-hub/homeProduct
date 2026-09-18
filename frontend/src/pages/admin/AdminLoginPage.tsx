import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { BrandLogo } from '../../components/BrandLogo';

/**
 * The only login page in the system. Seven elements, nothing else —
 * no registration, no password reset, no remember-me. See docs/ADMIN.md §4.1.
 */
export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminApi.login(email, password);
      navigate('/admin', { replace: true });
    } catch (err) {
      // Whatever the server said — it deliberately never says which half
      // was wrong.
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] grid place-items-center px-4 font-sans">
      <div className="w-full max-w-[380px]">
        <div className="flex justify-center mb-6">
          <BrandLogo size="sm" showText={false} />
        </div>

        <form
          onSubmit={submit}
          className="bg-white border border-[#EBD9BC] rounded-xl p-6 space-y-4 shadow-xs"
        >
          <div>
            <label htmlFor="admin-email" className="block text-xs font-semibold text-[#483828] mb-1">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={error ? 'admin-login-error' : undefined}
              className="w-full bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#87380F]/40 focus:border-[#87380F]"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold text-[#483828] mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={error ? 'admin-login-error' : undefined}
                className="w-full bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3 py-2.5 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-[#87380F]/40 focus:border-[#87380F]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#87380F] px-2 py-1"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <p id="admin-login-error" role="alert" className="text-xs text-[#87380F]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 bg-[#87380F] hover:bg-[#6d2d0c] disabled:opacity-60 text-white rounded-md text-xs font-bold tracking-widest uppercase transition-colors"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};
