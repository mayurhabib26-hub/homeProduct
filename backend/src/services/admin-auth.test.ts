/**
 * Admin auth. Run: npm run test:auth -w backend   (stop the API first)
 *
 * Calls the service directly, so the rate limiter cannot mask what is being
 * measured — an HTTP-level timing test measures the limiter, not bcrypt.
 */
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { login, hashPassword, verifyAccess, refresh, logout } from './admin-auth.js';
import { adminUsers } from '../db/schema.js';

const db = getDb();
const EMAIL = 'timing-test@svhome.test';
const PASSWORD = 'a-sufficiently-long-password';

await db.execute(sql`delete from ${adminUsers} where email = ${EMAIL}`);
await db.insert(adminUsers).values({
  email: EMAIL, passwordHash: await hashPassword(PASSWORD), role: 'owner',
});

/* --- a good login works ------------------------------------------------ */
const session = await login(EMAIL, PASSWORD);
assert.equal(session.identity.email, EMAIL);
assert.equal(session.identity.role, 'owner');
assert.ok(session.accessToken.length > 20);
assert.equal(verifyAccess(session.accessToken).email, EMAIL, 'the access token verifies');

/* --- a bad password does not --------------------------------------------*/
await assert.rejects(() => login(EMAIL, 'wrong-password-entirely'), /Invalid email or password/);

/* --- an unknown email fails the same way ------------------------------- */
await assert.rejects(() => login('nobody@svhome.test', PASSWORD), /Invalid email or password/);

/* --- TIMING: the reason bcrypt runs even for an unknown email ---------- */
const timeOf = async (email: string) => {
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await login(email, 'wrong-password-entirely').catch(() => {});
    runs.push(performance.now() - t0);
    // clear the lockout so attempt 6 is not measuring a rejection
    await db.execute(sql`update ${adminUsers} set failed_attempts = 0, locked_until = null`);
  }
  runs.sort((a, b) => a - b);
  return runs[Math.floor(runs.length / 2)]!; // median
};

const known = await timeOf(EMAIL);
const unknown = await timeOf('nobody@svhome.test');
const ratio = Math.max(known, unknown) / Math.min(known, unknown);

console.log(`  known email  : ${known.toFixed(0)} ms`);
console.log(`  unknown email: ${unknown.toFixed(0)} ms`);
console.log(`  ratio        : ${ratio.toFixed(2)}x`);

assert.ok(
  ratio < 1.5,
  `response time must not reveal whether an account exists (ratio ${ratio.toFixed(2)}x — bcrypt is being skipped for unknown emails)`,
);

/* --- lockout after repeated failures ----------------------------------- */
await db.execute(sql`update ${adminUsers} set failed_attempts = 0, locked_until = null`);
for (let i = 0; i < 5; i++) await login(EMAIL, 'wrong-password-entirely').catch(() => {});
await assert.rejects(() => login(EMAIL, PASSWORD), /Too many attempts/, 'locked out even with the right password');

/* --- refresh rotates, and the old token dies --------------------------- */
await db.execute(sql`update ${adminUsers} set failed_attempts = 0, locked_until = null`);
const fresh = await login(EMAIL, PASSWORD);
const rotated = await refresh(fresh.refreshToken);
assert.notEqual(rotated.refreshToken, fresh.refreshToken, 'refresh token rotates');
await assert.rejects(() => refresh(fresh.refreshToken), /sign in again/, 'the old refresh token is revoked');

/* --- logout revokes ----------------------------------------------------- */
await logout(rotated.refreshToken);
await assert.rejects(() => refresh(rotated.refreshToken), /sign in again/, 'logout revokes server-side');

await db.execute(sql`delete from ${adminUsers} where email = ${EMAIL}`);
console.log('admin-auth.ts: all assertions passed');
process.exit(0);
