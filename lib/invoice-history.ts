import type { Invoice, InvoiceHistoryEntry } from "./types";

const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Plain-language list of what changed on a bill. CGST Rule 56(8): edits to
 * electronic records must leave a log, so every change to an issued bill is
 * recorded rather than silently overwritten.
 */
export function describeChanges(before: Invoice, after: Invoice): string[] {
  const out: string[] = [];
  const txt = (a: unknown, b: unknown) => String(a ?? "").trim() !== String(b ?? "").trim();
  if (txt(before.partyName, after.partyName)) out.push(`Customer: ${before.partyName || "—"} → ${after.partyName || "—"}`);
  if (txt(before.partyGstin, after.partyGstin)) out.push(`Customer GSTIN: ${before.partyGstin || "—"} → ${after.partyGstin || "—"}`);
  if (txt(before.date, after.date)) out.push(`Bill date: ${before.date} → ${after.date}`);
  if (txt(before.placeOfSupply, after.placeOfSupply)) out.push(`Place of supply: ${before.placeOfSupply} → ${after.placeOfSupply}`);
  if (txt(before.type, after.type)) out.push(`Bill type: ${before.type} → ${after.type}`);
  const lines = (i: Invoice) =>
    (i.items || []).map((l) => `${l.description}×${l.quantity}@${l.rate}/${l.gstRate}%`).join("|");
  if (lines(before) !== lines(after)) out.push(`Items changed (${before.items?.length ?? 0} → ${after.items?.length ?? 0} lines)`);
  if (Math.abs((before.totalTax || 0) - (after.totalTax || 0)) >= 0.01) out.push(`GST: ${inr(before.totalTax)} → ${inr(after.totalTax)}`);
  if (Math.abs((before.grandTotal || 0) - (after.grandTotal || 0)) >= 0.01) out.push(`Total: ${inr(before.grandTotal)} → ${inr(after.grandTotal)}`);
  if (txt(before.status, after.status)) out.push(`Status: ${before.status} → ${after.status}`);
  if (txt(before.notes, after.notes)) out.push("Notes changed");
  return out;
}

/** Appends an entry to a bill's change log (issued bills only). */
export function withHistory(before: Invoice | null | undefined, after: Invoice, now = new Date().toISOString()): Invoice {
  const history = [...(before?.history || [])];
  if (before && before.status !== "draft") {
    const changes = describeChanges(before, after);
    if (changes.length) history.push({ at: now, action: "edited", detail: changes.join("; ") });
  }
  return history.length ? { ...after, history } : after;
}

export function cancelledEntry(now = new Date().toISOString()): InvoiceHistoryEntry {
  return { at: now, action: "cancelled", detail: "Bill cancelled. Kept in records and reported as cancelled in GSTR-1." };
}
