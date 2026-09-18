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

/* --- Compliance values, rendered on the storefront ---------------------- */

/**
 * These are legal declarations. An unset value renders as a visible gap
 * rather than an empty string, so a missing FSSAI number on a live site is
 * obvious rather than invisible. See docs/COMPLIANCE.md §2.
 */
const declared = (v: string | undefined, label: string) => v?.trim() || `[${label} not set]`;

export const SELLER_LEGAL_NAME = declared(import.meta.env.VITE_SELLER_LEGAL_NAME, 'business name');
export const SELLER_ADDRESS = declared(import.meta.env.VITE_SELLER_ADDRESS, 'address');
export const FSSAI_LICENCE = declared(import.meta.env.VITE_FSSAI_LICENCE, 'FSSAI licence');
export const GRIEVANCE_OFFICER = declared(import.meta.env.VITE_GRIEVANCE_OFFICER, 'grievance officer');
export const GRIEVANCE_EMAIL = declared(import.meta.env.VITE_GRIEVANCE_EMAIL, 'grievance email');

/** Substitutes {{TOKENS}} in policy drafts with configured values. */
export function fillPolicyText(text: string): string {
  return text
    .replace(/\{\{SELLER_LEGAL_NAME\}\}/g, SELLER_LEGAL_NAME)
    .replace(/\{\{SELLER_ADDRESS\}\}/g, SELLER_ADDRESS)
    .replace(/\{\{GRIEVANCE_OFFICER\}\}/g, GRIEVANCE_OFFICER)
    .replace(/\{\{GRIEVANCE_EMAIL\}\}/g, GRIEVANCE_EMAIL);
}
