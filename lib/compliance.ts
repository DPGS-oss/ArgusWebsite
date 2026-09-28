import type { AppData, Invoice, Purchase } from "./types";
import { isRegisteredGstin, isValidGstin } from "./gstin";
import { generateGstnJson, notesAsInvoices, purchaseTax } from "./gst";

export type Issue = { severity: "error" | "warn"; title: string; detail: string };

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
      title: "Seller GSTIN is not valid",
      detail: "The GSTIN format or check digit is wrong. Fix it in Business before you file.",
    });
  }

  const byId = new Map(data.invoices.map((i) => [i.id, i]));
  const seen = new Map<string, number>();

  for (const inv of data.invoices) {
    if (inv.status === "draft" || inv.status === "cancelled") continue;
    const number = (inv.invoiceNumber || "").trim();
    const b2b = isRegisteredGstin(inv.partyGstin);

    if (!number) {
      issues.push({ severity: "error", title: "Invoice has no number", detail: "Rule 46 requires a unique invoice number." });
    } else {
      if (number.length > 16) {
        issues.push({
          severity: "error",
          title: "Invoice number longer than 16 characters",
          detail: `${number} will be rejected on the GST portal and for IRN (Rule 46(b)).`,
        });
      }
      // Numbers only need to be unique within a financial year (Apr–Mar).
      const key = `${financialYear(inv.date) ?? "?"}|${number.toUpperCase()}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    }

    if (inv.partyGstin && inv.partyGstin !== "URP" && !b2b) {
      issues.push({
        severity: "error",
        title: "Buyer GSTIN looks wrong",
        detail: `${number}: ${inv.partyGstin} fails the GSTIN check digit. The buyer will not get ITC.`,
      });
    }

    if (!inv.placeOfSupply && inv.totalTax > 0) {
      issues.push({
        severity: "warn",
        title: "Missing place of supply",
        detail: `${number} needs place of supply so CGST/SGST vs IGST is clear (Rule 46(n)).`,
      });
    }

    // Rule 46(e): unregistered buyer, value above ₹50,000 → name, address and state.
    if (!b2b && !isNote(inv) && inv.grandTotal > 50000 && (!inv.partyName?.trim() || !inv.placeOfSupply)) {
      issues.push({
        severity: "warn",
        title: "Buyer details missing on a large B2C bill",
        detail: `${number} is above ₹50,000; Rule 46(e) needs the buyer's name, address, and state.`,
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
          title: `HSN too short on ${number}`,
          detail: `Use at least ${minHsn} digits${above5 ? " (turnover above ₹5 crore)" : " on B2B invoices"}.`,
        });
      }
      if (!rateFlagged && !isNote(inv) && afterGst20(inv.date) && HISTORICAL.has(item.gstRate)) {
        rateFlagged = true;
        issues.push({
          severity: "error",
          title: "Old GST rate on a new bill",
          detail: `${number} uses ${item.gstRate}%. From 22 Sep 2025 use 0, 5, 18, or 40.`,
        });
      }
      if (hsnFlagged && rateFlagged) break;
    }

    if (above5 && b2b && !inv.irn && inv.grandTotal > 0) {
      const age = ageInDays(inv.date, today);
      issues.push({
        severity: age > 30 ? "error" : "warn",
        title: age > 30 ? "IRN reporting window passed" : "IRN not recorded",
        detail:
          age > 30
            ? `${number} is ${age} days old. Taxpayers with turnover of ₹10 crore or more cannot report an IRN after 30 days.`
            : `${number}: generate the IRN on the e-invoice portal and save it here.`,
      });
    }
    if (!isNote(inv) && inv.grandTotal >= 50000 && !inv.ewayBillNo) {
      issues.push({
        severity: "warn",
        title: "E-way bill not recorded",
        detail: `${number} is ₹50,000 or more. Record the e-way number if goods are moving.`,
      });
    }
  }

  for (const [key, count] of seen) {
    if (count > 1) {
      const number = key.slice(key.indexOf("|") + 1);
      issues.push({
        severity: "error",
        title: "Duplicate invoice number",
        detail: `${number} is used more than once. Numbers must be unique in a financial year.`,
      });
    }
  }

  for (const p of data.purchases || []) {
    if (p.supplierGstin && !isValidGstin(p.supplierGstin)) {
      issues.push({ severity: "error", title: "Supplier GSTIN looks wrong", detail: `${p.supplierName}: ${p.supplierGstin}` });
    }
    if (p.itcEligible !== false && !p.supplierGstin) {
      issues.push({
        severity: "warn",
        title: "ITC claimed without supplier GSTIN",
        detail: `${p.purchaseNumber} needs the supplier GSTIN and their invoice number.`,
      });
    }
    // Rule 37 / Section 16(2): pay the supplier within 180 days or reverse the ITC.
    const billDate = p.supplierInvoiceDate || p.createdAt;
    const unpaid = (p.totalAmount || 0) - (p.paidAmount ?? p.totalAmount ?? 0);
    const age = ageInDays(billDate, today);
    if (p.itcEligible !== false && p.supplierGstin && unpaid > 0.5 && age > 180) {
      issues.push({
        severity: "error",
        title: "Unpaid supplier bill past 180 days",
        detail: `${p.purchaseNumber} (${p.supplierName}) is ${age} days old with ₹${unpaid.toFixed(2)} unpaid. Reverse the ITC in GSTR-3B (Rule 37) until you pay.`,
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
        title: "Credit note after the Section 34 deadline",
        detail: `${cn.creditNoteNumber} is dated after ${deadline}; it cannot reduce GST on ${original.invoiceNumber}.`,
      });
    }
  }

  const noteDocs = notesAsInvoices(data);
  for (const note of noteDocs) {
    if (!note.partyGstin && !note.placeOfSupply) {
      issues.push({
        severity: "warn",
        title: `${note.type === "credit_note" ? "Credit" : "Debit"} note not linked to a bill`,
        detail: `${note.invoiceNumber} should point at the original invoice so GSTR-1 reports it correctly.`,
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
    if (p.itcEligible === false) return { ...base, status: "blocked", reason: "Marked not eligible for ITC" };
    if (!p.supplierGstin) return { ...base, status: "missing", reason: "Add supplier GSTIN" };
    if (!isValidGstin(p.supplierGstin)) return { ...base, status: "missing", reason: "Supplier GSTIN fails the check digit" };
    if (!p.supplierInvoiceNumber) return { ...base, status: "missing", reason: "Add supplier invoice number to match 2B" };
    if (p.reverseCharge) return { ...base, status: "eligible", reason: "RCM: pay tax in cash, then claim ITC" };
    return { ...base, status: "eligible", reason: "Ready to match on GSTIN + invoice number" };
  });
}

export function invoiceNeedsPortal(inv: Invoice, above5: boolean): boolean {
  return (above5 && !inv.irn) || (inv.grandTotal >= 50000 && !inv.ewayBillNo);
}
