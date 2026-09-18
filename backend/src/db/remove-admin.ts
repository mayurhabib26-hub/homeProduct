/**
 * Deactivate an admin account and revoke its sessions.
 *
 *   npm run admin:remove -w backend -- someone@example.com
 *
 * Deactivates rather than deletes, so audit_log entries keep pointing at a
 * real account — "who changed this price" must stay answerable after someone
 * leaves. Sessions are revoked immediately.
 */
import { eq } from 'drizzle-orm';
import { getDb } from './client.js';
import { adminUsers, adminSessions } from './schema.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('usage: npm run admin:remove -w backend -- <email>');
  process.exit(1);
}

const db = getDb();
const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);

if (!user) {
  console.error(`No admin account for ${email}.`);
  process.exit(1);
}

await db.update(adminUsers).set({ active: false }).where(eq(adminUsers.id, user.id));
const revoked = await db
  .update(adminSessions)
  .set({ revokedAt: new Date() })
  .where(eq(adminSessions.adminUserId, user.id))
  .returning({ id: adminSessions.id });

console.log(`deactivated ${email} (${user.role}), revoked ${revoked.length} session(s)`);

const usingPglite = !process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('pglite:');
if (usingPglite) {
  console.log('\nRestart the API for this to take effect.');
}

process.exit(0);
