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

export function buildWhatsAppShareUrl(phone: string | undefined, message: string): string {
  const encodedMsg = encodeURIComponent(message);
  const digits = (phone || "").replace(/[^0-9]/g, "");
  return digits
    ? `https://wa.me/${digits}?text=${encodedMsg}`
    : `https://web.whatsapp.com/send?text=${encodedMsg}`;
}
