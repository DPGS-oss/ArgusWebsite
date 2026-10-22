/** Shop-owned UPI collect. Argus only builds `upi://pay` — no PSP or payment links. */

export type BuildUpiPayInput = {
  vpa?: string | null;
  amount: number;
  invoiceNumber: string;
};

export function normalizeVpa(vpa?: string | null): string {
  return (vpa || "").trim();
}

export function buildUpiPayUri(input: BuildUpiPayInput): string | null {
  const pa = normalizeVpa(input.vpa);
  if (!pa) return null;
  const amount = Number.isFinite(input.amount) ? Math.max(0, input.amount) : 0;
  // Nothing owed: no pay link (a receipt for a paid bill must not ask again).
  if (!(amount > 0)) return null;
  const am = amount.toFixed(2);
  const tn = (input.invoiceNumber || "").trim() || "INV";
  return `upi://pay?pa=${encodeURIComponent(pa)}&am=${encodeURIComponent(am)}&tn=${encodeURIComponent(tn)}&cu=INR`;
}

export type WhatsAppInvoiceTextInput = {
  invoiceNumber: string;
  businessName: string;
  grandTotalLabel: string;
  upiUri: string | null;
  extraLines?: string;
};

export function buildWhatsAppInvoiceText(input: WhatsAppInvoiceTextInput): string {
  const lines = [
    `*Invoice ${input.invoiceNumber}*`,
    `*From:* ${input.businessName}`,
    input.extraLines || "",
    `*Grand Total:* ${input.grandTotalLabel}`,
  ].filter((line) => line !== "");

  if (input.upiUri) {
    lines.push("", "Pay via UPI:", input.upiUri);
  }

  return lines.join("\n");
}

/**
 * What is still owed on a bill, for its UPI pay link: nothing on a bill that
 * is paid or cancelled (a receipt must not ask for the money again), the
 * balance on one paid in part, the total on an unpaid one.
 */
export function amountToCollect(bill: { status?: string; grandTotal: number; balanceDue?: number; paidAmount?: number }): number {
  if (bill.status === "cancelled" || bill.status === "paid") return 0;
  const balance = Number(bill.balanceDue);
  if (Number.isFinite(balance) && balance > 0.004) return Math.round(balance * 100) / 100;
  // Older bills kept no balance: unpaid with nothing received means the whole bill.
  if (!(Number(bill.paidAmount) > 0)) return Math.max(0, bill.grandTotal || 0);
  return 0;
}

/** wa.me needs the full number with country code; Indian numbers are often saved as 10 digits. */
export function whatsAppNumber(phone: string | undefined): string {
  let digits = (phone || "").replace(/[^0-9]/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = `91${digits}`;
  return digits;
}

export function buildWhatsAppShareUrl(phone: string | undefined, message: string): string {
  const encodedMsg = encodeURIComponent(message);
  const digits = whatsAppNumber(phone);
  return digits
    ? `https://wa.me/${digits}?text=${encodedMsg}`
    : `https://web.whatsapp.com/send?text=${encodedMsg}`;
}
