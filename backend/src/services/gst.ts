/**
 * GST computation for tax invoices.
 *
 * Two rules do most of the work, and both are easy to get wrong:
 *
 *   Indian retail prices are INCLUSIVE of GST. The listed ₹110 already
 *   contains the tax. An invoice reports the tax component, it does not add
 *   anything on top.
 *
 *   Whether that component splits into CGST + SGST or becomes IGST depends on
 *   place of supply — the buyer's state versus the seller's. Getting it wrong
 *   means filing corrections.
 *
 * See docs/COMPLIANCE.md §4.
 */

export interface InvoiceLineInput {
  description: string;
  hsnCode: string | null;
  quantity: number;
  /** GST-inclusive, as displayed and charged. */
  unitPricePaise: number;
  lineTotalPaise: number;
  gstRatePercent: number;
}

export interface InvoiceLine extends InvoiceLineInput {
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

export interface InvoiceTotals {
  intraState: boolean;
  placeOfSupply: string;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  lines: InvoiceLine[];
}

/**
 * Split a GST-inclusive amount into its taxable value and tax component.
 *
 *   taxable = inclusive × 100 / (100 + rate)
 *   tax     = inclusive − taxable
 *
 * Tax is derived by subtraction rather than computed separately, so the two
 * always add back to exactly the amount charged. Computing both independently
 * leaves the invoice off by a paise on some values.
 */
export function splitInclusive(inclusivePaise: number, ratePercent: number) {
  const taxableValuePaise = Math.round((inclusivePaise * 100) / (100 + ratePercent));
  return { taxableValuePaise, taxPaise: inclusivePaise - taxableValuePaise };
}

/**
 * CGST + SGST when buyer and seller share a state; IGST otherwise.
 * Never both, and never neither.
 */
export function computeInvoice(
  lines: InvoiceLineInput[],
  sellerState: string,
  buyerState: string,
  /** Shipping is a supply too, taxed at the rate of what is being shipped. */
  shippingPaise = 0,
  discountPaise = 0,
): InvoiceTotals {
  const intraState = normaliseState(sellerState) === normaliseState(buyerState);

  const grossBeforeAdjust = lines.reduce((s, l) => s + l.lineTotalPaise, 0);

  const priced: InvoiceLine[] = lines.map((line) => {
    // Distribute the order-level discount and shipping across lines in
    // proportion to value, so each line's tax reflects what was actually paid
    // for it. Assigning them to one line would misstate that line's tax.
    const share = grossBeforeAdjust === 0 ? 0 : line.lineTotalPaise / grossBeforeAdjust;
    const adjusted =
      line.lineTotalPaise - Math.round(discountPaise * share) + Math.round(shippingPaise * share);

    const { taxableValuePaise, taxPaise } = splitInclusive(adjusted, line.gstRatePercent);

    return {
      ...line,
      taxableValuePaise,
      // Halves are computed from the same total, so they always sum to it.
      cgstPaise: intraState ? Math.round(taxPaise / 2) : 0,
      sgstPaise: intraState ? taxPaise - Math.round(taxPaise / 2) : 0,
      igstPaise: intraState ? 0 : taxPaise,
    };
  });

  const sum = (f: (l: InvoiceLine) => number) => priced.reduce((s, l) => s + f(l), 0);

  const taxableValuePaise = sum((l) => l.taxableValuePaise);
  const cgstPaise = sum((l) => l.cgstPaise);
  const sgstPaise = sum((l) => l.sgstPaise);
  const igstPaise = sum((l) => l.igstPaise);

  return {
    intraState,
    placeOfSupply: buyerState,
    taxableValuePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalPaise: taxableValuePaise + cgstPaise + sgstPaise + igstPaise,
    lines: priced,
  };
}

const normaliseState = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The Indian financial year runs 1 April to 31 March. Invoice sequences reset
 * on 1 April, which is why the year label is part of the invoice number.
 */
export function financialYearOf(date: Date): string {
  const y = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export const formatInvoiceNumber = (fy: string, sequence: number) =>
  `SV/${fy}/${String(sequence).padStart(5, '0')}`;

/** Amount in words, as required on a tax invoice. */
export function rupeesInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const paiseRemainder = paise % 100;

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const under100 = (n: number): string =>
    n < 20 ? ones[n]! : `${tens[Math.floor(n / 10)]}${n % 10 ? ' ' + ones[n % 10] : ''}`;

  const under1000 = (n: number): string =>
    n < 100 ? under100(n) : `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + under100(n % 100) : ''}`;

  // Indian grouping: crore, lakh, thousand — not millions.
  const parts: string[] = [];
  let rest = rupees;
  const crore = Math.floor(rest / 10_000_000); rest %= 10_000_000;
  const lakh = Math.floor(rest / 100_000); rest %= 100_000;
  const thousand = Math.floor(rest / 1000); rest %= 1000;

  if (crore) parts.push(`${under1000(crore)} Crore`);
  if (lakh) parts.push(`${under1000(lakh)} Lakh`);
  if (thousand) parts.push(`${under1000(thousand)} Thousand`);
  if (rest) parts.push(under1000(rest));

  const rupeeWords = parts.length ? parts.join(' ') : 'Zero';
  const paiseWords = paiseRemainder ? ` and ${under100(paiseRemainder)} Paise` : '';
  return `${rupeeWords} Rupees${paiseWords} Only`;
}
