/**
 * Run a command against a real, multi-process Postgres.
 *
 * There is no Docker on every machine, and PGlite — while genuinely Postgres —
 * is single-process, so it cannot produce lock contention. `embedded-postgres`
 * downloads the official binaries and runs an actual server on a port, which
 * is what the concurrency test in docs/TESTING.md §3 requires before it may be
 * believed.
 *
 *   node backend/scripts/with-postgres.mjs npm run test:concurrency -w backend
 *
 * The cluster is ephemeral: a fresh data directory per run, removed on exit.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

const DB = 'sv_test';
const USER = 'sv';
const PASSWORD = 'sv';

/** Ask the OS for a port rather than guessing one that may be taken. */
const freePort = () =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error('usage: with-postgres.mjs <command> [args...]');
  process.exit(2);
}

const databaseDir = await mkdtemp(join(tmpdir(), 'sv-pg-'));
const port = await freePort();
const pg = new EmbeddedPostgres({
  databaseDir, user: USER, password: PASSWORD, port,
  persistent: false, onLog: () => {},
});

let stopped = false;
const teardown = async () => {
  if (stopped) return;
  stopped = true;
  try { await pg.stop(); } catch { /* already down */ }
  await rm(databaseDir, { recursive: true, force: true });
};
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => teardown().then(() => process.exit(130)));

console.log(`booting postgres on :${port} …`);
await pg.initialise();
await pg.start();
await pg.createDatabase(DB);

const url = `postgres://${USER}:${PASSWORD}@127.0.0.1:${port}/${DB}`;
const [cmd, ...args] = argv;

const code = await new Promise((resolve) => {
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
  child.on('exit', (c, signal) => resolve(signal ? 1 : (c ?? 1)));
  child.on('error', (err) => { console.error(String(err)); resolve(1); });
});

await teardown();
process.exit(code);
