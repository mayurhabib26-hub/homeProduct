/**
 * Admin authentication.
 *
 * Full rationale in docs/AUTH.md §3. The two things most easily gotten wrong
 * are both handled here: bcrypt runs even for an unknown email, and the
 * error is identical whichever half was wrong.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { adminUsers, adminSessions, auditLog } from '../db/schema.js';
import { env, jwtSecret } from '../lib/env.js';
import { ApiError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export type AdminRole = 'owner' | 'staff';
export interface AdminIdentity {
  id: number;
  email: string;
  role: AdminRole;
}

const BCRYPT_COST = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const ACCESS_TOKEN_MINUTES = 15;

/**
 * A real bcrypt hash of a value nobody knows, compared against when the email
 * does not exist.
 *
 * Without this, an unknown email returns in ~5ms and a known one in ~200ms,
 * and the response time enumerates every admin account you have.
 */
const DUMMY_HASH = bcrypt.hashSync(randomBytes(32).toString('hex'), BCRYPT_COST);

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_COST);

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/** Identical message whichever half was wrong — never reveal which. */
const invalidCredentials = () =>
  new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');

export async function login(email: string, password: string, ip?: string) {
  const db = getDb();
  const normalised = email.trim().toLowerCase();

  const [user] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, normalised))
    .limit(1);

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const seconds = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
    throw new ApiError(429, 'ACCOUNT_LOCKED', 'Too many attempts. Try again shortly.', { retryAfterSeconds: seconds });
  }

  // Runs whether or not the user exists. Do not shortcut this.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !user.active || !ok) {
    if (user) await registerFailure(user.id, user.failedAttempts);
    logger.warn({ email: normalised, ip, found: Boolean(user) }, 'admin login failed');
    throw invalidCredentials();
  }

  await db
    .update(adminUsers)
    .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(adminUsers.id, user.id));

  const identity: AdminIdentity = { id: user.id, email: user.email, role: user.role as AdminRole };
  const { refreshToken, expiresAt } = await issueSession(user.id, ip);

  await record(identity, 'login', 'admin_user', String(user.id), null, null, ip);
  logger.info({ adminId: user.id, ip }, 'admin login');

  return { identity, accessToken: signAccess(identity), refreshToken, expiresAt };
}

async function registerFailure(userId: number, current: number) {
  const db = getDb();
  const attempts = current + 1;
  const locked = attempts >= MAX_FAILED_ATTEMPTS;
  await db
    .update(adminUsers)
    .set({
      failedAttempts: attempts,
      lockedUntil: locked ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
    })
    .where(eq(adminUsers.id, userId));
}

const signAccess = (identity: AdminIdentity) =>
  jwt.sign(identity, jwtSecret, { expiresIn: `${ACCESS_TOKEN_MINUTES}m` });

export function verifyAccess(token: string): AdminIdentity {
  try {
    const payload = jwt.verify(token, jwtSecret) as AdminIdentity & { iat: number; exp: number };
    return { id: payload.id, email: payload.email, role: payload.role };
  } catch {
    throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
  }
}

async function issueSession(adminUserId: number, ip?: string) {
  const db = getDb();
  const refreshToken = randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + env.ADMIN_SESSION_HOURS * 3600_000);

  await db.insert(adminSessions).values({
    adminUserId,
    tokenHash: sha256(refreshToken),
    expiresAt,
    ip: ip ?? null,
  });

  return { refreshToken, expiresAt };
}

/** Rotating refresh: the old token is revoked as the new one is issued. */
export async function refresh(refreshToken: string, ip?: string) {
  const db = getDb();
  const hash = sha256(refreshToken);

  const [session] = await db
    .select()
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.tokenHash, hash),
        isNull(adminSessions.revokedAt),
        gt(adminSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) throw new ApiError(401, 'SESSION_EXPIRED', 'Please sign in again.');

  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, session.adminUserId)).limit(1);
  if (!user || !user.active) throw new ApiError(401, 'SESSION_EXPIRED', 'Please sign in again.');

  await db.update(adminSessions).set({ revokedAt: new Date() }).where(eq(adminSessions.id, session.id));

  const identity: AdminIdentity = { id: user.id, email: user.email, role: user.role as AdminRole };
  const next = await issueSession(user.id, ip);

  return { identity, accessToken: signAccess(identity), ...next };
}

export async function logout(refreshToken: string) {
  const db = getDb();
  await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.tokenHash, sha256(refreshToken)));
}

/** Constant-time compare, for anything secret that is not a bcrypt hash. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function record(
  admin: AdminIdentity | null,
  action: string,
  entityType: string,
  entityId: string | null,
  before: unknown,
  after: unknown,
  ip?: string,
) {
  const db = getDb();
  await db.insert(auditLog).values({
    adminUserId: admin?.id ?? null,
    adminEmail: admin?.email ?? null,
    action,
    entityType,
    entityId,
    before: before ?? null,
    after: after ?? null,
    ip: ip ?? null,
  });
}
