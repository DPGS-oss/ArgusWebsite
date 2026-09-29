import type { AppData, Invoice, Purchase } from "./types";
import { isRegisteredGstin, isValidGstin } from "./gstin";
import { generateGstnJson, notesAsInvoices, purchaseTax } from "./gst";

/** Owner-facing wording is plain language; `law` is a short reference for the CA. */
export type Issue = { severity: "error" | "warn"; title: string; detail: string; law?: string };

const GST20 = new Date("2025-09-22T00:00:00");
const HISTORICAL = new Set([12, 28]);
const DAY = 24 * 60 * 60 * 1000;

function afterGst20(date: string): boolean {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return true;
  return d >= GST20;
}

function financialYear(date: string): number | null {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

/** Section 34(2) / 16(4): 30 November after the end of the invoice's financial year. */
function novemberDeadline(date: string): string | null {
  const fy = financialYear(date);
  return fy === null ? null : `${fy + 1}-11-30`;
}

function ageInDays(date: string, today: Date): number {
  const d = new Date(String(date || "").slice(0, 10));
  return Number.isNaN(d.getTime()) ? 0 : Math.floor((today.getTime() - d.getTime()) / DAY);
}

const isNote = (i: Invoice) =>
  i.type === "credit_note" || i.type === "debit_note" || i.documentType === "CRN" || i.documentType === "DBN";

export function checkBooks(data: AppData, today: Date = new Date()): Issue[] {
  const issues: Issue[] = [];
  const seller = data.businesses.find((b) => b.id === data.activeBusinessId)?.gstin || "";
  const above5 = !!data.settings.turnoverAbove5Cr;

  if (seller && !isValidGstin(seller)) {
    issues.push({
      severity: "error",
      title: "Your GSTIN has a typo",
      detail: "Check the GST number in Business settings. Bills with a wrong GSTIN can be rejected.",
      law: "GSTIN format / check digit",
    });
  }

  const byId = new Map(data.invoices.map((i) => [i.id, i]));
  const seen = new Map<string, number>();

  for (const inv of data.invoices) {
    if (inv.status === "draft" || inv.status === "cancelled") continue;
    const number = (inv.invoiceNumber || "").trim();
    const b2b = isRegisteredGstin(inv.partyGstin);

    if (!number) {
      issues.push({ severity: "error", title: "A bill has no number", detail: "Every bill needs its own number.", law: "Rule 46(b)" });
    } else {
      if (number.length > 16) {
        issues.push({
          severity: "error",
          title: "Bill number is too long",
          detail: `${number} is over 16 characters. The GST portal will reject it. Use a shorter number.`,
          law: "Rule 46(b)",
        });
      }
      // Numbers only need to be unique within a financial year (Apr–Mar).
      const key = `${financialYear(inv.date) ?? "?"}|${number.toUpperCase()}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    }

    if (inv.partyGstin && inv.partyGstin !== "URP" && !b2b) {
      issues.push({
        severity: "error",
        title: "Customer's GST number looks wrong",
        detail: `${number}: ${inv.partyGstin} has a typo. Your customer won't get their GST back on this bill.`,
        law: "GSTIN check digit; buyer ITC",
      });
    }

    if (!inv.placeOfSupply && inv.totalTax > 0) {
      issues.push({
        severity: "warn",
        title: "Customer's state is missing",
        detail: `${number}: add the customer's state so the right tax (CGST+SGST or IGST) is charged.`,
        law: "Place of supply, Rule 46(n)",
      });
    }

    // Rule 46(e): unregistered buyer, value above ₹50,000 → name, address and state.
    if (!b2b && !isNote(inv) && inv.grandTotal > 50000 && (!inv.partyName?.trim() || !inv.placeOfSupply)) {
      issues.push({
        severity: "warn",
        title: "Big bill needs the customer's details",
        detail: `${number} is above ₹50,000. Add the customer's name, address, and state.`,
        law: "Rule 46(e)",
      });
    }

    // HSN: turnover ≤ ₹5 crore → 4 digits mandatory on B2B only; above ₹5 crore → 6 digits on all.
    const hsnRequired = above5 || b2b;
    const minHsn = above5 ? 6 : 4;
    let hsnFlagged = false;
    let rateFlagged = false;
    for (const item of inv.items) {
      const hsn = (item.hsn || "").replace(/\s/g, "");
      if (hsnRequired && !hsnFlagged && (!hsn || hsn.length < minHsn)) {
        hsnFlagged = true;
        issues.push({
          severity: "warn",
          title: `Item code (HSN) too short on ${number}`,
          detail: `Use at least ${minHsn} digits for each item${above5 ? "" : " on bills to GST-registered customers"}.`,
          law: above5 ? "HSN 6 digits, AATO > ₹5 cr" : "HSN 4 digits on B2B, AATO ≤ ₹5 cr",
        });
      }
      if (!rateFlagged && !isNote(inv) && afterGst20(inv.date) && HISTORICAL.has(item.gstRate)) {
        rateFlagged = true;
        issues.push({
          severity: "error",
          title: "Old GST rate on a new bill",
          detail: `${number} uses ${item.gstRate}%. Since 22 Sep 2025 the rates are 0, 5, 18, or 40%.`,
          law: "GST 2.0 rate notification",
        });
      }
      if (hsnFlagged && rateFlagged) break;
    }

    if (above5 && b2b && !inv.irn && inv.grandTotal > 0) {
      const age = ageInDays(inv.date, today);
      issues.push({
        severity: age > 30 ? "error" : "warn",
        title: age > 30 ? "E-invoice is overdue" : "E-invoice number not saved",
        law: "E-invoicing, 30-day reporting limit (AATO ≥ ₹10 cr)",
        detail:
          age > 30
            ? `${number} is ${age} days old. If your yearly sales are ₹10 crore or more, the e-invoice portal won't accept it after 30 days.`
            : `${number}: create the e-invoice on the government portal and save its number (IRN) here.`,
      });
    }
    if (!isNote(inv) && inv.grandTotal >= 50000 && !inv.ewayBillNo) {
      issues.push({
        severity: "warn",
        title: "E-way bill number not saved",
        detail: `${number} is ₹50,000 or more. If goods are being transported, save the e-way bill number.`,
        law: "E-way bill, ₹50,000 threshold",
      });
    }
  }

  // Bills saved in "total including GST" mode before the fix had GST added on top
  // of the amount typed in (₹1,180 incl. 18% was saved as ₹1,392).
  for (const inv of data.invoices) {
    if (!inv.isTotalMode || inv.enteredTotal !== undefined || inv.status === "draft" || inv.status === "cancelled") continue;
    const item = inv.items[0];
    if (!item || inv.items.length !== 1 || !item.gstRate) continue;
    const typed = Math.round(item.rate * item.quantity * (1 - (item.discount || 0) / 100) * 100) / 100;
    const extra = Math.round((inv.grandTotal - typed) * 100) / 100;
    if (extra >= 1) {
      issues.push({
        severity: "error",
        title: "This bill may charge GST twice",
        detail: `${inv.invoiceNumber}: you typed ₹${typed.toFixed(2)} including GST, but the bill shows ₹${inv.grandTotal.toFixed(2)}. If the customer should pay ₹${typed.toFixed(2)}, issue a credit note for ₹${extra.toFixed(2)} and tell your CA.`,
        law: "Total-mode double-GST bug (fixed Sep 2026); correct via credit note, Section 34",
      });
    }
  }

  for (const [key, count] of seen) {
    if (count > 1) {
      const number = key.slice(key.indexOf("|") + 1);
      issues.push({
        severity: "error",
        title: "Two bills have the same number",
        detail: `${number} is used more than once this year (April–March). Each bill needs its own number.`,
        law: "Rule 46(b)",
      });
    }
  }

  for (const p of data.purchases || []) {
    if (p.supplierGstin && !isValidGstin(p.supplierGstin)) {
      issues.push({
        severity: "error",
        title: "Supplier's GST number looks wrong",
        detail: `${p.supplierName}: ${p.supplierGstin} has a typo. You can't claim GST back until it's fixed.`,
        law: "GSTIN check digit",
      });
    }
    if (p.itcEligible !== false && !p.supplierGstin) {
      issues.push({
        severity: "warn",
        title: "Add the supplier's GST number",
        detail: `${p.purchaseNumber}: add the supplier's GST number and bill number to claim the GST you paid.`,
        law: "ITC, Section 16(2)",
      });
    }
    // Rule 37 / Section 16(2): pay the supplier within 180 days or reverse the ITC.
    const billDate = p.supplierInvoiceDate || p.createdAt;
    const unpaid = (p.totalAmount || 0) - (p.paidAmount ?? p.totalAmount ?? 0);
    const age = ageInDays(billDate, today);
    if (p.itcEligible !== false && p.supplierGstin && unpaid > 0.5 && age > 180) {
      issues.push({
        severity: "error",
        title: "Supplier not paid for over 6 months",
        detail: `${p.purchaseNumber} (${p.supplierName}): ₹${unpaid.toFixed(2)} unpaid for ${age} days. You must give back the GST you claimed on it until you pay. Tell your CA.`,
        law: "Rule 37 / Section 16(2): reverse ITC after 180 days",
      });
    }
  }

  // Section 34(2): a credit note after 30 Nov following the original invoice's FY cannot cut output tax.
  for (const cn of data.creditNotes || []) {
    const original = cn.invoiceId ? byId.get(cn.invoiceId) : undefined;
    const deadline = original ? novemberDeadline(original.date) : null;
    const cnDate = String(cn.createdAt || "").slice(0, 10);
    if (original && deadline && cnDate > deadline && (cn.totalGstAmount || 0) > 0) {
      issues.push({
        severity: "error",
        title: "Credit note is too late to lower your GST",
        detail: `${cn.creditNoteNumber} is after ${deadline}, so it can't reduce the GST on ${original.invoiceNumber}.`,
        law: "Section 34(2) deadline",
      });
    }
  }

  const noteDocs = notesAsInvoices(data);
  for (const note of noteDocs) {
    if (!note.partyGstin && !note.placeOfSupply) {
      issues.push({
        severity: "warn",
        title: `${note.type === "credit_note" ? "Credit" : "Debit"} note isn't linked to a bill`,
        detail: `${note.invoiceNumber}: pick the original bill so the GST return shows it correctly.`,
        law: "GSTR-1 CDNR/CDNUR",
      });
    }
  }

  return issues;
}

