# Courier, Shipping and COD

How a packed order becomes a parcel, a parcel becomes a delivery, and cash
collected at the door becomes money in the bank.

Read [PAYMENTS.md](./PAYMENTS.md) first — the money rules there apply here
unchanged. Nothing in this document may take a price from a courier.

---

## 1. Scope and the two-provider decision

Two integrations, for different reasons:

| | Shiprocket | Delhivery direct |
|---|---|---|
| What it is | Aggregator — resells Delhivery, Bluedart, Ekart, XpressBees | One carrier, your own contract |
| Rate | Retail-ish, no commitment | Negotiated, needs volume |
| Setup | Email + password, same day | KYC, contract, account manager |
| Breadth | Picks the cheapest serviceable carrier per pincode | One network's coverage |
| When it wins | Day one, and long-tail pincodes | Once a lane is high-volume |

They are **not redundant**. Shiprocket is the default and the fallback;
Delhivery direct is switched on per-lane when volume makes the contract rate
beat the aggregator's. That is a commercial decision made in the admin, not a
code decision — which is why routing is a stored rule, not an `if`.

Until Delhivery is contracted, `COURIER_PROVIDER=shiprocket` and the Delhivery
adapter is dead code that compiles. That is deliberate: a second adapter
written against the interface *now*, while the interface is being designed,
is the only way to know the interface is not shaped like Shiprocket.

---

## 2. What is wrong with the current code

Three findings, because the design has to fix them rather than build on them.

**2.1 Every parcel ships as the same box.** `bookShipment()` hardcodes
`length: 15, breadth: 12, height: 8, weight: 0.5`. Couriers bill on
*volumetric* weight — `(L×B×H)/5000` kg — and reweigh at the hub. A six-jar
order declared at 500 g gets a discrepancy charge billed back silently, weeks
later, against a shipment you can no longer connect to an order. This is the
most expensive line in the file.

**2.2 A COD order is never marked paid.** `transitionOrder()` writes `status`
and a timestamp; it does not touch `paymentStatus`. A COD order delivered and
paid for in cash sits at `paymentStatus: 'pending'` forever. Revenue reporting
and GST reconciliation both read that column.

**2.3 `rto` restocks immediately.** `RESTOCKING` includes `'rto'`, so
`transitionOrder(x, 'rto')` hands stock back. If RTO_INITIATED is wired to
that transition, the shop restocks a jar that is in a truck three states away
and may arrive crushed. It would then be sold twice. §9 is built around not
doing this.

---

## 3. Data model

`orders.tracking_number` and `orders.courier` are two columns with no history,
no second parcel, no label, and nowhere to record that a courier paid you.
They stay, denormalised, for the customer-facing "where is it" — the truth
moves to four new tables.

### 3.1 `shipments`

One row per parcel handed to a carrier. An order with two boxes has two rows;
an order reshipped after an RTO has two rows.

```ts
export const shipments = pgTable('shipments', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  orderId: bigint('order_id', { mode: 'number' })
    .notNull().references(() => orders.id, { onDelete: 'restrict' }),

  provider: text('provider').notNull(),              // 'shiprocket' | 'delhivery'
  providerShipmentId: text('provider_shipment_id'),  // their internal id
  awb: text('awb'),                                  // null until assigned
  courierName: text('courier_name'),                 // 'Delhivery Surface'

  /** Our own lifecycle. Finer-grained than orders.status, on purpose. */
  status: text('status').notNull().default('created'),

  /** Declared at booking. Volumetric weight is derived, never stored. */
  lengthCm: integer('length_cm').notNull(),
  breadthCm: integer('breadth_cm').notNull(),
  heightCm: integer('height_cm').notNull(),
  deadWeightGrams: integer('dead_weight_grams').notNull(),

  /** What the courier says it weighed. Set from a discrepancy webhook. */
  chargedWeightGrams: integer('charged_weight_grams'),
  freightPaise: bigint('freight_paise', { mode: 'number' }),

  /** Amount the rider must collect. 0 for prepaid. Never a float. */
  codAmountPaise: bigint('cod_amount_paise', { mode: 'number' }).notNull().default(0),

  /**
   * Keep customer payment, courier cash collection and courier remittance as
   * separate concepts. For prepaid parcels these stay 'not_applicable'.
   */
  codCollectionStatus: text('cod_collection_status')
    .notNull().default('not_applicable'), // not_applicable | pending | collected | failed
  codCollectedAt: timestamp('cod_collected_at', { withTimezone: true }),
  codRemittanceStatus: text('cod_remittance_status')
    .notNull().default('not_applicable'), // not_applicable | pending | partially_remitted | remitted | disputed
  codRemittedAt: timestamp('cod_remitted_at', { withTimezone: true }),

  /**
   * Non-delivery report. The courier failed an attempt and is asking what to
   * do. Answering within hours is what keeps this from becoming an RTO.
   */
  ndrReason: text('ndr_reason'),
  ndrAttempts: integer('ndr_attempts').notNull().default(0),
  ndrLastAt: timestamp('ndr_last_at', { withTimezone: true }),

  labelUrl: text('label_url'),
  manifestUrl: text('manifest_url'),

  /** True when this parcel is the return leg of an RTO. */
  isReturnLeg: boolean('is_return_leg').notNull().default(false),

  bookedAt: timestamp('booked_at', { withTimezone: true }).notNull().defaultNow(),
  pickedUpAt: timestamp('picked_up_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  rtoInitiatedAt: timestamp('rto_initiated_at', { withTimezone: true }),
  rtoDeliveredAt: timestamp('rto_delivered_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
}, (t) => [
  // An AWB is globally unique within a provider. This is what makes webhook
  // handling idempotent at the database level rather than in a code path.
  uniqueIndex('shipments_provider_awb_idx').on(t.provider, t.awb),
  index('shipments_order_idx').on(t.orderId),
  index('shipments_status_idx').on(t.status),
  check('shipments_cod_non_negative', sql`${t.codAmountPaise} >= 0`),
]);
```

