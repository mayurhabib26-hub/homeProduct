/**
 * Analytics consent.
 *
 * Shown only when analytics is actually configured and the visitor has not
 * chosen yet. Declining is exactly as easy as accepting — same size, same
 * prominence, no dark pattern where "Reject" is a grey link under the fold.
 * Under the DPDP Act consent is an affirmative act, so nothing loads until
 * Accept is pressed.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { analyticsConfigured, getConsent, setConsent } from '../lib/analytics';

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (analyticsConfigured && getConsent() === 'unset') setVisible(true);
  }, []);

  if (!visible) return null;

  const choose = (state: 'granted' | 'denied') => {
    setConsent(state);
    setVisible(false);
  };

  return (
    <div
      // A dialog would trap focus and block the page; this is a notice the
      // visitor can ignore while they read, so it is a region.
      role="region"
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#EBD9BC] bg-[#FAF6F0] px-4 py-4 shadow-[0_-4px_16px_rgba(72,56,40,0.08)] sm:px-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-sans text-xs leading-relaxed text-[#483828] sm:text-sm">
          We would like to measure which pages people find useful. No personal
          details are shared, and the site works the same either way.{' '}
          <Link
            to="/policies/privacy"
            className="font-semibold text-[#87380F] underline underline-offset-2 hover:text-[#662707]"
          >
            Privacy policy
          </Link>
        </p>

        <div className="flex shrink-0 gap-2.5">
          <button
            type="button"
            onClick={() => choose('denied')}
            className="min-h-11 flex-1 rounded-md border border-[#EBD9BC] bg-white px-5 font-sans text-xs font-semibold tracking-wider text-[#483828] transition-colors hover:border-[#87380F] hover:text-[#87380F] sm:flex-none"
          >
            No thanks
          </button>
          <button
            type="button"
            onClick={() => choose('granted')}
            className="min-h-11 flex-1 rounded-md bg-[#87380F] px-5 font-sans text-xs font-semibold tracking-wider text-[#FAF6F0] transition-colors hover:bg-[#662707] sm:flex-none"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
