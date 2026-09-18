/**
 * Fails the build if the storefront's FIRST LOAD exceeds its budget.
 *
 * Measures what a customer actually downloads to see the shop: the entry
 * chunk and anything it eagerly pulls in. Lazy chunks are reported but not
 * counted, because a customer never fetches the admin panel — counting it
 * would make the budget lie in both directions, hiding storefront growth
 * behind admin work and vice versa.
 *
 * A bundle budget that is not enforced is a wish. docs/SCALING.md §3.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET_KB = 200;
const DIR = 'frontend/dist/assets';

/**
 * Chunks reached only through React.lazy — not part of first load.
 *
 * The admin is no longer among them: it is a separate build on its own
 * subdomain, so none of its code is in this directory at all.
 */
const LAZY = /^(useMutation)/;

const files = readdirSync(DIR).filter((f) => f.endsWith('.js'));
if (files.length === 0) {
  console.error(`No JS found in ${DIR} — did the build run?`);
  process.exit(1);
}

const gz = (f) => gzipSync(readFileSync(join(DIR, f))).length;

const eager = files.filter((f) => !LAZY.test(f));
const lazy = files.filter((f) => LAZY.test(f));

let total = 0;
console.log('First load:');
for (const f of eager.sort((a, b) => gz(b) - gz(a))) {
  const size = gz(f);
  total += size;
  console.log(`  ${(size / 1024).toFixed(1).padStart(7)} KB  ${f}`);
}

if (lazy.length) {
  const lazyTotal = lazy.reduce((s, f) => s + gz(f), 0);
  console.log(`\nLazy (not counted): ${(lazyTotal / 1024).toFixed(1)} KB across ${lazy.length} chunks`);
  for (const f of lazy.sort((a, b) => gz(b) - gz(a))) {
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
