/**
 * Rounding core shared by the web app (lib/money.ts) and the functions.
 * Amounts are rounded to the paisa once, half away from zero, after removing
 * binary noise (1.005 rounds to 1.01). Matches lib/core/utils/money_utils.dart.
 */
function roundPaise(paise) {
  const p = Number((Number(paise) || 0).toPrecision(12));
  return Math.sign(p) * Math.round(Math.abs(p)) + 0;
}

function toPaise(rupees) {
  const n = Number(rupees);
  if (!Number.isFinite(n)) return 0;
  return roundPaise(n * 100);
}

function round2(rupees) {
  return toPaise(rupees) / 100;
}

/** CGST is half the tax rounded; SGST is the rest, so they always add up. */
function splitTax(rupees) {
  const tax = toPaise(rupees);
  const cgst = roundPaise(tax / 2);
  return { cgst: cgst / 100, sgst: (tax - cgst) / 100 };
}

module.exports = { roundPaise, toPaise, round2, splitTax };
