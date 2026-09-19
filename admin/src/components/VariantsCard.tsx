/**
 * Packs and prices for one product.
 *
 * A product with no variants cannot be bought — there is nothing to add to a
 * cart — so this is not an optional extra on the editor.
 *
 * Three things the server decides and this only reflects:
 *
 *   - Repricing is owner-only; restocking is not. A staff member counting
 *     jars should not need the account that can move money.
 *   - There is no delete. A variant that has ever been ordered must survive
 *     or its order_items snapshots stop reconciling, so retiring one sets
 *     active:false and it simply stops being sellable.
 *   - Weight is unique per product. Adding "250g" twice is a 409, surfaced on
 *     the field rather than as a toast.
 *
 * Money is entered in rupees and converted once, here, with rupees() from
 * shared. Everything downstream is integer paise (hard rule 2).
 */
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatPaise, rupees } from '@sv/shared';
import { adminApi, AdminApiError, type AdminVariant } from '../api/client';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import { SectionTitle } from './ui/Layout';
import { useToast } from './ui/Toast';
import { cn } from '../lib/cn';

/** "110" / "110.50" -> paise. Empty or junk returns null so callers can refuse. */
function toPaise(input: string): number | null {
  const n = Number.parseFloat(input.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return rupees(n);
}

const paiseToInput = (p: number | null) => (p === null ? '' : (p / 100).toString());

const VariantRow: React.FC<{ v: AdminVariant; slug: string; isOwner: boolean }> = ({ v, slug, isOwner }) => {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [price, setPrice] = useState(paiseToInput(v.pricePaise));
  const [mrp, setMrp] = useState(paiseToInput(v.mrpPaise));
  const [stock, setStock] = useState(String(v.stockQty));
  const [error, setError] = useState<string | null>(null);

  const dirty =
    price !== paiseToInput(v.pricePaise) ||
    mrp !== paiseToInput(v.mrpPaise) ||
    stock !== String(v.stockQty);

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};

      if (stock !== String(v.stockQty)) {
        const q = Number.parseInt(stock, 10);
        if (!Number.isInteger(q) || q < 0) throw new Error('Stock must be a whole number, zero or more.');
        body.stockQty = q;
      }
      if (price !== paiseToInput(v.pricePaise)) {
        const p = toPaise(price);
        if (p === null) throw new Error('Enter a price in rupees, greater than zero.');
        body.pricePaise = p;
      }
      if (mrp !== paiseToInput(v.mrpPaise)) {
        // Blank clears it — an empty MRP means "no discount", not zero.
        body.mrpPaise = mrp.trim() === '' ? null : toPaise(mrp);
        if (mrp.trim() !== '' && body.mrpPaise === null) throw new Error('MRP must be a number, or blank.');
      }
      return adminApi.updateVariantFull(v.id, body);
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'product'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      notify({ tone: 'success', title: `${v.weight} updated` });
    },
    onError: (e: unknown) => setError((e as AdminApiError | Error).message),
  });

  const setActive = useMutation({
    mutationFn: () => adminApi.updateVariantFull(v.id, { active: !v.active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'product'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      notify({ tone: 'success', title: v.active ? `${v.weight} retired` : `${v.weight} back on sale` });
    },
    onError: (e: unknown) => notify({ tone: 'error', title: (e as AdminApiError).message }),
  });

  return (
    <li className={cn('rounded-lg border border-[#EBD9BC] p-3.5', !v.active && 'bg-[#B69A55]/8')}>
      {/*
        Every row repeats the labels "Price", "MRP" and "Stock". Without a
        group name, someone tabbing through hears "Price" five times with no
        way to tell which pack they are editing. The group carries the pack
        size so each field is announced in context.
      */}
      <div
        role="group"
        aria-label={`${v.weight} pack${v.active ? '' : ' (retired)'}`}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="min-w-[64px]">
          <span className="block font-sans text-[11px] font-semibold tracking-wide text-[#483828]/60">Pack</span>
          <span className="text-sm font-semibold">{v.weight}</span>
          {!v.active && <span className="ml-2 text-[11px] font-semibold text-[#A33A28]">retired</span>}
        </div>

        <Field
          label="Price ₹" name={`price-${v.id}`} inputMode="decimal"
          className="w-28" value={price}
          disabled={!isOwner}
          onChange={(e) => setPrice(e.target.value)}
        />
        <Field
          label="MRP ₹" name={`mrp-${v.id}`} inputMode="decimal"
          className="w-28" value={mrp}
          disabled={!isOwner}
          placeholder="—"
          onChange={(e) => setMrp(e.target.value)}
        />
        <Field
          label="Stock" name={`stock-${v.id}`} inputMode="numeric"
          className="w-24" value={stock}
          onChange={(e) => setStock(e.target.value)}
        />

        <div className="flex flex-1 items-center justify-end gap-2">
          {dirty && (
            <Button type="button" compact onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            compact
            onClick={() => setActive.mutate()}
            disabled={setActive.isPending}
            title={v.active ? 'Stop selling this pack' : 'Put this pack back on sale'}
          >
            {v.active ? 'Retire' : 'Restore'}
          </Button>
        </div>
      </div>

      {!isOwner && (
        <p className="mt-2 text-[11px] text-[#483828]/60">
          Only owners can change prices. You can update stock.
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-[11px] font-medium text-[#A33A28]">{error}</p>}
      {v.sku && <p className="mt-1 font-mono text-[11px] text-[#483828]/45">SKU {v.sku}</p>}
    </li>
  );
};

export const VariantsCard: React.FC<{
  slug: string | undefined;
  variants: AdminVariant[];
  isOwner: boolean;
}> = ({ slug, variants, isOwner }) => {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ weight: '', price: '', mrp: '', stock: '0', sku: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const add = useMutation({
    mutationFn: async () => {
      const next: Record<string, string> = {};
      if (!draft.weight.trim()) next.weight = 'Required, e.g. 250g';
      if (variants.some((v) => v.weight.toLowerCase() === draft.weight.trim().toLowerCase())) {
        next.weight = 'This product already has a pack that size.';
      }
      const p = toPaise(draft.price);
      if (p === null) next.price = 'Enter a price in rupees.';
      const q = Number.parseInt(draft.stock || '0', 10);
      if (!Number.isInteger(q) || q < 0) next.stock = 'Whole number, zero or more.';
      setErrors(next);
      if (Object.keys(next).length) throw new Error('validation');

      return adminApi.addVariant(slug!, {
        weight: draft.weight.trim(),
        pricePaise: p,
        mrpPaise: draft.mrp.trim() ? toPaise(draft.mrp) : null,
        stockQty: q,
        sku: draft.sku.trim() || null,
        active: true,
      });
    },
    onSuccess: () => {
      setDraft({ weight: '', price: '', mrp: '', stock: '0', sku: '' });
      setErrors({});
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'product'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      notify({ tone: 'success', title: 'Pack added' });
    },
    onError: (e: unknown) => {
      if ((e as Error).message === 'validation') return;
      notify({ tone: 'error', title: (e as AdminApiError).message ?? 'Could not add the pack.' });
    },
  });

  if (!slug) {
    return (
      <div>
        <SectionTitle>Packs and prices</SectionTitle>
        <p className="text-xs leading-relaxed text-[#483828]/70">
          Save the product first. Packs attach to a product that exists, and a
          product with no packs cannot be added to a cart.
        </p>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle>Packs and prices</SectionTitle>

      {variants.length === 0 ? (
        <p className="mb-3 rounded-md border border-[#A33A28]/30 bg-[#FBEDEA] p-3 text-xs leading-relaxed text-[#A33A28]">
          This product has no packs, so nobody can buy it. Add at least one below.
        </p>
      ) : (
        <ul className="mb-4 space-y-2.5">
          {variants.map((v) => (
            <VariantRow key={v.id} v={v} slug={slug} isOwner={isOwner} />
          ))}
        </ul>
      )}

      {!isOwner ? (
        <p className="text-[11px] text-[#483828]/60">Only owners can add a pack.</p>
      ) : !open ? (
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Add a pack
        </Button>
      ) : (
        <div className="rounded-lg border border-[#EBD9BC] bg-[#F3E7D0]/40 p-3.5">
          <div role="group" aria-label="New pack" className="flex flex-wrap items-end gap-3">
            <Field
              label="Pack size" name="new-weight" required className="w-28"
              value={draft.weight} error={errors.weight} placeholder="250g"
              onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
            />
            <Field
              label="Price ₹" name="new-price" required className="w-28" inputMode="decimal"
              value={draft.price} error={errors.price} placeholder="250"
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            />
            <Field
              label="MRP ₹" name="new-mrp" className="w-28" inputMode="decimal"
              value={draft.mrp} placeholder="optional"
              hint="Shown struck through"
              onChange={(e) => setDraft({ ...draft, mrp: e.target.value })}
            />
            <Field
              label="Opening stock" name="new-stock" className="w-28" inputMode="numeric"
              value={draft.stock} error={errors.stock}
              onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
            />
            <Field
              label="SKU" name="new-sku" className="w-32"
              value={draft.sku} placeholder="optional"
              onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
            />
          </div>

          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={() => add.mutate()} disabled={add.isPending}>
              {add.isPending ? 'Adding…' : 'Add pack'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setOpen(false); setErrors({}); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {variants.length > 0 && (
        <p className="mt-3 text-[11px] text-[#483828]/60">
          Retiring a pack stops it being sold but keeps it on past orders — packs are never deleted.
          Cheapest pack shown on cards: {formatPaise(Math.min(...variants.map((v) => v.pricePaise)))}
        </p>
      )}
    </div>
  );
};
