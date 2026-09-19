/**
 * The guards, asserted.
 *
 * Every one of these failing is a message that should not have been sent:
 * to someone who never consented, at 3am, twice, or about a cart they
 * already paid for. None of those produce an error — they produce a
 * complaint, and under TRAI a penalty.
 *
 *   npm run test:abandoned-cart -w backend
 */
import assert from 'node:assert/strict';
import {
  eligibility, withinSendWindow, istHour, SEND_WINDOW_IST, ABANDONED_AFTER_MS,
} from './abandoned-cart.js';

/** 09:30 IST == 04:00 UTC. Inside the window wherever the server runs. */
const at = (utcHour: number, utcMin = 0) =>
  new Date(Date.UTC(2026, 8, 19, utcHour, utcMin));

const IN_HOURS = at(6);      // 11:30 IST
const TOO_EARLY = at(2);     //  7:30 IST
const TOO_LATE = at(17);     // 22:30 IST

// --- the clock is IST, not the server's -----------------------------------
assert.equal(istHour(at(6)), 11, '06:00 UTC is 11:30 IST');
assert.equal(istHour(at(18, 30)), 0, '18:30 UTC is midnight IST');

assert.ok(withinSendWindow(IN_HOURS), '11:30 IST is inside the window');
assert.ok(!withinSendWindow(TOO_EARLY), '07:30 IST is before 09:00');
assert.ok(!withinSendWindow(TOO_LATE), '22:30 IST is after 21:00');
assert.ok(!withinSendWindow(at(18, 30)), 'midnight IST is never sendable');

// the boundaries themselves
assert.ok(withinSendWindow(at(3, 30)), '09:00 IST exactly is in');
assert.ok(!withinSendWindow(at(15, 30)), '21:00 IST exactly is out');

const base = { recoveredAt: null, remindedAt: null, now: IN_HOURS, consent: true };

// --- no consent, no message ------------------------------------------------
assert.equal(eligibility({ ...base, consent: false }).reason, 'no_consent');

// --- quiet hours -----------------------------------------------------------
assert.equal(eligibility({ ...base, now: TOO_LATE }).reason, 'outside_hours');
assert.equal(eligibility({ ...base, now: TOO_EARLY }).reason, 'outside_hours');

// --- never twice for the same cart ----------------------------------------
assert.equal(eligibility({ ...base, remindedAt: new Date() }).reason, 'already_reminded');

// --- and never about a cart they already bought ---------------------------
assert.equal(eligibility({ ...base, recoveredAt: new Date() }).reason, 'recovered');

/**
 * Precedence matters. A recovered cart belonging to someone who never
 * consented must report 'recovered', because the cart being paid for is the
 * reason not to send — checking consent first would hide that.
 */
assert.equal(
  eligibility({ ...base, recoveredAt: new Date(), consent: false }).reason,
  'recovered',
);

// --- unconfigured provider is a refusal, not a crash ----------------------
const verdict = eligibility(base);
assert.ok(
  verdict.send === false ? verdict.reason === 'not_configured' : verdict.send === true,
  'with everything else satisfied the only remaining blocker is configuration',
);
assert.equal(verdict.send, false, 'no WHATSAPP_CART_TEMPLATE in tests, so nothing sends');
assert.equal(verdict.reason, 'not_configured');

// --- the abandonment threshold is hours, not minutes ----------------------
assert.equal(ABANDONED_AFTER_MS, 4 * 60 * 60 * 1000);
assert.equal(SEND_WINDOW_IST.from, 9);
assert.equal(SEND_WINDOW_IST.to, 21);

console.log('abandoned cart: consent, quiet hours, dedupe and recovery guards all hold');
process.exit(0);
