/**
 * Create or reset an admin account.
 *
 *   npm run admin:create -w backend -- owner@example.com 'a-strong-password' owner
 *
 * There is deliberately no self-service registration route: admin accounts
 * are created here, by someone with server access. See docs/AUTH.md §3.
 */
import { eq } from 'drizzle-orm';
import { getDb } from './client.js';
import { adminUsers } from './schema.js';
import { hashPassword } from '../services/admin-auth.js';

const [email, password, role = 'staff'] = process.argv.slice(2);

if (!email || !password) {
  console.error('usage: npm run admin:create -w backend -- <email> <password> [owner|staff]');
  process.exit(1);
}
if (password.length < 12) {
  console.error('Password must be at least 12 characters.');
  process.exit(1);
}
if (role !== 'owner' && role !== 'staff') {
  console.error("Role must be 'owner' or 'staff'.");
  process.exit(1);
}

const db = getDb();
const normalised = email.trim().toLowerCase();
const passwordHash = await hashPassword(password);

const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, normalised)).limit(1);

if (existing) {
  await db
    .update(adminUsers)
    .set({ passwordHash, role, active: true, failedAttempts: 0, lockedUntil: null })
    .where(eq(adminUsers.id, existing.id));
  console.log(`updated ${normalised} (${role})`);
} else {
  await db.insert(adminUsers).values({ email: normalised, passwordHash, role });
  console.log(`created ${normalised} (${role})`);
}

process.exit(0);