`onDelete: 'restrict'` for the same reason `invoices` uses it: a shipment is a
record of a physical event and must survive anything happening to the order.

The COD fields deliberately separate three different facts:

- `orders.paymentStatus` — whether the customer has satisfied the order's
  payment obligation.
- `shipments.codCollectionStatus` — whether the courier actually collected
  cash for this parcel.
- `shipments.codRemittanceStatus` — whether that collected cash has reached
  S V Home Products' bank account and reconciled against a courier statement.

Those are related, but they are not the same event. Keeping them separate
prevents the admin from showing "Paid" when the courier still owes the money.
The `cod_remittance_items` table remains the financial source of truth; the
shipment-level remittance fields are an operational summary for filtering and
UI.

### 3.2 `shipment_events`

Append-only. The tracking timeline the customer sees and the audit trail for
"the courier says they delivered it, prove they told us".

```ts
export const shipmentEvents = pgTable('shipment_events', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  shipmentId: bigint('shipment_id', { mode: 'number' })
    .notNull().references(() => shipments.id, { onDelete: 'cascade' }),

  /** Our normalised status. */
  status: text('status').notNull(),
  /** Exactly what the provider called it. Never parse this twice. */
  providerStatus: text('provider_status').notNull(),
  location: text('location'),
  remark: text('remark'),

  /** When it happened per the courier, vs when we heard. They differ by hours. */
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),

  webhookEventId: bigint('webhook_event_id', { mode: 'number' })
    .references(() => webhookEvents.id, { onDelete: 'set null' }),
}, (t) => [
  // Couriers replay. The same scan at the same second is the same event.
  uniqueIndex('shipment_events_dedupe_idx').on(t.shipmentId, t.providerStatus, t.occurredAt),
  index('shipment_events_shipment_idx').on(t.shipmentId, t.occurredAt),
]);
```

### 3.3 `cod_remittances` and `cod_remittance_items`

The courier collects cash on your behalf and pays it over, weekly, in a lump
sum, minus a per-order COD fee, against a statement. **This is where a small
D2C business quietly loses money** — nobody checks that the lump sum matches
the orders it claims to cover.

```ts
export const codRemittances = pgTable('cod_remittances', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  provider: text('provider').notNull(),
  /** Bank UTR of the transfer. Unique per provider — the natural key. */
  utr: text('utr').notNull(),
  grossPaise: bigint('gross_paise', { mode: 'number' }).notNull(),
  feePaise: bigint('fee_paise', { mode: 'number' }).notNull().default(0),
  netPaise: bigint('net_paise', { mode: 'number' }).notNull(),
  remittedAt: timestamp('remitted_at', { withTimezone: true }).notNull(),
  statementRef: text('statement_ref'),
  importedBy: bigint('imported_by', { mode: 'number' }).references(() => adminUsers.id),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('cod_remittances_provider_utr_idx').on(t.provider, t.utr)]);

export const codRemittanceItems = pgTable('cod_remittance_items', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  remittanceId: bigint('remittance_id', { mode: 'number' })
    .notNull().references(() => codRemittances.id, { onDelete: 'cascade' }),
  shipmentId: bigint('shipment_id', { mode: 'number' })
    .references(() => shipments.id, { onDelete: 'restrict' }),
  /** Kept even when the AWB matches nothing we booked — that IS the finding. */
  awb: text('awb').notNull(),
  amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(),
  feePaise: bigint('fee_paise', { mode: 'number' }).notNull().default(0),
}, (t) => [
  uniqueIndex('cod_remittance_items_idx').on(t.remittanceId, t.awb),
  index('cod_remittance_items_shipment_idx').on(t.shipmentId),
]);
```

### 3.4 `courier_routing_rules`

Which provider gets a shipment. Stored, because it changes on a phone call
with an account manager, not in a deploy.

```ts
export const courierRoutingRules = pgTable('courier_routing_rules', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  /** Lower runs first. */
  priority: integer('priority').notNull().default(100),
  /** null = any. '560%' matches a pincode prefix. */
  pincodePattern: text('pincode_pattern'),
  state: text('state'),
  paymentMethod: text('payment_method'),
  maxWeightGrams: integer('max_weight_grams'),
  provider: text('provider').notNull(),
  active: boolean('active').notNull().default(true),
}, (t) => [index('courier_routing_active_idx').on(t.active, t.priority)]);
```

No rules matching = the `COURIER_PROVIDER` default. An empty table is a valid,
working configuration.

### 3.5 Change to `variants`

Fixes §2.1. Per-variant shipping weight, because a 100 g packet and a 500 g
packet are not the same parcel.

```ts
/** Packed weight of one unit, including jar and label. Grams, integer. */
shippingWeightGrams: integer('shipping_weight_grams').notNull().default(0),
```

