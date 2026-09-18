/**
 * Signature verification. Fully testable without a Razorpay account: HMAC is
 * deterministic, so a known secret proves the whole verification path.
 *
 * Run: npm run test:payments -w backend
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyCheckoutSignature, verifyWebhookSignature } from './payments.js';

const SECRET = 'test_key_secret_not_a_real_one';

/* --- checkout callback signature --------------------------------------- */
{
  const orderId = 'order_NxxxxxxxxxxxxA';
  const paymentId = 'pay_NxxxxxxxxxxxxB';
  const good = createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');

  assert.equal(verifyCheckoutSignature(orderId, paymentId, good, SECRET), true, 'valid signature accepted');

  assert.equal(
    verifyCheckoutSignature(orderId, paymentId, good, 'wrong_secret'),
    false,
    'a forged signature under a different secret is rejected',
  );

  // Swapping the ids produces a different message and must not verify —
  // the "|" separator is what stops order_a|pay_b colliding with order_ap|ay_b.
  assert.equal(verifyCheckoutSignature(paymentId, orderId, good, SECRET), false, 'ids are not interchangeable');

  assert.equal(verifyCheckoutSignature(orderId, paymentId, '', SECRET), false, 'empty signature rejected');
  assert.equal(verifyCheckoutSignature(orderId, paymentId, good.slice(0, -1), SECRET), false, 'truncated rejected');
  assert.equal(
    verifyCheckoutSignature(orderId, paymentId, good.slice(0, -1) + (good.endsWith('a') ? 'b' : 'a'), SECRET),
    false,
    'a single flipped character is rejected',
  );
}

/* --- webhook signature, over the RAW body ------------------------------ */
{
  const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_X' } } } });
  const good = createHmac('sha256', SECRET).update(raw).digest('hex');

  assert.equal(verifyWebhookSignature(raw, good, SECRET), true, 'raw body verifies');
  assert.equal(verifyWebhookSignature(Buffer.from(raw), good, SECRET), true, 'Buffer and string agree');

  // This is the failure that bites everyone: parsing and re-serialising
  // changes the bytes, so the HMAC no longer matches. Proof that the webhook
  // route must use express.raw().
  const reserialised = JSON.stringify(JSON.parse(raw), null, 2);
  assert.notEqual(reserialised, raw);
  assert.equal(
    verifyWebhookSignature(reserialised, good, SECRET),
    false,
    'a re-serialised body does NOT verify — express.raw() is mandatory',
  );

  assert.equal(verifyWebhookSignature(raw, good, 'wrong_secret'), false);
  assert.equal(verifyWebhookSignature(raw + ' ', good, SECRET), false, 'a single trailing space breaks it');
}

console.log('payments.ts: all signature assertions passed');
