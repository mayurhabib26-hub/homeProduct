import React from 'react';
import type { ProductDetail, ApiVariant } from '@sv/shared';
import { formatPaise } from '@sv/shared';

/**
 * Legal Metrology declarations.
 *
 * The Packaged Commodities Rules require these on the listing page, legibly
 * readable BEFORE purchase — so this renders inline, not behind a tab.
 *
 * Missing values render as a visible gap rather than being hidden. A blank
 * where a manufacturer address should be is a bug someone will notice; a
 * silently omitted row is not. See docs/COMPLIANCE.md §3.
 */
const Row: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
  <div className="flex gap-3 py-1.5 border-b border-[#EBD9BC]/60 last:border-0">
    <dt className="text-[11px] uppercase tracking-wider text-[#483828]/55 w-40 shrink-0">{label}</dt>
    <dd className="text-xs text-[#483828]">
      {value === undefined || value === null || value === '' ? (
        <span className="text-[#87380F] italic">not declared</span>
      ) : (
        value
      )}
    </dd>
  </div>
);

export const ProductDeclarations: React.FC<{
  product: ProductDetail;
  variant: ApiVariant;
}> = ({ product, variant }) => {
  const d = product.declarations;

  const netQuantity =
    d && variant.netQuantityValue && variant.netQuantityUnit
      ? `${Number(variant.netQuantityValue)} ${variant.netQuantityUnit}`
      : variant.weight;

  return (
    <section
      aria-labelledby="declarations-heading"
      className="mt-8 bg-white border border-[#EBD9BC] rounded-xl p-5"
    >
      <h2
        id="declarations-heading"
        className="font-serif text-base font-bold text-[#483828] mb-3"
      >
        Product declarations
      </h2>

      <dl>
        <Row label="Common name" value={product.name} />
        <Row label="Net quantity" value={netQuantity} />
        <Row
          label="Maximum retail price"
          value={
            variant.mrpPaise
              ? `${formatPaise(variant.mrpPaise)} (inclusive of all taxes)`
              : `${formatPaise(variant.pricePaise)} (inclusive of all taxes)`
          }
        />
        <Row label="Manufactured &amp; packed by" value={d?.manufacturerName} />
        <Row label="Address" value={d?.manufacturerAddress} />
        <Row label="Country of origin" value={d?.countryOfOrigin} />
        <Row
          label="Best before"
          value={d?.shelfLifeMonths ? `${d.shelfLifeMonths} months from packaging` : undefined}
        />
        <Row label="Consumer care" value={d?.consumerCarePhone} />
        <Row label="Consumer care email" value={d?.consumerCareEmail} />
      </dl>

      <p className="text-[11px] text-[#483828]/55 mt-3 leading-relaxed">
        Month and year of manufacture are printed on each pack. Declarations
        are made under the Legal Metrology (Packaged Commodities) Rules, 2011.
      </p>
    </section>
  );
};