`0` means unmeasured. Booking falls back to the old 500 g default **and logs a
warning naming the SKU**, so the gap is visible rather than silent. The admin
inventory screen shows an "unweighed" badge until it is set.

---

## 4. Provider abstraction

```ts
// backend/src/lib/courier/types.ts
export interface CourierProvider {
  readonly name: 'shiprocket' | 'delhivery';
  readonly configured: boolean;

  checkServiceability(input: ServiceabilityQuery): Promise<Serviceability>;
  book(input: BookingInput): Promise<BookingResult>;
  fetchLabel(awb: string): Promise<Buffer>;
  cancel(awb: string): Promise<void>;
  schedulePickup(awbs: string[], date: Date): Promise<PickupResult>;

  /** Answer a non-delivery report: reattempt, or reattempt to a new address. */
  respondToNdr(awb: string, action: NdrAction): Promise<void>;

  /** Provider status string -> our normalised status. Unknown returns null. */
  mapStatus(providerStatus: string): ShipmentStatus | null;

  /** Constant-time check of an inbound webhook. */
  verifyWebhook(req: WebhookRequest): boolean;
  parseWebhook(body: unknown): ParsedCourierEvent[];
}
```

Files:

```
backend/src/lib/courier/
  types.ts        interface + shared types
  shiprocket.ts   adapter (the existing lib/shiprocket.ts, moved)
  delhivery.ts    adapter
  index.ts        registry + pickProvider()
```

`pickProvider(order)` reads `courier_routing_rules`, first match by priority,
falls back to `env.COURIER_PROVIDER`. If the picked provider is unconfigured it
falls back to any configured one; if none is configured, booking is skipped
with a warning and the order waits for manual dispatch — **the existing
degrade-open behaviour, preserved.** An unconfigured courier must never stop
the shop taking orders.

### 4.1 Parcel sizing

One function, used by both adapters, so a dimension is never invented at a
call site:

```ts
// backend/src/services/parcel.ts
const BOXES = [
  { name: 'S', l: 15, b: 12, h: 8,  capacityGrams: 600 },
  { name: 'M', l: 22, b: 18, h: 12, capacityGrams: 2000 },
  { name: 'L', l: 30, b: 24, h: 18, capacityGrams: 5000 },
] as const;

const PACKAGING_GRAMS = 80;   // box, filler, tape

export function sizeParcel(items: { shippingWeightGrams: number; quantity: number }[]) {
  const dead = items.reduce((g, i) => g + i.shippingWeightGrams * i.quantity, 0) + PACKAGING_GRAMS;
  const box = BOXES.find((b) => dead <= b.capacityGrams) ?? BOXES.at(-1)!;
  const volumetric = Math.ceil((box.l * box.b * box.h) / 5000 * 1000);
  return { box, deadWeightGrams: dead, volumetricGrams: volumetric,
           chargeableGrams: Math.max(dead, volumetric) };
}
```

A single box up to 5 kg. Above that, split — but a spice-powder order that
heavy is rare enough that the first version logs it for a human rather than
implementing multi-parcel splitting nobody will exercise.

---

## 5. Booking flow

Unchanged in shape: booking still happens on the `fulfilment` queue, off the
request path, triggered by the `packed` transition.

```
admin marks order packed
  └─ transitionOrder(order, 'packed')
       └─ enqueue('fulfilment', { type: 'shipment.book' }, dedupeKey: book:<order>)

worker claims shipment.book
  ├─ already has a live shipment?  -> return          (idempotent)
  ├─ pickProvider(order)           -> shiprocket | delhivery
  ├─ sizeParcel(items)             -> box + chargeable weight
  ├─ INSERT shipments (status 'created')               <- BEFORE the API call
  ├─ provider.book(...)            -> shipmentId, awb, courier
  ├─ UPDATE shipments SET awb, courier, status 'awb_assigned'
  ├─ UPDATE orders SET tracking_number, courier         (denormalised copy)
  ├─ enqueue documents: label.fetch
  └─ enqueue notifications: shipment.booked   (tracking is available; order is still packed)
```

`shipment.booked` is a **new** notification handler — `handlers.ts` currently
has `order.confirmation` and `order.shipped` only, and it needs its own
template. The existing `order.shipped` enqueue at `handlers.ts:121` must be
**deleted** in the same change: left in place it fires the moment an AWB
exists, and this section changes nothing.

An AWB is **not** proof that the courier has the parcel. `orders.status` stays
`packed` through `awb_assigned` and `pickup_scheduled`; it moves to `shipped`
only on the first real pickup scan (`picked_up`). The customer may receive the
tracking link as soon as an AWB exists, but the wording must say "shipment
booked" or "tracking created", not "shipped".

**The `shipments` row is written before the provider call, not after.** If the
API call times out after the carrier created the shipment, a retry that
inserted afterwards would book a second pickup for the same parcel. Inserting
first, with `(provider, awb)` unique, means the retry finds the row in
`created` and reconciles by AWB lookup instead of rebooking. This is the same
argument as the `orders.idempotency_key` unique index.

Booking failures retry on the queue's existing backoff, five attempts. A
permanently failed booking leaves the shipment in `created` and surfaces in the
admin as **"Booking failed — dispatch by hand"**. The order is still a valid,
paid order; it just needs a person.

---

## 6. Webhook flow

### 6.1 The security difference from Razorpay — read this before writing code

