import type { AppData, Invoice, Purchase } from "./types";

export type Issue = { severity: "error" | "warn"; title: string; detail: string };

const GST20 = new Date("2025-09-22T00:00:00");
const HISTORICAL = new Set([12, 28]);

function afterGst20(date: string): boolean {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return true;
  return d >= GST20;
}

function financialYear(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "unknown";
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return String(y);
}

function validGstin(raw: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(raw.trim().toUpperCase());
}

export function checkBooks(data: AppData): Issue[] {
  const issues: Issue[] = [];
  const seller = data.businesses.find((b) => b.id === data.activeBusinessId)?.gstin || "";
  const above5 = !!data.settings.turnoverAbove5Cr;
  const minHsn = above5 ? 6 : 4;

  if (seller && !validGstin(seller)) {
    issues.push({
      severity: "error",
      title: "Seller GSTIN is not valid",
      detail: "A GSTIN is 15 characters. Fix it in Business before you file.",
    });
  }

  const seen = new Map<string, number>();
  for (const inv of data.invoices) {
    if (inv.status === "draft" || inv.status === "cancelled") continue;
    const number = (inv.invoiceNumber || "").trim();
    if (!number) {
      issues.push({ severity: "error", title: "Invoice has no number", detail: "Rule 46 requires a unique invoice number." });
    } else if (number.length > 16) {
      issues.push({
        severity: "error",
        title: "Invoice number longer than 16 characters",
        detail: `${number} will be rejected on the GST portal and for IRN.`,
      });
    }
    if (number) {
      // Numbers only need to be unique within a financial year (Apr–Mar).
      const key = `${financialYear(inv.date)}|${number.toUpperCase()}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    }

    if (!inv.placeOfSupply && inv.totalTax > 0) {
      issues.push({
        severity: "warn",
        title: "Missing place of supply",
        detail: `${number} needs place of supply so CGST/SGST vs IGST is clear.`,
      });
    }

    let hsnFlagged = false;
    let rateFlagged = false;
    for (const item of inv.items) {
      const hsn = (item.hsn || "").replace(/\s/g, "");
      if (!hsnFlagged && (!hsn || hsn.length < minHsn)) {
        hsnFlagged = true;
        issues.push({
          severity: "warn",
          title: `HSN too short on ${number}`,
          detail: `Use at least ${minHsn} digits${above5 ? " (turnover above ₹5 crore)" : ""}.`,
        });
      }
      if (!rateFlagged && afterGst20(inv.date) && HISTORICAL.has(item.gstRate)) {
        rateFlagged = true;
        issues.push({
          severity: "error",
          title: "Old GST rate on a new bill",
          detail: `${number} uses ${item.gstRate}%. From 22 Sep 2025 use 0, 5, 18, or 40.`,
        });
      }
      if (hsnFlagged && rateFlagged) break;
    }

    if (above5 && !inv.irn && inv.grandTotal > 0) {
      issues.push({
        severity: "warn",
        title: "IRN not recorded",
        detail: `${number} — generate the IRN on the e-invoice portal and save it here.`,
      });
    }
    if (inv.grandTotal >= 50000 && !inv.ewayBillNo) {
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
    if (p.supplierGstin && !validGstin(p.supplierGstin)) {
      issues.push({ severity: "error", title: "Supplier GSTIN looks wrong", detail: `${p.supplierName}: ${p.supplierGstin}` });
    }
    if (p.itcEligible !== false && !p.supplierGstin) {
      issues.push({
        severity: "warn",
        title: "ITC claimed without supplier GSTIN",
        detail: `${p.purchaseNumber} needs the supplier GSTIN and their invoice number.`,
      });
    }
  }

  for (const cn of data.creditNotes || []) {
    if (!cn.invoiceId) {
      issues.push({
        severity: "warn",
        title: "Credit note not linked to a bill",
        detail: `${cn.creditNoteNumber} should point at the original invoice.`,
      });
    }
  }
  for (const dn of data.debitNotes || []) {
    if (!dn.invoiceId) {
      issues.push({
        severity: "warn",
        title: "Debit note not linked to a bill",
        detail: `${dn.debitNoteNumber} should point at the original invoice.`,
      });
    }
  }

  return issues;
}

export function gstr3b(data: AppData) {
  let taxable = 0;
  let nil = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  for (const inv of data.invoices) {
    if (inv.status === "draft" || inv.status === "cancelled") continue;
    if (inv.totalTax <= 0) nil += inv.grandTotal;
    else {
      taxable += Math.max(0, inv.grandTotal - inv.totalTax);
      cgst += inv.totalCgst;
      sgst += inv.totalSgst;
      igst += inv.totalIgst;
    }
  }
  let rcm = 0;
  let eligible = 0;
  let blocked = 0;
  for (const p of data.purchases || []) {
    if (p.reverseCharge) rcm += p.totalGstAmount;
    if (p.itcEligible === false || !p.supplierGstin) blocked += p.totalGstAmount;
    else eligible += p.totalGstAmount;
  }
  const credit = (data.creditNotes || []).reduce((s, n) => s + n.totalGstAmount, 0);
  const debit = (data.debitNotes || []).reduce((s, n) => s + n.totalGstAmount, 0);
  return { taxable, nil, cgst, sgst, igst, rcm, eligible, blocked, credit, debit, net: cgst + sgst + igst + debit + rcm - credit - eligible };
}

export function purchaseMatch(purchases: Purchase[]) {
  return (purchases || []).map((p) => {
    if (p.itcEligible === false) return { purchase: p, status: "blocked", reason: "Marked not eligible for ITC" };
    if (!p.supplierGstin) return { purchase: p, status: "missing", reason: "Add supplier GSTIN" };
    if (!p.supplierInvoiceNumber) return { purchase: p, status: "missing", reason: "Add supplier invoice number to match 2B" };
    if (p.reverseCharge) return { purchase: p, status: "eligible", reason: "RCM — pay tax, then claim ITC if eligible" };
    return { purchase: p, status: "eligible", reason: "Ready to match on GSTIN + invoice number" };
  });
}

export function invoiceNeedsPortal(inv: Invoice, above5: boolean): boolean {
  return (above5 && !inv.irn) || (inv.grandTotal >= 50000 && !inv.ewayBillNo);
}
