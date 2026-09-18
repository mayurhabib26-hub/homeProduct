/**
 * Fails the build if the storefront's initial JavaScript exceeds its budget.
 *
 * A bundle budget that is not enforced is a wish. docs/SCALING.md §3.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET_KB = 200;
const DIR = 'frontend/dist/assets';

const jsFiles = readdirSync(DIR).filter((f) => f.endsWith('.js'));
if (jsFiles.length === 0) {
  console.error(`No JS found in ${DIR} — did the build run?`);
  process.exit(1);
}

let total = 0;
for (const f of jsFiles) {
  const gz = gzipSync(readFileSync(join(DIR, f))).length;
  total += gz;
  console.log(`  ${f}  ${(gz / 1024).toFixed(1)} KB gz  (${(statSync(join(DIR, f)).size / 1024).toFixed(1)} KB raw)`);
}

const kb = total / 1024;
console.log(`\ntotal ${kb.toFixed(1)} KB gzipped / ${BUDGET_KB} KB budget`);

if (kb > BUDGET_KB) {
  console.error(`\nOver budget by ${(kb - BUDGET_KB).toFixed(1)} KB.`);
  console.error('Lazy-load a route (the admin bundle must never ship to customers) or trim a dependency.');
  process.exit(1);
}
console.log(`${(BUDGET_KB - kb).toFixed(1)} KB headroom.`);