Hard rule 4 says payment webhooks verify against the raw body with a
constant-time comparison. **Courier webhooks cannot meet that bar, because
neither provider signs the body.** Shiprocket authenticates with a static
token in `x-api-key`; Delhivery authenticates by you registering a URL that
contains a secret path segment, or by a static bearer token.

So:

- Verify the shared secret with `crypto.timingSafeEqual`, on padded buffers so
  length does not leak.
- **Mount these on `express.json()`, not `express.raw()`.** There is no HMAC
  over the bytes, so preserving them proves nothing, and raw-body handling
  here would be cargo-culted ritual that implies a guarantee we do not have.
- Treat the payload as a **hint about a parcel we already know**, never as an
  instruction. Every handler starts by looking the AWB up in `shipments`. An
  AWB we never booked is logged and dropped with a 200 — it is either noise or
  someone probing.
- **No money moves on a courier webhook.** COD remittance is imported from a
  signed statement by an authenticated admin (§8.3), never accepted from an
  inbound POST, precisely because a static bearer token is not strong enough
  to authorise a credit.
- Rate-limit the endpoint, and alert on a burst of RTO or delivered events for
  AWBs we do not recognise.

### 6.2 The flow

```
POST /api/webhooks/:provider        (json, secret in header, rate-limited)
  ├─ provider.verifyWebhook(req)        fail -> 401, log, no body echo
  ├─ provider.parseWebhook(body)        -> ParsedCourierEvent[]
  └─ for each event:
       ├─ synthesise eventId: `${awb}:${providerStatus}:${occurredAtISO}`
       ├─ recordWebhookEvent(provider, eventId, type, payload)
       │    not new -> skip this event, keep going
       ├─ look up shipment by (provider, awb)
       │    not found -> log { awb }, continue
       ├─ INSERT shipment_events  ON CONFLICT DO NOTHING
       ├─ provider.mapStatus(providerStatus)
       │    null -> event is stored, nothing else happens
       └─ applyShipmentStatus(shipment, status, occurredAt)
  └─ markWebhookProcessed(); 200 always, once verified
```

Shiprocket sends no event id, hence the synthesised one. The
`(shipment_id, provider_status, occurred_at)` unique index is the second line
of defence, so a replay with a different envelope still cannot double-apply.

**Always 200 after verification.** A 500 makes the courier retry the same
event for days; the event is durably stored in `webhook_events` with its error
and is replayable from the admin. Identical to the Razorpay handler.

### 6.3 Out-of-order and late events

Courier scans arrive out of order routinely. Two guards:

1. `applyShipmentStatus` ignores an event whose `occurredAt` is older than the
   shipment's current status timestamp.
2. `transitionOrder` already rejects illegal transitions with a 409. The
   handler **catches `ILLEGAL_TRANSITION` and logs it at info, not error** — a
   late "in transit" after "delivered" is the courier being a courier, not a
   bug. Any other error propagates and the job retries.

### 6.4 Polling, because webhooks are not reliable

A reconciliation job on the `fulfilment` queue, every 30 minutes: for every
shipment not in a terminal state and older than 2 hours, pull the provider's
tracking API and apply anything missing through the same
`applyShipmentStatus`. Webhooks make the timeline fast; polling makes it
correct. Neither is trusted alone.

---

## 7. Status mapping

Our normalised `ShipmentStatus`:

```
created → awb_assigned → pickup_scheduled → picked_up → in_transit
        → out_for_delivery → delivered
              ↑            ↘ ndr ──(answered, reattempt)──┘
              └──────────────┘   ↘ (unanswered, or attempts exhausted)
                                   rto_initiated → rto_in_transit → rto_delivered
        → cancelled | lost | damaged
```

Deliberately **finer than `orders.status`**. The order-level machine stays
coarse (`packed → shipped → delivered | rto`); the granular scans live on the
shipment. Adding `out_for_delivery` to the order state machine would mean
touching stock-restoration logic to add a status that never moves stock.

| Shiprocket | Delhivery | Ours | `orders.status` |
|---|---|---|---|
| `AWB_ASSIGNED` | `Manifested` | `awb_assigned` | — |
| `PICKUP_SCHEDULED` | `Pickup Scheduled` | `pickup_scheduled` | — |
| `PICKED_UP` | `In Transit` (first scan) | `picked_up` | → `shipped` |
| `IN_TRANSIT` | `In Transit` | `in_transit` | — |
| `OUT_FOR_DELIVERY` | `Dispatched` | `out_for_delivery` | — |
| `UNDELIVERED` | `Undelivered` / `Pending` | `ndr` | — (see §9.0) |
| `DELIVERED` | `Delivered` | `delivered` | → `delivered` |
| `RTO_INITIATED` | `RTO` | `rto_initiated` | — (see §9) |
| `RTO_IN_TRANSIT` | `RTO In Transit` | `rto_in_transit` | — |
| `RTO_DELIVERED` | `RTO Delivered` | `rto_delivered` | → `rto` |
| `CANCELLED` | `Cancelled` | `cancelled` | — |
| `LOST` / `DAMAGED` | `Lost` | `lost` / `damaged` | — (manual) |

Anything not in the table maps to `null`: the event is stored, the timeline
shows it, nothing transitions. **Silence beats a guess** — a mis-mapped status
that restocks is worse than a status we did not understand.

`ndr` is not terminal and does not move the order: the parcel is still out
with the courier and a reattempt is normal. It is the one status with a clock
on it — see §9.0.

