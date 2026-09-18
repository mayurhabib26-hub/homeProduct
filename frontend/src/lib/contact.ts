/**
 * Business contact details, configured per environment.
 *
 * Everything VITE_-prefixed is public and ships in the browser bundle — which
 * is correct here, since these are meant to be dialled. See docs/SECURITY.md.
 */

/** Digits only, country code included, no '+' — the format wa.me expects. */
const configured = import.meta.env.VITE_WHATSAPP_NUMBER?.replace(/\D/g, '') ?? '';

// A placeholder shipped to production means orders go to a number nobody owns,
// so say so loudly in development rather than failing silently.
if (import.meta.env.DEV && !configured) {
  console.warn(
    '[contact] VITE_WHATSAPP_NUMBER is not set — WhatsApp and phone links are disabled. ' +
      'Copy .env.example to .env.local and set it.',
  );
}

export const WHATSAPP_NUMBER = configured;

/** True when contact links should render at all. */
export const hasContactNumber = WHATSAPP_NUMBER.length > 0;

/** +91 98765 43210 — grouped for display, never for hrefs. */
export function formatPhoneForDisplay(digits = WHATSAPP_NUMBER): string {
  const m = digits.match(/^(\d{2})(\d{5})(\d{5})$/);
  return m ? `+${m[1]} ${m[2]} ${m[3]}` : digits ? `+${digits}` : '';
}

export const telHref = (): string => `tel:+${WHATSAPP_NUMBER}`;

/** A wa.me deep link with the message pre-filled. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
