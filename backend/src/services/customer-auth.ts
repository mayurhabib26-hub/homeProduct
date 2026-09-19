/**
 * Customer authentication — phone + OTP, no password.
 *
 * See docs/AUTH.md §4. The phone number is the identity: it is already on
 * every order, the courier needs it, and guest tracking already authenticates
 * with it. A password would be a second credential for no gain, plus a reset
 * flow, a hashing decision and breach exposure.
 *
 * The provider is a delivery pipe and nothing more. We generate the code,
 * store an HMAC of it, count the attempts and verify it. Turnkey "send and
 * verify OTP for you" APIs move those properties somewhere we cannot audit.
 *
 * Every rule below is enforced here rather than at the route, so a second
 * caller cannot skip one by accident.
 */
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { createHmac, randomInt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { getDb } from '../db/client.js';
import { customers, customerSessions, otpCodes, otpSendLog, orders } from '../db/schema.js';
import { jwtSecret } from '../lib/env.js';
import { ApiError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const OTP_TTL_MS = 5 * 60 * 1000;
export const MAX_VERIFY_ATTEMPTS = 3;
export const SENDS_PER_HOUR = 3;
export const SENDS_PER_DAY = 10;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 10 digits, no country code — the same shape orders.phone already stores. */
export function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  if (!/^[6-9]\d{9}$/.test(ten)) {
    throw new ApiError(400, 'INVALID_PHONE', 'Enter a 10-digit Indian mobile number.');
  }
  return ten;
}

/**
 * HMAC, not a bare hash: the secret means a stolen database still cannot be
 * brute-forced offline against a 6-digit space, which takes microseconds.
 */
const hashCode = (phone: string, code: string): string =>
  createHmac('sha256', jwtSecret).update(`${phone}:${code}`).digest('hex');

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/** Constant-time, on equal-length hex digests. */
function sameDigest(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export interface RequestOtpResult {
  /** Seconds until another send is allowed. Drives the resend countdown. */
  retryAfterSeconds: number;
  /** True when no provider is configured and the code was only logged. */
  simulated: boolean;
}

/**
 * Issue a code. One live code per phone — a new request replaces the old one,
 * so an attacker cannot keep several valid codes in flight.
 */
export async function requestOtp(
  phone: string,
  send: (phone: string, code: string) => Promise<{ simulated: boolean }>,
): Promise<RequestOtpResult> {
  const db = getDb();
  const now = new Date();

  const recent = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), gt(otpCodes.createdAt, new Date(now.getTime() - 60_000))))
    .limit(1);

  if (recent.length) {
    throw new ApiError(429, 'OTP_TOO_SOON', 'A code was just sent. Wait a moment before asking for another.');
  }

  await enforceSendQuota(phone, now);

  // randomInt, never Math.random: a predictable OTP is not an OTP.
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  await db
    .insert(otpCodes)
    .values({ phone, codeHash: hashCode(phone, code), expiresAt, attempts: 0 })
    .onConflictDoUpdate({
      target: otpCodes.phone,
      set: { codeHash: hashCode(phone, code), expiresAt, attempts: 0, consumedAt: null, createdAt: now },
    });

  const { simulated } = await send(phone, code);

  // The code is never logged, even in development. Whoever can read the logs
  // could otherwise log in as any customer who asked for one.
  logger.info({ simulated, ttlSeconds: OTP_TTL_MS / 1000 }, 'otp issued');
  return { retryAfterSeconds: 60, simulated };
}

/**
 * Send quotas are counted from the audit of issued codes rather than a
 * counter, so restarting the process does not reset someone's budget.
 */
async function enforceSendQuota(phone: string, now: Date): Promise<void> {
  const db = getDb();
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const hourAgo = new Date(now.getTime() - 3_600_000);

  const sends = await db
    .select({ createdAt: otpSendLog.createdAt })
    .from(otpSendLog)
    .where(and(eq(otpSendLog.phone, phone), gt(otpSendLog.createdAt, dayAgo)));

  const day = sends.length;
  const hour = sends.filter((r) => r.createdAt > hourAgo).length;

  if (hour >= SENDS_PER_HOUR) {
    throw new ApiError(429, 'OTP_RATE_LIMITED', 'Too many codes requested. Try again in an hour.');
  }
  if (day >= SENDS_PER_DAY) {
    throw new ApiError(429, 'OTP_RATE_LIMITED', 'Too many codes requested today. Try again tomorrow.');
  }

  await db.insert(otpSendLog).values({ phone, createdAt: now });
}

export interface VerifyResult {
  token: string;
  expiresAt: Date;
  customerId: number;
  isNew: boolean;
  ordersLinked: number;
}

export async function verifyOtp(phone: string, code: string): Promise<VerifyResult> {
  const db = getDb();
  const now = new Date();

  const [row] = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone)).limit(1);

  // One message for every failure mode below: "wrong code", "expired" and
  // "no code requested" must not be distinguishable, or the endpoint becomes
  // an oracle for which numbers are mid-login.
  const reject = () =>
    new ApiError(400, 'OTP_INVALID', 'That code is not right, or it has expired. Ask for a new one.');

  if (!row || row.consumedAt || row.expiresAt <= now) throw reject();

  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    // Dead, not merely wrong — a fresh code is required.
    throw new ApiError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Too many attempts. Ask for a new code.');
  }

  // The attempt is recorded BEFORE comparing, so a crash mid-verify cannot
  // hand someone a free guess.
  await db.update(otpCodes).set({ attempts: row.attempts + 1 }).where(eq(otpCodes.id, row.id));

  if (!sameDigest(row.codeHash, hashCode(phone, code))) throw reject();

  // One code, one login.
  await db.update(otpCodes).set({ consumedAt: now }).where(eq(otpCodes.id, row.id));

  const [existing] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  const customer =
    existing ??
    (await db.insert(customers).values({ phone }).returning())[0]!;

  await db.update(customers).set({ lastLoginAt: now }).where(eq(customers.id, customer.id));

  /**
   * Backfill. Orders placed as a guest with this number become theirs, which
   * is the entire reason orders.customer_id is nullable.
   */
  const linked = await db
    .update(orders)
    .set({ customerId: customer.id })
    .where(and(eq(orders.phone, phone), isNull(orders.customerId)))
    .returning({ id: orders.id });

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(customerSessions).values({
    customerId: customer.id, tokenHash: hashToken(token), expiresAt,
  });

  logger.info({ isNew: !existing, ordersLinked: linked.length }, 'customer signed in');

  return {
    token, expiresAt, customerId: customer.id,
    isNew: !existing, ordersLinked: linked.length,
  };
}

export async function customerFromToken(token: string | undefined) {
  if (!token) return null;
  const db = getDb();
  const [row] = await db
    .select({ customer: customers })
    .from(customerSessions)
    .innerJoin(customers, eq(customers.id, customerSessions.customerId))
    .where(
      and(
        eq(customerSessions.tokenHash, hashToken(token)),
        isNull(customerSessions.revokedAt),
        gt(customerSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row?.customer ?? null;
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  const db = getDb();
  await db
    .update(customerSessions)
    .set({ revokedAt: new Date() })
    .where(eq(customerSessions.tokenHash, hashToken(token)));
}

/** Housekeeping for the expiry the Redis design would have got for free. */
export async function purgeExpiredOtps(now = new Date()): Promise<number> {
  const db = getDb();
  const gone = await db.delete(otpCodes).where(lt(otpCodes.expiresAt, now)).returning({ id: otpCodes.id });
  return gone.length;
}