`lost` and `damaged` deliberately do not auto-transition. They mean a claim
has to be filed and someone decides whether to reship or refund. The admin
shows them as a red banner on the order.

---

## 8. COD

### 8.1 At checkout

`checkServiceability()` already returns `codAvailable`. Two additions:

- COD is offered only when `codAvailable && !assumed`. An *assumed* yes is
  fine for "we deliver here" but not for "you may pay cash", where being wrong
  means a cancelled order after packing.
- `COD_MAX_ORDER_PAISE` already caps order value (`orders.ts:157`). Keep it.

### 8.2 The cash — collection is not remittance

`shipments.cod_amount_paise` is the order total in paise, converted to rupees
**only in the adapter's request body**, next to the existing `selling_price`
conversion. It is the single number the rider collects; a mismatch between it
and the invoice is a dispute you will lose.

Three states must not be conflated. They are **three independent lifecycles**,
not three columns of one table — nothing lines up row-wise, and a matrix here
would invite a mapping that does not exist:

- `orders.paymentStatus` — has the customer satisfied the order?
  `pending → paid → refunded`
- `shipments.codCollectionStatus` — did the rider actually take the cash?
  `not_applicable | pending → collected | failed`
- `shipments.codRemittanceStatus` — has that cash reached our bank and
  reconciled? `not_applicable | pending → partially_remitted | remitted | disputed`

For prepaid orders, the two COD shipment fields are `not_applicable`. For COD,
booking sets both operational fields to `pending`.

On a provider `delivered` event for a COD parcel, in one transaction:

```ts
await tx.update(shipments)
  .set({
    codCollectionStatus: 'collected',
    codCollectedAt: occurredAt,
    codRemittanceStatus: 'pending',
  })
  .where(eq(shipments.id, shipment.id));

// The order becomes paid only when the COD amount due across its parcels has
// been collected. In v1 there is normally one parcel, but this remains correct
// if the data model later uses more than one.
const collectedPaise = await collectedCodForOrder(tx, order.id);
if (collectedPaise >= order.totalPaise) {
  await tx.update(orders)
    .set({ paymentStatus: 'paid', paidAt: occurredAt })
    .where(and(eq(orders.id, order.id), eq(orders.paymentMethod, 'cod')));
}
```

`paidAt` is the courier's collection scan time, not the time the money reached
our bank. Bank settlement is represented separately by
`codRemittanceStatus` and the remittance tables in §8.3. This keeps revenue /
GST logic based on the customer's payment while still making "courier owes us
₹X" visible and reconcilable.

### 8.3 Remittance and reconciliation

Weekly, the courier transfers a lump sum and publishes a statement listing
which AWBs it covers. The admin uploads that CSV.

```
POST /api/admin/cod-remittances/import   (multipart, owner-only)
  ├─ parse: awb, amount, fee, utr, remitted_at
  ├─ INSERT cod_remittances (provider, utr)  ON CONFLICT DO NOTHING
  │    conflict -> "this statement is already imported", 200, no duplicate credit
  ├─ INSERT cod_remittance_items, resolving awb -> shipment_id
  └─ return the reconciliation report
```

The report is the point. Four findings, and each one is money:

| Finding | Meaning |
|---|---|
| **Short-paid** | `amount_paise < shipments.cod_amount_paise`. Rider collected less than the invoice, or the courier deducted something unagreed. |
| **Unknown AWB** | On their statement, not in `shipments`. Their error, or another seller's parcel. |
| **Delivered, never remitted** | `delivered_at` older than the remittance cycle + grace, no `cod_remittance_item`. **The one that matters.** Cash collected and not passed on. |
| **Remitted, not delivered** | Paid for a parcel our records say is in transit. Usually a missed webhook; read as a signal the timeline is stale. |

`shipment_id` uses `onDelete: 'restrict'`: a financial record may not be
orphaned by a cleanup.

After import, recompute the operational summary on each matched shipment:

- exact expected amount matched → `codRemittanceStatus = 'remitted'` and set
  `codRemittedAt`;
- some money matched but less than expected → `partially_remitted`;
- a short-pay or other unresolved mismatch → `disputed`;
- delivered COD with no matching statement item after the grace period stays
  `pending` and appears in **Delivered, never remitted**.

Do not use a courier webhook to set any remittance status. The remittance CSV
and its bank UTR are the financial evidence.

### 8.4 COD and GST

Nothing changes. The invoice is issued at dispatch on the accrual basis, not
when the cash arrives. Remittance reconciles the *bank*, not the tax position.

---

## 9. RTO

Return To Origin — refused at the door, address wrong, three failed attempts.
For COD it is the single biggest loss: no revenue, freight paid both ways.

### 9.0 NDR — the stage before RTO, and the only one you can still win

A non-delivery report is the courier saying *"we tried, it failed, what now?"*
Nobody home, phone unreachable, address incomplete, customer asked for a later
date. It is **not** an RTO yet. Both providers give you a window — typically
24 to 48 hours, and usually two or three attempts — to answer with a reattempt
or a corrected address. Answer inside the window and most NDRs deliver.
Ignore it and it becomes the RTO in §9.1, which costs two-way freight and, for
COD, the entire sale.

This is the highest-leverage clock in the whole integration, and it is the
reason §9.4's RTO rate is a lagging indicator: by the time RTO rate moves, the
NDRs that caused it went unanswered days earlier.

