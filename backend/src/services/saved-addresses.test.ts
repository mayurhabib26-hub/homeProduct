/**
 * Saved addresses, and the one rule that matters: an address belongs to
 * exactly one customer and nobody else can reach it by guessing an id.
 *
 * Driven over HTTP rather than against the service, because the scoping lives
 * in the route. Testing the query directly would prove nothing about whether
 * the route applies it.
 *
 *   npm run test:saved-addresses -w backend
 */
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { createApp } from '../app.js';
import { getDb } from '../db/client.js';
import { customers, customerSessions, savedAddresses, otpCodes, otpSendLog } from '../db/schema.js';
import { requestOtp, verifyOtp } from './customer-auth.js';

const db = getDb();
const A = '9876590001';
const B = '9876590002';

for (const phone of [A, B]) {
  const [c] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  if (c) {
    await db.delete(savedAddresses).where(eq(savedAddresses.customerId, c.id));
    await db.delete(customerSessions).where(eq(customerSessions.customerId, c.id));
    await db.delete(customers).where(eq(customers.id, c.id));
  }
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
  await db.delete(otpSendLog).where(eq(otpSendLog.phone, phone));
}

/** Sign in without going near the network. */
async function signIn(phone: string): Promise<string> {
  let code = '';
  await requestOtp(phone, async (_p, c) => { code = c; return { simulated: true }; });
  const { token } = await verifyOtp(phone, code);
  return token;
}

const tokenA = await signIn(A);
const tokenB = await signIn(B);

const app = createApp();
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const port = (server.address() as { port: number }).port;

const call = (path: string, token: string, init: RequestInit = {}) =>
  fetch(`http://127.0.0.1:${port}/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: `sv_customer=${token}`, ...init.headers },
  });

type Addr = { id: number; label: string | null; city: string; isDefault: boolean };
/** res.json() is unknown; this is the one place the shape is asserted. */
const body = async (res: Response): Promise<{ data: Addr[] }> =>
  (await res.json()) as { data: Addr[] };
const one = async (res: Response): Promise<Addr> =>
  ((await res.json()) as { data: Addr }).data;

const ADDRESS = {
  name: 'Ramesh Kumar', phone: A, address: '12 Kitchen Street',
  city: 'Bengaluru', state: 'Karnataka', pincode: '560004',
};

// --- signed out gets nothing ------------------------------------------------
const anon = await fetch(`http://127.0.0.1:${port}/api/auth/addresses`);
assert.equal(anon.status, 401, 'addresses require a session');

// --- first address is the default, whatever the request says ----------------
const createdRes = await call('/auth/addresses', tokenA, {
  method: 'POST', body: JSON.stringify({ ...ADDRESS, isDefault: false }),
});
assert.equal(createdRes.status, 201);
const created = await one(createdRes);
assert.equal(created.isDefault, true, 'the first address saved must be the default');

// --- a second is not, until asked -------------------------------------------
const second = await one(await call('/auth/addresses', tokenA, {
  method: 'POST', body: JSON.stringify({ ...ADDRESS, label: 'Office', address: '9 Church Street' }),
}));
assert.equal(second.isDefault, false);

// --- exactly one default ------------------------------------------------------
await call(`/auth/addresses/${second.id}`, tokenA, {
  method: 'PATCH', body: JSON.stringify({ isDefault: true }),
});
const listA = (await body(await call('/auth/addresses', tokenA))).data;
assert.equal(listA.filter((a) => a.isDefault).length, 1,
  'promoting one default must demote the other');
assert.equal(listA[0].id, second.id, 'the default sorts first');

// --- THE ONE THAT MATTERS: B cannot touch A's address -------------------------
const listB = (await body(await call('/auth/addresses', tokenB))).data;
assert.equal(listB.length, 0, "B sees none of A's addresses");

const peek = await call(`/auth/addresses/${created.id}`, tokenB, {
  method: 'PATCH', body: JSON.stringify({ city: 'Hacked' }),
});
assert.equal(peek.status, 404, "editing another customer's address is a 404, not a 403");

const steal = await call(`/auth/addresses/${created.id}`, tokenB, { method: 'DELETE' });
assert.equal(steal.status, 404, "deleting another customer's address is a 404");

const stillThere = (await body(await call('/auth/addresses', tokenA))).data;
assert.equal(stillThere.length, 2, "and A's addresses are untouched");
assert.ok(!stillThere.some((a) => a.city === 'Hacked'));

// --- deleting the default promotes another -----------------------------------
await call(`/auth/addresses/${second.id}`, tokenA, { method: 'DELETE' });
const afterDelete = (await body(await call('/auth/addresses', tokenA))).data;
assert.equal(afterDelete.length, 1);
assert.equal(afterDelete[0].isDefault, true, 'never a list with addresses and no default');

// --- validation ----------------------------------------------------------------
const bad = await call('/auth/addresses', tokenA, {
  method: 'POST', body: JSON.stringify({ ...ADDRESS, pincode: '12' }),
});
assert.equal(bad.status, 400, 'a short pincode is refused');

server.close();
for (const phone of [A, B]) {
  const [c] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  if (c) {
    await db.delete(savedAddresses).where(eq(savedAddresses.customerId, c.id));
    await db.delete(customerSessions).where(eq(customerSessions.customerId, c.id));
  }
}
await db.delete(customers).where(inArray(customers.phone, [A, B]));
await db.delete(otpCodes).where(inArray(otpCodes.phone, [A, B]));
await db.delete(otpSendLog).where(inArray(otpSendLog.phone, [A, B]));

console.log('saved addresses: scoped to the owner, one default, cross-customer access is a 404');
process.exit(0);
