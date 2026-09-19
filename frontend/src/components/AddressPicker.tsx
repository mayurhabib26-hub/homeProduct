/**
 * "Use a saved address" at checkout.
 *
 * Renders nothing at all for a guest, or for a signed-in customer with no
 * saved addresses. Checkout must not grow a sign-in prompt — an account is an
 * option, never a gate, and the fastest checkout is the one that does not ask
 * a question first.
 *
 * Picking one fills the form and leaves it editable. It does not lock the
 * fields: a saved address with a stale flat number should be fixable without
 * going to the account page first.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type SavedAddress } from '../api/client';

export function AddressPicker({ onPick }: { onPick: (a: SavedAddress) => void }) {
  const [picked, setPicked] = useState<number | null>(null);

  const me = useQuery({ queryKey: ['me'], queryFn: () => api.me(), retry: false });
  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.addresses.list(),
    enabled: Boolean(me.data),
    retry: false,
  });

  const list = addresses.data ?? [];
  if (!me.data || list.length === 0) return null;

  return (
    <fieldset className="mb-5 rounded-lg border border-[#EBD9BC] bg-[#F7EFE1]/60 p-3.5">
      <legend className="px-1 text-xs font-semibold tracking-wide text-[#483828]">
        Use a saved address
      </legend>

      <ul className="space-y-2">
        {list.map((a) => (
          <li key={a.id}>
            <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-xs leading-relaxed">
              <input
                type="radio"
                name="saved-address"
                className="mt-1 h-4 w-4 accent-[#87380F]"
                checked={picked === a.id}
                onChange={() => { setPicked(a.id); onPick(a); }}
              />
              <span className="text-[#483828]/80">
                <span className="font-semibold text-[#483828]">{a.label || a.name}</span>
                {a.isDefault && <span className="ml-1.5 text-[10px] font-bold uppercase text-[#647044]">Default</span>}
                <br />
                {a.address}{a.landmark ? `, ${a.landmark}` : ''}, {a.city} {a.pincode}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[11px] text-[#483828]/60">
        You can still edit anything below after picking one.
      </p>
    </fieldset>
  );
}