```
provider UNDELIVERED event
  ├─ shipments.status = 'ndr'
  ├─ ndr_reason, ndr_last_at, ndr_attempts += 1
  ├─ orders.status unchanged — the parcel is still out
  └─ notify the operator immediately; this is not a daily-digest event

operator answers (or the customer does, via a call)
  └─ provider.respondToNdr(awb, { action: 'reattempt' | 'reattempt_new_address', ... })
       └─ next scan returns the shipment to out_for_delivery
```

An NDR older than `NDR_RESPONSE_HOURS` with no response is **escalated, not
auto-answered**. A blind auto-reattempt to an address that was wrong the first
time just buys a second failed attempt and burns one of the three.

Reattempting to a new address is a customer-contact job, not an API call in
isolation: the phone call happens first, the address correction is recorded
against the order, and only then is the provider told. The admin records who
made the call, because "we tried to reach you" is the thing a customer will
dispute.

### 9.1 Two stages, and why the split is the whole design

```
RTO_INITIATED   the parcel turned around.   Days from home.  NOTHING RESTOCKS.
RTO_DELIVERED   the parcel is on the bench. Opened, checked. Restock decided.
```

Fixes §2.3. `RTO_INITIATED` writes a `shipment_event` and
`shipments.rto_initiated_at`, and **does not transition the order**. The admin
shows "Returning" from the shipment status. `orders.status` becomes `rto` only
on `RTO_DELIVERED`, which is when `RESTOCKING` correctly hands stock back
through the one function that mutates `stock_qty`.

Restocking at `RTO_INITIATED` would put a jar back on the shelf while it is
in a truck — sellable, and possibly arriving crushed. It would be sold twice.

### 9.2 Restock is a decision, not an automatic

`RTO_DELIVERED` transitions to `rto` with `restock: false` and raises an admin
task: **"Parcel returned — inspect and restock"**. The operator opens the box
and chooses per line: back on the shelf, or write off. `transitionOrder`
already takes `restock`; the same damaged-goods argument as a customer return,
which the code already makes.

A default of "restock automatically" would have the food-safety failure mode
where a packet that spent two weeks in a van goes back into stock unopened.

### 9.3 Refund on RTO

| Payment | On `rto_delivered` |
|---|---|
| Prepaid | Refund is **owed**. Raise the task; `refundOrder()` handles it, owner-only, with the existing typed confirmation. Do not auto-refund — freight may be deductible per your own published policy. |
| COD | **No refund. No money was ever taken.** Terminal at `rto`. The loss is two-way freight, recorded against the shipment. Set `codCollectionStatus = 'failed'` — this is the only thing that sets it, and without it a never-collected parcel sits in "delivered, never remitted" forever, chasing a courier for money they correctly never owed. |

The existing machine allows `rto → refunded`, which stays correct for prepaid
and simply is not exercised for COD.

### 9.4 Watching the RTO rate

RTO rate by pincode is the highest-value number in the whole integration.
Above a threshold for a pincode, the fix is to stop offering COD there — which
is a `courier_routing_rules` row and a serviceability override, not code.
Surfaced in the admin as a report; not automated, because auto-blocking a
pincode on thin data loses real customers.

---

## 10. Label printing

### 10.1 Fetch and store, never hotlink

Provider label URLs expire — Shiprocket's in hours. A label URL stored in the
database and opened a week later during a courier dispute is a 404.

`label.fetch` on the `documents` queue, after AWB assignment: pull the PDF,
store it through the existing `storeDocument()` (R2 in production, disk in
development — the same path invoices already use), write
`shipments.label_url`. Retries on the standard backoff.

### 10.2 Format

4×6 inches at 203 dpi — the thermal-printer standard both providers emit
natively. **Do not re-render.** The barcode is the one thing in this system
that must scan on a warehouse belt, and a regenerated barcode is a parcel that
gets hand-sorted or lost. The provider's PDF passes through byte for byte.

### 10.3 Bulk printing

The actual daily workflow: pack twelve orders, print twelve labels, hand the
courier one manifest.

```
POST /api/admin/shipments/labels     { awbs: string[] }   -> merged PDF
```

`pdf-lib` merges the stored per-shipment PDFs in the order given, one label
per page. Missing labels are **listed in the response, not silently skipped** —
a short print run that looks complete means a parcel ships with the wrong
label on it.

`pdfkit` is already a dependency but composes documents rather than merging
existing ones; `pdf-lib` is the small addition that does. Rendering the
barcode ourselves to avoid the dependency is exactly the re-render §10.2
forbids.

### 10.4 Manifest

The handover sheet the driver signs — proof of what you gave them, which is
what settles a lost-parcel claim. Provider-generated, stored the same way, one
per pickup rather than per shipment.

---

## 11. Admin UI

Built on the primitives in `admin/src/components/ui/`. No new visual
direction; this is work inside an established system.

### 11.1 Nav

One new item: **Shipments**, directly after Orders, because it is the next
step in the daily loop.

```
Dashboard  Orders  Shipments  Products  Inventory  Reviews  Coupons
```

That is the existing `NAV` in `Shell.tsx` with one entry inserted. It has a
backend, which is the bar set when Customers, Reports and Settings were left
out of `14b5a51` — a nav item that leads nowhere teaches the operator to
distrust the nav.

**COD reconciliation** and **courier routing** are owner-only routes reached
from the Shipments screen, not new top-level groups. Two parent groups holding
one child each is scaffolding for a hierarchy that does not exist yet; when
there is a third finance screen, `Finance` earns its group and these move under
it.