/** GSTR-3B figures for one tax period, from the same builder as the JSON export. */
export function gstr3b(data: AppData, from: string, to: string) {
  const seller = data.businesses.find((b) => b.id === data.activeBusinessId)?.gstin || "";
  const docs = [...data.invoices, ...notesAsInvoices(data)];
  const json = generateGstnJson(docs, "gstr3b", from, to, data.purchases || [], seller) as {
    sup_details: {
      osup_det: { txval: number; iamt: number; camt: number; samt: number };
      osup_nil_exmp: { txval: number };
      isup_rev: { iamt: number; camt: number; samt: number };
    };
    itc_elg: {
      itc_net: { iamt: number; camt: number; samt: number };
      itc_inelg: { iamt: number; camt: number; samt: number }[];
    };
  };
  const out = json.sup_details.osup_det;
  const rcm = json.sup_details.isup_rev;
  const itc = json.itc_elg.itc_net;
  const blocked = json.itc_elg.itc_inelg.reduce((s, r) => s + r.iamt + r.camt + r.samt, 0);
  const rcmTax = rcm.iamt + rcm.camt + rcm.samt;
  const outputTax = out.iamt + out.camt + out.samt;
  const credit = itc.iamt + itc.camt + itc.samt;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    taxable: round(out.txval),
    nil: round(json.sup_details.osup_nil_exmp.txval),
    cgst: round(out.camt),
    sgst: round(out.samt),
    igst: round(out.iamt),
    rcm: round(rcmTax),
    eligible: round(credit),
    blocked: round(blocked),
    // RCM must be paid in cash; ITC can only offset forward-charge output tax.
    cash: round(Math.max(0, outputTax - credit) + rcmTax),
    carryForward: round(Math.max(0, credit - outputTax)),
  };
}

export function purchaseMatch(purchases: Purchase[], recipientGstin = "") {
  return (purchases || []).map((p) => {
    const tax = purchaseTax(p, recipientGstin);
    const base = { purchase: p, tax: Math.round((tax.iamt + tax.camt + tax.samt) * 100) / 100 };
    if (p.itcEligible === false) return { ...base, status: "blocked", reason: "Marked as not claimable" };
    if (!p.supplierGstin) return { ...base, status: "missing", reason: "Add the supplier's GST number" };
    if (!isValidGstin(p.supplierGstin)) return { ...base, status: "missing", reason: "Supplier's GST number has a typo" };
    if (!p.supplierInvoiceNumber) return { ...base, status: "missing", reason: "Add the supplier's bill number" };
    if (p.reverseCharge) return { ...base, status: "eligible", reason: "You pay this GST for the supplier, then claim it back" };
    return { ...base, status: "eligible", reason: "Ready to claim" };
  });
}

export function invoiceNeedsPortal(inv: Invoice, above5: boolean): boolean {
  return (above5 && !inv.irn) || (inv.grandTotal >= 50000 && !inv.ewayBillNo);
}
