// Minimal self-check: node --experimental-strip-types shared/src/money.test.ts
// Runs on assert alone — no framework, no fixtures.
import assert from 'node:assert/strict';
import { formatPaise, rupees, percentOf } from './money.ts';

// rupees(): literal conversion
assert.equal(rupees(110), 11000);
assert.equal(rupees(110.5), 11050);
assert.equal(rupees(0.1) + rupees(0.2), rupees(0.3)); // the float bug, absent

// formatPaise(): trailing .00 dropped, Indian grouping
assert.equal(formatPaise(11000), '₹110');
assert.equal(formatPaise(11050), '₹110.50');
assert.equal(formatPaise(11005), '₹110.05');
assert.equal(formatPaise(0), '₹0');
assert.equal(formatPaise(100000000), '₹10,00,000');
assert.equal(formatPaise(-5000), '-₹50');

// percentOf(): rounds to nearest paise, symmetric about zero
assert.equal(percentOf(50000, 10), 5000);
assert.equal(percentOf(11050, 10), 1105);
assert.equal(percentOf(333, 10), 33);
assert.equal(percentOf(-50000, 10), -5000);

console.log('money.ts: all assertions passed');