### 11.2 Orders list

- `packed` becomes a first-class filter tab — it is the "ready to ship" queue.
- Multi-select with a checkbox column → **Book shipments** and **Print labels**
  in a bulk action bar. Bulk is the real workflow; one-at-a-time is the
  exception.
- A shipment column showing courier + AWB, with the AWB monospace and
  copyable. `tabular` for anything numeric, as everywhere else.

### 11.3 Order detail

Replaces the current tracking-number line with a **shipment card**:

- Courier, AWB, chargeable weight, freight
- Vertical timeline from `shipment_events` — status, location, time, newest
  first. Same visual language as the existing audit-trail timeline.
- **Print label** (single), **Track** (deep link), **Cancel shipment**
- COD orders show the two operational money states separately:
  **"₹X to collect" → "₹X collected by courier · remittance pending" →
  "₹X remitted · UTR ..."**. Never collapse collection and remittance into a
  single `Paid` badge.
- An open NDR shows a banner above everything else: reason, attempts used,
  hours left, **Call customer** (`tel:`) and **Answer NDR**. It outranks the
  timeline, because it is the only thing on the screen with a deadline.
- RTO shows a warning band with the two stages, and the **Inspect and
  restock** action when the parcel is back

### 11.4 Shipments screen

Filter tabs, ordered by how fast they go cold: **NDR · Booking failed · Ready
to ship · To pick up · In transit · Out for delivery · RTO · Delivered**.

Opens on the first tab with a non-zero count, so the screen lands on the work
that needs a person rather than on historical delivery totals. **NDR leads**
because it is the only tab with a deadline measured in hours (§9.0); a booking
failure waits patiently, an unanswered NDR becomes an RTO.

An NDR row shows the reason, attempts used, hours left in the window, and the
customer's phone as a `tel:` link — the answer to most NDRs is a phone call,
and on a mobile that call should be one tap from the row.

Bulk select → **Book shipments**, **Print labels**, **Schedule pickup**,
**Retry booking**. The normal day is a batch: pack several orders, book them,
print their labels in one run, then hand over one manifest.

On mobile, keep the same sequence but collapse each shipment to a tappable row
showing order, courier/AWB, current status and the single legal next action.

### 11.5 COD reconciliation

Owner-only. Upload the statement, then the four findings from §8.3 as counted
tabs, **Delivered, never remitted** first and in `--color-danger` — the tab
order encodes which one costs money.

Summary tiles show **COD collected**, **remittance pending**, **remitted this
cycle**, and **disputed**. These are deliberately separate from
`orders.paymentStatus`.

Per row: order number, AWB, expected, remitted, difference, collection date,
delivery date, remittance status. CSV export, because chasing a courier
happens over email with a spreadsheet attached.

### 11.6 Inventory

An **unweighed** badge on any variant with `shipping_weight_grams = 0`, and an
inline gram field beside the existing inline stock editor — same
`idle/saving/saved/error` pattern, same `aria-live`. Until it is filled in,
every parcel is guessed at 500 g and §2.1 keeps costing money.

### 11.7 States and access

Every screen gets the four states already standard here: skeleton, empty,
error with retry, success. Empty states say what to do — *"No shipments yet.
Orders appear here once they are packed."*

Owner-only: COD reconciliation, routing rules, shipment cancellation. Staff
see them disabled with a reason, the pattern the refund button already uses —
never hidden, so staff learn the action exists and who to ask.

Tap targets stay at the 44px floor. The AWB copy button and the timeline
disclosure are the two that will fail an audit if written carelessly.

---

## 12. API reference

### Storefront

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/serviceability/:pincode` | `{ serviceable, codAvailable, estimatedDays, assumed }`. Cacheable 1h. Never quotes a price. |
| `GET` | `/api/orders/:orderNumber/tracking` | Public timeline. Same auth as the existing order lookup. Returns normalised statuses and coarse locations only — never the rider's name or phone. |

### Admin

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/api/admin/shipments` | staff | Filter by status, provider, date |
| `GET` | `/api/admin/shipments/:awb` | staff | With full event timeline |
| `POST` | `/api/admin/orders/:orderNumber/shipment` | staff | Manual book / retry. Idempotent on a live shipment |
| `POST` | `/api/admin/shipments/:awb/cancel` | owner | Only before pickup |
| `GET` | `/api/admin/shipments/:awb/label` | staff | 302 to stored PDF |
| `POST` | `/api/admin/shipments/labels` | staff | `{ awbs }` → merged PDF |
| `POST` | `/api/admin/pickups` | staff | `{ awbs, date }` → manifest |
| `POST` | `/api/admin/shipments/:awb/ndr` | staff | Answer an NDR: reattempt, or reattempt to a corrected address |
| `POST` | `/api/admin/shipments/:awb/restock` | owner | Post-RTO inspection decision, per line |
| `POST` | `/api/admin/cod-remittances/import` | owner | multipart CSV |
| `GET` | `/api/admin/cod-remittances/reconcile` | owner | The four findings + collection/remittance summary |
| `GET` | `/api/admin/reports/rto` | owner | RTO rate by pincode |
| `GET`/`POST` | `/api/admin/courier-rules` | owner | Routing rules |

Every mutating endpoint writes `audit_log`, as the existing admin routes do.

