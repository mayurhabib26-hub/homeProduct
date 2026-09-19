/**
 * Fails the build if the storefront's FIRST LOAD exceeds its budget.
 *
 * First load is defined by the built index.html, not by guessing from
 * filenames: the entry <script type="module"> plus every
 * <link rel="modulepreload">. That is exactly what a browser fetches before
 * it can render, and it stays correct when chunk names change.
 *
 * It has been wrong twice before, both times because it pattern-matched chunk
 * names — first excluding the admin bundle, then a stale /^(useMutation)/ that
 * happened to match one chunk in one build. After the route split it counted
 * every lazy page as first load and failed a build that was 23 KB under
 * budget. Reading the HTML removes the guesswork.
 *
 * A bundle budget that is not enforced is a wish. docs/SCALING.md §3.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, basename } from 'node:path';

const BUDGET_KB = 200;
const DIST = 'frontend/dist';
const DIR = join(DIST, 'assets');
const HTML = join(DIST, 'index.html');

if (!existsSync(HTML)) {
  console.error(`No ${HTML} — did the build run?`);
  process.exit(1);
}

const html = readFileSync(HTML, 'utf8');

/** Entry scripts and preloaded modules: everything needed before first paint. */
const referenced = new Set(
  [...html.matchAll(/<(?:script[^>]*?src|link[^>]*?rel="modulepreload"[^>]*?href)="([^"]+\.js)"/g)]
    .map((m) => basename(m[1])),
);

if (referenced.size === 0) {
  console.error('index.html references no JS — the build looks broken.');
  process.exit(1);
}

const all = readdirSync(DIR).filter((f) => f.endsWith('.js'));
const gz = (f) => gzipSync(readFileSync(join(DIR, f))).length;

const eager = all.filter((f) => referenced.has(f));
const lazy = all.filter((f) => !referenced.has(f));

let total = 0;
console.log('First load (from index.html):');
for (const f of eager.sort((a, b) => gz(b) - gz(a))) {
  const size = gz(f);
  total += size;
  console.log(`  ${(size / 1024).toFixed(1).padStart(7)} KB  ${f}`);
}

if (lazy.length) {
  const lazyTotal = lazy.reduce((s, f) => s + gz(f), 0);
  console.log(`\nLazy, not counted — ${(lazyTotal / 1024).toFixed(1)} KB across ${lazy.length} chunks:`);
  for (const f of lazy.sort((a, b) => gz(b) - gz(a)).slice(0, 8)) {
    console.log(`  ${(gz(f) / 1024).toFixed(1).padStart(7)} KB  ${f}`);
  }
}

const kb = total / 1024;
console.log(`\ntotal first load ${kb.toFixed(1)} KB / ${BUDGET_KB} KB budget`);

if (kb > BUDGET_KB) {
  console.error(`\nOver budget by ${(kb - BUDGET_KB).toFixed(1)} KB.`);
  console.error('Lazy-load a route or trim a dependency.');
  process.exit(1);
}
console.log(`${(BUDGET_KB - kb).toFixed(1)} KB headroom.`);
