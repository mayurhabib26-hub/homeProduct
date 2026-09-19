/**
 * Customer sign-in. Phone, then a six-digit code. No password anywhere.
 *
 * Two screens, per docs/AUTH.md §4. An account is an option and never a gate
 * — checkout works without one — so this page says so rather than implying
 * the shop is closed until you sign in.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiRequestError } from '../api/client';
import { useShop } from '../context/ShopContext';

const RESEND_SECONDS = 30;

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { syncWishlist } = useShop();
  const next = params.get('next') ?? '/account';

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  const send = async (resend = false) => {
    setError(null);
    setBusy(true);
    try {
      const r = await api.requestOtp(phone);
      setStep('code');
      setCountdown(RESEND_SECONDS);
      setNotice(
        r.simulated
          ? 'No SMS provider is configured yet — the code is in the server log.'
          : resend ? 'A new code is on its way.' : null,
      );
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    setError(null);
    setBusy(true);
    try {
      const r = await api.verifyOtp(phone, value);

      // Before navigating: anything saved as a guest is merged into the
      // account now, or it is lost the moment this page unmounts.
      await syncWishlist();

      navigate(next, {
        replace: true,
        state: { justSignedIn: true, ordersLinked: r.ordersLinked },
      });
    } catch (e) {
      setCode('');
      setError(e instanceof ApiRequestError ? e.message : 'Something went wrong. Try again.');
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:py-20">
      <h1 className="font-serif text-3xl font-bold tracking-tight text-[#483828]">
        {step === 'phone' ? 'Sign in' : 'Enter your code'}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[#483828]/70">
        {step === 'phone' ? (
          <>
            To see your orders and reorder in one tap. You don’t need an account to
            buy — <Link to="/shop" className="font-semibold text-[#87380F] underline underline-offset-2">shop as a guest</Link> any time.
          </>
        ) : (
          <>We sent a six-digit code to +91 {phone}.</>
        )}
      </p>

      {error && (
        <p role="alert" className="mt-5 rounded-md border border-[#A33A28]/30 bg-[#FBEDEA] p-3 text-xs font-medium leading-relaxed text-[#A33A28]">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="mt-5 rounded-md border border-[#EBD9BC] bg-[#F7EFE1] p-3 text-xs leading-relaxed text-[#483828]/80">
          {notice}
        </p>
      )}

      {step === 'phone' ? (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (phone.length === 10) send(); }}
        >
          <div>
            <label htmlFor="phone" className="block text-xs font-semibold tracking-wide text-[#483828]">
              Mobile number
            </label>
            <div className="mt-1.5 flex">
              <span
                aria-hidden="true"
                className="inline-flex min-h-12 items-center rounded-l-md border border-r-0 border-[#EBD9BC] bg-[#F3E7D0] px-3 text-sm font-medium text-[#483828]/70"
              >
                +91
              </span>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                autoFocus
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="98765 43210"
                className="min-h-12 w-full rounded-r-md border border-[#EBD9BC] bg-white px-3 text-sm text-[#483828] focus:border-[#87380F] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={phone.length !== 10 || busy}
            className="min-h-12 w-full rounded-md bg-[#87380F] text-sm font-semibold tracking-wider text-[#FAF6F0] transition-colors hover:bg-[#662707] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Continue'}
          </button>
        </form>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (code.length === 6) verify(code); }}
        >
          <div>
            <label htmlFor="code" className="block text-xs font-semibold tracking-wide text-[#483828]">
              Six-digit code
            </label>
            <input
              id="code"
              ref={codeRef}
              name="code"
              type="text"
              inputMode="numeric"
              // iOS reads the code straight out of the SMS with this.
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(v);
                // Auto-submit on the sixth digit — nobody wants to reach for
                // a button after typing a code they just read off a screen.
                if (v.length === 6 && !busy) verify(v);
              }}
              className="mt-1.5 min-h-12 w-full rounded-md border border-[#EBD9BC] bg-white px-3 text-center font-mono text-2xl tracking-[0.4em] text-[#483828] focus:border-[#87380F] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={code.length !== 6 || busy}
            className="min-h-12 w-full rounded-md bg-[#87380F] text-sm font-semibold tracking-wider text-[#FAF6F0] transition-colors hover:bg-[#662707] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Checking…' : 'Sign in'}
          </button>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => { setStep('phone'); setCode(''); setError(null); setNotice(null); }}
              className="inline-flex min-h-11 items-center text-xs font-semibold text-[#87380F] hover:underline"
            >
              Change number
            </button>
            <button
              type="button"
              disabled={countdown > 0 || busy}
              onClick={() => send(true)}
              className="inline-flex min-h-11 items-center text-xs font-semibold text-[#87380F] hover:underline disabled:cursor-not-allowed disabled:text-[#483828]/40 disabled:no-underline"
            >
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
