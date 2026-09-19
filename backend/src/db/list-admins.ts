/**
 * Who can sign in to the admin panel.
 *
 * Prints emails, roles and whether the account is active. Never prints or
 * derives anything about a password — there is nothing here to recover one
 * from, by design.
 *
 *   npm run admin:list -w backend        (stop the API first on PGlite)
 */
import { getDb } from './client.js';
import { adminUsers } from './schema.js';

const db = getDb();
const rows = await db.select().from(adminUsers);

if (rows.length === 0) {
  console.log('No admin accounts. Create one with:');
  console.log("  npm run admin:create -w backend -- <email> '<password>' owner");
} else {
  for (const r of rows) {
    console.log(`${r.active ? 'active     ' : 'DEACTIVATED'}  ${r.role.padEnd(6)}  ${r.email}`);
  }
}
process.exit(0);