### Webhooks

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/webhooks/shiprocket` | `x-api-key`, constant-time |
| `POST` | `/api/webhooks/delhivery` | bearer token, constant-time |

### Environment

```
COURIER_PROVIDER=shiprocket
SHIPROCKET_EMAIL=            # existing
SHIPROCKET_PASSWORD=         # existing
SHIPROCKET_WEBHOOK_TOKEN=    # new
DELHIVERY_API_TOKEN=
DELHIVERY_CLIENT_NAME=
DELHIVERY_WEBHOOK_TOKEN=
PICKUP_PINCODE=560004        # existing
PICKUP_LOCATION_NAME=Primary
COD_REMITTANCE_GRACE_DAYS=10
NDR_RESPONSE_HOURS=24
```

None of these is `VITE_`-prefixed. The storefront learns serviceability from
our API, never from a courier directly — a courier token in a browser bundle
is a token published to the internet.

---

## 13. Failure modes

| What happens | What the system does |
|---|---|
| Courier API down at booking | Job retries 5× with backoff; shipment stays `created`; admin shows **Booking failed**. Order unaffected. |
| Courier never sends a webhook | The 30-minute reconciliation poll (§6.4) catches it. |
| Webhook arrives for an unknown AWB | Logged with the AWB, dropped, 200. Alert on a burst. |
| Duplicate webhook | `webhook_events` unique + `shipment_events` unique. Two independent guards. |
| Out-of-order scans | Older-than-current events ignored; `ILLEGAL_TRANSITION` caught and logged at info. |
| Booking succeeds, our write fails | Shipment row exists in `created` from before the call; the retry reconciles by AWB instead of rebooking. |
| Weight under-declared | Discrepancy webhook writes `charged_weight_grams`; admin reports the gap by SKU, which is the signal to fix §3.5. |
| Delivery attempt fails | Shipment goes to `ndr`, operator notified immediately, NDR tab leads the Shipments screen. Not auto-answered. |
| NDR window expires unanswered | Escalated to the owner. The parcel will RTO; §9.4's pincode report is where the pattern shows up. |
| COD collected, never remitted | The reconciliation report's first tab. |
| COD parcel RTO'd | `codCollectionStatus = 'failed'`, so it never enters the remittance chase. |
| Provider label URL expired | Never used — labels are fetched and stored at assignment. |
| Both providers unconfigured | Orders are still taken. Serviceability answers optimistically with `assumed: true`. Dispatch is manual. |

---

## 14. Build order

Each step ships and is useful alone.

1. **Schema** — four tables, `variants.shipping_weight_grams`, one migration.
2. **Provider interface** — move `lib/shiprocket.ts` into `lib/courier/`
   behind `CourierProvider`. No behaviour change, tests still pass.
3. **Parcel sizing** — `sizeParcel()` + admin weight entry. *Stops the money
   leak in §2.1.* Ship this early.
4. **Shipments table in the booking path** — write rows, keep the
   denormalised order columns.
5. **Webhooks + status mapping + the poller** — the timeline starts working.
6. **COD delivered → paid** — fixes §2.2, three lines and a test.
7. **RTO two-stage** — fixes §2.3.
8. **NDR** — status, notification, the answer endpoint. Ships with or right
   after the webhooks, because it is the step that prevents the RTOs step 7
   handles.
9. **Labels** — fetch, store, bulk merge. The biggest daily time saving.
10. **Admin UI** — shipments screen, order detail card, bulk actions.
11. **COD reconciliation** — import and the four findings.
12. **Delhivery adapter** — when the contract exists.

Steps 3, 6 and 7 are bug fixes wearing a feature's clothes. They are worth
doing even if the rest is deferred.

---

## 15. Testing

Follows [TESTING.md](./TESTING.md). The ones that matter:

- **Idempotency** — the same webhook event twice produces one
  `shipment_event` and one transition.
- **Out-of-order** — `delivered` then `in_transit` leaves the order
  `delivered`.
- **RTO does not restock early** — `rto_initiated` moves no stock;
  `rto_delivered` with `restock: true` moves it exactly once.
- **COD delivered records collection before payment** — the shipment becomes
  `codCollectionStatus = 'collected'`; the order becomes `paymentStatus =
  'paid'` only when the COD amount due across its parcels is collected. A
  prepaid delivery touches neither COD field.
- **COD collection is not remittance** — a delivered COD parcel stays
  `codRemittanceStatus = 'pending'` until a statement item with a valid UTR is
  imported; short payment becomes `partially_remitted` or `disputed`, never
  silently `remitted`.
- **NDR does not become RTO by itself** — an `ndr` event leaves the order
  `shipped` and moves no stock; an expired window escalates rather than
  auto-answering; a reattempt returns the shipment to `out_for_delivery`.
- **COD RTO marks collection failed** — and the parcel never appears in
  "delivered, never remitted".
- **Parcel sizing** — known basket → known box and chargeable weight;
  volumetric beats dead weight for a light bulky order.
- **Reconciliation** — a statement with one short-paid, one unknown AWB and
  one missing order produces exactly those three findings.
- **Webhook auth** — a wrong token is rejected; a valid token for an unknown
  AWB is accepted and dropped.
- **Unconfigured** — with no provider credentials, an order can still be
  placed, packed and manually dispatched end to end.

Same caveat as everywhere else in this codebase: **none of this proves the
live API works.** The request shapes in both adapters are written from
documentation and have never been sent to a real endpoint. Like Razorpay, that
stays true until there are credentials.
