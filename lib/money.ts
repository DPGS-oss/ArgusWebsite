/**
 * Money engine. Every amount is worked out in whole paise and rounded once,
 * half away from zero, so the web app and the Android app (lib/core/utils/
 * money_utils.dart) produce the same bill to the paisa. Both are checked
 * against the shared vectors in lib/money-golden.json.
 *
 * Rules:
 * - Price before tax: tax = rate × taxable value, rounded to the paisa.
 * - Price including tax: taxable = amount ÷ (1 + rate), tax = amount − taxable,
 *   so the customer pays exactly what was typed. Tax is worked out on the whole
 *   line, never per unit, so it stays within a paisa of rate × taxable value.
 * - CGST is half the tax rounded; SGST is the rest, so the two always add up.
 */

import shared from "../functions/_shared/money.js";

const core = shared as {
  roundPaise: (paise: number) => number;
  toPaise: (rupees: number) => number;
  round2: (rupees: number) => number;
};

/** Rupees to paise, half away from zero. Strips binary noise (1.005 → 101, not 100). */
export const toPaise = (rupees: number): number => core.toPaise(rupees);

export function fromPaise(paise: number): number {
  return paise / 100;
}

/** Round rupees to the paisa, half away from zero. */
export const round2 = (rupees: number): number => core.round2(rupees);

/** Round paise (possibly fractional) to whole paise, half away from zero. */
export const roundPaise = (paise: number): number => core.roundPaise(paise);

/** CGST and SGST in paise. They always add up to the tax. */
export function splitTaxPaise(taxPaise: number): { cgst: number; sgst: number } {
  const cgst = roundPaise(taxPaise / 2);
  return { cgst, sgst: taxPaise - cgst };
}

export type LineInput = {
  quantity: number;
  /** Unit price, before tax unless `inclusive`. */
  price: number;
  gstRate: number;
  /** Line discount, percent. */
  discount?: number;
  inclusive?: boolean;
  interState: boolean;
  /** Cess percent of taxable value, or a fixed cess amount. */
  cessRate?: number;
  cess?: number;
};

export type LinePaise = {
  taxable: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
};

/** One bill line, in paise. */
export function linePaise(input: LineInput): LinePaise {
  const rate = input.gstRate || 0;
  const disc = input.discount || 0;
  const gross = roundPaise(input.quantity * input.price * 100 * (1 - disc / 100));
  let taxable: number;
  let tax: number;
  if (input.inclusive) {
    taxable = roundPaise(gross / (1 + rate / 100));
    tax = gross - taxable;
  } else {
    taxable = gross;
    tax = roundPaise((taxable * rate) / 100);
  }
  const cess = input.cessRate != null ? roundPaise((taxable * input.cessRate) / 100) : toPaise(input.cess ?? 0);
  const split = input.interState ? { cgst: 0, sgst: 0 } : splitTaxPaise(tax);
  return {
    taxable,
    tax,
    cgst: split.cgst,
    sgst: split.sgst,
    igst: input.interState ? tax : 0,
    cess,
    total: taxable + tax + cess,
  };
}

/** Nearest rupee, half away from zero; returns the round-off in paise (always under ₹1). */
export function roundOffPaise(totalPaise: number): number {
  const rupees = Math.sign(totalPaise) * Math.round(Math.abs(totalPaise) / 100);
  return rupees * 100 - totalPaise;
}
