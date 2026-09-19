/**
 * Saved addresses.
 *
 * Nothing here is written automatically from an order. An address typed once
 * to send a gift is not somewhere the customer lives, and quietly keeping it
 * means their next order defaults to the wrong house — so saving is always a
 * deliberate act.
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiRequestError, type SavedAddress } from '../api/client';

type Draft = Omit<SavedAddress, 'id'>;

const EMPTY: Draft = {
  label: '', name: '', phone: '', address: '', landmark: '',
  city: '', state: 'Karnataka', pincode: '', isDefault: false,
};

const field =
  'mt-1 min-h-11 w-full rounded-md border border-[#EBD9BC] bg-white px-3 text-sm ' +
  'text-[#483828] focus:border-[#87380F] focus:outline-none';
const labelCls = 'block text-xs font-semibold tracking-wide text-[#483828]';

export function SavedAddresses() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({ queryKey: ['addresses'], queryFn: () => api.addresses.list(), retry: false });
  const done = () => {
    queryClient.invalidateQueries({ queryKey: ['addresses'] });
    setEditing(null); setDraft(EMPTY); setError(null);
  };
  const fail = (e: unknown) =>
    setError(e instanceof ApiRequestError ? e.message : 'Could not save that address.');

  const save = useMutation({
    mutationFn: () => (editing === 'new'
      ? api.addresses.create(draft)
      : api.addresses.update(editing as number, draft)),
    onSuccess: done, onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.addresses.remove(id),
    onSuccess: done, onError: fail,
  });
  const makeDefault = useMutation({
    mutationFn: (id: number) => api.addresses.update(id, { isDefault: true }),
    onSuccess: done, onError: fail,
  });

  const startEdit = (a: SavedAddress) => {
    const { id: _id, ...rest } = a;
    setDraft(rest); setEditing(a.id); setError(null);
  };

  const addresses = list.data ?? [];

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-bold text-[#483828]">Saved addresses</h2>
        {editing === null && addresses.length < 10 && (
          <button
            type="button"
            onClick={() => { setDraft(EMPTY); setEditing('new'); setError(null); }}
            className="inline-flex min-h-11 items-center rounded-md border border-[#EBD9BC] px-4 text-xs font-semibold text-[#483828] transition-colors hover:border-[#87380F] hover:text-[#87380F]"
          >
            Add an address
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-[#A33A28]/30 bg-[#FBEDEA] p-3 text-xs font-medium text-[#A33A28]">
          {error}
        </p>
      )}

      {editing !== null && (
        <form
          className="mt-4 rounded-lg border border-[#EBD9BC] bg-white p-4"
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="a-label" className={labelCls}>Label</label>
              <input id="a-label" className={field} placeholder="Home, Office…"
                value={draft.label ?? ''} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </div>
            <div>
              <label htmlFor="a-name" className={labelCls}>Full name</label>
              <input id="a-name" required className={field}
                value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="a-phone" className={labelCls}>Phone</label>
              <input id="a-phone" required inputMode="numeric" className={field}
                value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
            </div>
            <div>
              <label htmlFor="a-pincode" className={labelCls}>Pincode</label>
              <input id="a-pincode" required inputMode="numeric" className={field}
                value={draft.pincode} onChange={(e) => setDraft({ ...draft, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="a-address" className={labelCls}>Address</label>
              <textarea id="a-address" required rows={2} className={`${field} py-2`}
                value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
            </div>
            <div>
              <label htmlFor="a-landmark" className={labelCls}>Landmark</label>
              <input id="a-landmark" className={field}
                value={draft.landmark ?? ''} onChange={(e) => setDraft({ ...draft, landmark: e.target.value })} />
            </div>
            <div>
              <label htmlFor="a-city" className={labelCls}>City</label>
              <input id="a-city" required className={field}
                value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
            </div>
            <div>
              <label htmlFor="a-state" className={labelCls}>State</label>
              <input id="a-state" required className={field}
                value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={save.isPending}
              className="min-h-11 rounded-md bg-[#87380F] px-5 text-xs font-semibold tracking-wider text-[#FAF6F0] hover:bg-[#662707] disabled:opacity-50">
              {save.isPending ? 'Saving…' : editing === 'new' ? 'Save address' : 'Save changes'}
            </button>
            <button type="button" onClick={() => { setEditing(null); setError(null); }}
              className="min-h-11 rounded-md border border-[#EBD9BC] px-5 text-xs font-semibold text-[#483828] hover:border-[#87380F]">
              Cancel
            </button>
          </div>
        </form>
      )}

      {list.isLoading ? (
        <div className="mt-4 h-20 animate-pulse rounded-lg bg-[#EBD9BC]/60" />
      ) : addresses.length === 0 && editing === null ? (
        <p className="mt-4 rounded-lg border border-[#EBD9BC] bg-white p-6 text-center text-sm text-[#483828]/70">
          No saved addresses yet. Save one to skip typing it at checkout.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-lg border border-[#EBD9BC] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-sm">
                  <p className="font-semibold text-[#483828]">
                    {a.label || a.name}
                    {a.isDefault && (
                      <span className="ml-2 rounded bg-[#647044]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#3f4a26]">
                        Default
                      </span>
                    )}
                  </p>
                  <p className="mt-1 leading-relaxed text-[#483828]/75">
                    {a.name} · {a.phone}<br />
                    {a.address}{a.landmark ? `, ${a.landmark}` : ''}<br />
                    {a.city}, {a.state} {a.pincode}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-3">
                <button type="button" onClick={() => startEdit(a)}
                  className="inline-flex min-h-11 items-center text-xs font-semibold text-[#87380F] hover:underline">
                  Edit
                </button>
                {!a.isDefault && (
                  <button type="button" onClick={() => makeDefault.mutate(a.id)}
                    className="inline-flex min-h-11 items-center text-xs font-semibold text-[#87380F] hover:underline">
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { if (confirm('Remove this saved address?')) remove.mutate(a.id); }}
                  className="inline-flex min-h-11 items-center text-xs font-semibold text-[#A33A28] hover:underline">
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
