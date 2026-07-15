import type { GSTRate, HSNCode, Invoice, InvoiceItem, GSTRReport, GSTRSection, GSTRReportType } from "./types";

export const HSN_DATABASE: HSNCode[] = [
  { code: "0101", description: "Live animals (bovine)", gstRate: 0, category: "Agriculture" },
  { code: "0102", description: "Live animals (dairy cattle)", gstRate: 0, category: "Agriculture" },
  { code: "0301", description: "Fish, fresh or chilled", gstRate: 5, category: "Food" },
  { code: "0401", description: "Milk and cream", gstRate: 0, category: "Food" },
  { code: "1001", description: "Wheat", gstRate: 0, category: "Food" },
  { code: "1005", description: "Maize (corn)", gstRate: 0, category: "Food" },
  { code: "1006", description: "Rice", gstRate: 0, category: "Food" },
  { code: "1101", description: "Wheat flour", gstRate: 5, category: "Food" },
  { code: "1701", description: "Sugar", gstRate: 5, category: "Food" },
  { code: "1801", description: "Cocoa beans", gstRate: 5, category: "Food" },
  { code: "2101", description: "Coffee, tea, masala", gstRate: 5, category: "Food" },
  { code: "2201", description: "Water, mineral water", gstRate: 18, category: "Beverages" },
  { code: "2203", description: "Beer", gstRate: 28, category: "Beverages" },
  { code: "2401", description: "Tobacco products", gstRate: 28, category: "Tobacco" },
  { code: "2710", description: "Petroleum products", gstRate: 0, category: "Petroleum" },
  { code: "3004", description: "Pharmaceuticals", gstRate: 12, category: "Healthcare" },
  { code: "3005", description: "Medical dressings", gstRate: 12, category: "Healthcare" },
  { code: "3201", description: "Dyes and tanning extracts", gstRate: 18, category: "Chemicals" },
  { code: "3303", description: "Perfumes", gstRate: 18, category: "Cosmetics" },
  { code: "3304", description: "Cosmetics", gstRate: 18, category: "Cosmetics" },
  { code: "3401", description: "Soap and detergents", gstRate: 18, category: "Household" },
  { code: "3917", description: "Plastic pipes and tubes", gstRate: 18, category: "Plastics" },
  { code: "3923", description: "Plastic containers", gstRate: 18, category: "Plastics" },
  { code: "4011", description: "Rubber tyres", gstRate: 28, category: "Rubber" },
  { code: "4202", description: "Leather bags, suitcases", gstRate: 18, category: "Leather" },
  { code: "4303", description: "Leather garments", gstRate: 12, category: "Leather" },
  { code: "4801", description: "Paper and paperboard", gstRate: 12, category: "Paper" },
  { code: "4818", description: "Paper napkins, tissues", gstRate: 12, category: "Paper" },
  { code: "4901", description: "Printed books", gstRate: 0, category: "Printing" },
  { code: "6101", description: "Men's garments, cotton", gstRate: 5, category: "Textiles" },
  { code: "6102", description: "Women's garments, cotton", gstRate: 5, category: "Textiles" },
  { code: "6109", description: "T-shirts, cotton", gstRate: 5, category: "Textiles" },
  { code: "6115", description: "Hosiery and socks", gstRate: 5, category: "Textiles" },
  { code: "6201", description: "Men's garments, synthetic", gstRate: 18, category: "Textiles" },
  { code: "6204", description: "Women's garments, synthetic", gstRate: 18, category: "Textiles" },
  { code: "6401", description: "Footwear (below Rs 1000)", gstRate: 5, category: "Footwear" },
  { code: "6402", description: "Footwear (above Rs 1000)", gstRate: 18, category: "Footwear" },
  { code: "6810", description: "Cement articles", gstRate: 18, category: "Construction" },
  { code: "6811", description: "Asbestos cement", gstRate: 18, category: "Construction" },
  { code: "6907", description: "Ceramic tiles", gstRate: 18, category: "Construction" },
  { code: "6910", description: "Ceramic sanitary ware", gstRate: 18, category: "Construction" },
  { code: "7017", description: "Glass laboratory ware", gstRate: 18, category: "Glass" },
  { code: "7108", description: "Gold and gold jewellery", gstRate: 3, category: "Jewellery" },
  { code: "7113", description: "Jewellery", gstRate: 3, category: "Jewellery" },
  { code: "7213", description: "Iron and steel bars", gstRate: 18, category: "Metals" },
  { code: "7308", description: "Steel structures", gstRate: 18, category: "Metals" },
  { code: "7310", description: "Steel containers", gstRate: 18, category: "Metals" },
  { code: "7326", description: "Steel articles", gstRate: 18, category: "Metals" },
  { code: "7408", description: "Copper wire", gstRate: 18, category: "Metals" },
  { code: "7610", description: "Aluminium structures", gstRate: 18, category: "Metals" },
  { code: "8418", description: "Refrigerators", gstRate: 18, category: "Appliances" },
  { code: "8421", description: "Water purifiers", gstRate: 18, category: "Appliances" },
  { code: "8443", description: "Printers", gstRate: 18, category: "Electronics" },
  { code: "8467", description: "Power tools", gstRate: 18, category: "Tools" },
  { code: "8471", description: "Computers and laptops", gstRate: 18, category: "Electronics" },
  { code: "8473", description: "Computer parts", gstRate: 18, category: "Electronics" },
  { code: "8501", description: "Electric motors", gstRate: 18, category: "Electrical" },
  { code: "8504", description: "Transformers, batteries", gstRate: 18, category: "Electrical" },
  { code: "8516", description: "Heaters, geysers", gstRate: 18, category: "Appliances" },
  { code: "8517", description: "Mobile phones", gstRate: 18, category: "Electronics" },
  { code: "8523", description: "Storage devices", gstRate: 18, category: "Electronics" },
  { code: "8528", description: "TV monitors", gstRate: 18, category: "Electronics" },
  { code: "8536", description: "Electrical switches", gstRate: 18, category: "Electrical" },
  { code: "8537", description: "Electrical panels", gstRate: 18, category: "Electrical" },
  { code: "8544", description: "Cables and wires", gstRate: 18, category: "Electrical" },
  { code: "8703", description: "Motor cars", gstRate: 28, category: "Automobile" },
  { code: "8708", description: "Auto parts", gstRate: 28, category: "Automobile" },
  { code: "8711", description: "Motorcycles", gstRate: 28, category: "Automobile" },
  { code: "8712", description: "Bicycles", gstRate: 12, category: "Automobile" },
  { code: "9001", description: "Optical lenses", gstRate: 18, category: "Optical" },
  { code: "9018", description: "Medical instruments", gstRate: 12, category: "Healthcare" },
  { code: "9401", description: "Furniture", gstRate: 18, category: "Furniture" },
  { code: "9405", description: "Lighting fixtures", gstRate: 18, category: "Lighting" },
  { code: "9619", description: "Sanitary pads", gstRate: 12, category: "Healthcare" },
  { code: "9983", description: "IT/ITeS services", gstRate: 18, category: "Services" },
  { code: "9984", description: "Telecommunications", gstRate: 18, category: "Services" },
  { code: "9985", description: "Financial services", gstRate: 18, category: "Services" },
  { code: "9972", description: "Real estate services", gstRate: 18, category: "Services" },
  { code: "9987", description: "Transport services", gstRate: 18, category: "Services" },
  { code: "9992", description: "Accommodation services", gstRate: 18, category: "Services" },
  { code: "9993", description: "Restaurant services", gstRate: 5, category: "Services" },
  { code: "9994", description: "Sale of food", gstRate: 5, category: "Services" },
];

export function searchHSN(query: string): HSNCode[] {
  const q = query.toLowerCase().trim();
  if (!q) return HSN_DATABASE.slice(0, 20);
  return HSN_DATABASE.filter(
    (h) =>
      h.code.includes(q) ||
      h.description.toLowerCase().includes(q) ||
      h.category.toLowerCase().includes(q)
  ).slice(0, 30);
}

export function getHSNByCode(code: string): HSNCode | undefined {
  return HSN_DATABASE.find((h) => h.code === code);
}

export function suggestHSN(description: string): HSNCode[] {
  const words = description.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return [];

  const scored = HSN_DATABASE.map((h) => {
    const desc = h.description.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (desc.includes(word)) score += 1;
      if (h.category.toLowerCase().includes(word)) score += 0.5;
    }
    return { hsn: h, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map((s) => s.hsn);
}

export function calculateItem(item: {
  quantity: number;
  rate: number;
  discount: number;
  gstRate: GSTRate;
  isInterState: boolean;
}): Omit<InvoiceItem, "id" | "description" | "hsn" | "unit"> {
  const grossAmount = item.quantity * item.rate;
  const discountAmount = (grossAmount * item.discount) / 100;
  const taxableAmount = grossAmount - discountAmount;
  const taxAmount = (taxableAmount * item.gstRate) / 100;

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (item.isInterState) {
    igst = taxAmount;
  } else {
    cgst = taxAmount / 2;
    sgst = taxAmount / 2;
  }

  const total = taxableAmount + taxAmount;

  return {
    quantity: item.quantity,
    rate: item.rate,
    discount: item.discount,
    gstRate: item.gstRate,
    taxableAmount: round2(taxableAmount),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    total: round2(total),
  };
}

export function calculateInvoiceTotals(items: InvoiceItem[], roundOffEnabled: boolean) {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.rate, 0);
  const totalDiscount = items.reduce(
    (sum, i) => sum + (i.quantity * i.rate * i.discount) / 100,
    0
  );
  const totalTaxable = items.reduce((sum, i) => sum + i.taxableAmount, 0);
  const totalCgst = items.reduce((sum, i) => sum + i.cgst, 0);
  const totalSgst = items.reduce((sum, i) => sum + i.sgst, 0);
  const totalIgst = items.reduce((sum, i) => sum + i.igst, 0);
  const totalTax = totalCgst + totalSgst + totalIgst;
  const rawTotal = totalTaxable + totalTax;

  let roundOff = 0;
  let grandTotal = rawTotal;

  if (roundOffEnabled) {
    grandTotal = Math.round(rawTotal);
    roundOff = round2(grandTotal - rawTotal);
  }

  return {
    subtotal: round2(subtotal),
    totalDiscount: round2(totalDiscount),
    totalTaxable: round2(totalTaxable),
    totalCgst: round2(totalCgst),
    totalSgst: round2(totalSgst),
    totalIgst: round2(totalIgst),
    totalTax: round2(totalTax),
    roundOff: round2(roundOff),
    grandTotal: round2(grandTotal),
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-IN").format(num);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function round2(num: number): number {
  return Math.round(num * 100) / 100;
}

export function isInterState(businessStateCode: string, partyStateCode: string): boolean {
  return businessStateCode !== partyStateCode;
}

export function generateGSTRReport(
  invoices: Invoice[],
  type: GSTRReportType,
  fromDate: string,
  toDate: string
): GSTRReport {
  const filtered = invoices.filter((inv) => {
    if (inv.status === "draft" || inv.status === "cancelled") return false;
    return inv.date >= fromDate && inv.date <= toDate;
  });

  const period = `${formatDate(fromDate)} - ${formatDate(toDate)}`;

  const sections: GSTRSection[] = [];

  if (type === "gstr1") {
    const b2b = filtered.filter((i) => i.partyGstin && i.partyGstin.length > 0);
    const b2c = filtered.filter((i) => !i.partyGstin || i.partyGstin.length === 0);
    const creditNotes = filtered.filter((i) => i.type === "credit_note");

    sections.push(buildSection("B2B", "Business to Business Invoices", b2b));
    sections.push(buildSection("B2C", "Business to Consumer Invoices", b2c));
    if (creditNotes.length > 0) {
      sections.push(buildSection("CDNR", "Credit Notes and Debit Notes", creditNotes));
    }
  } else if (type === "gstr3b") {
    const intraState = filtered.filter((i) => !i.isInterState);
    const interState = filtered.filter((i) => i.isInterState);

    sections.push(buildSection("3.1(a)", "Outward taxable supplies (intra-state)", intraState));
    sections.push(buildSection("3.1(b)", "Outward taxable supplies (inter-state)", interState));
  } else if (type === "gstr2b") {
    sections.push(buildSection("ITC", "Input Tax Credit available", filtered));
  } else if (type === "gstr4") {
    sections.push(buildSection("4(a)", "Outward supplies", filtered));
  }

  const totalTaxableValue = filtered.reduce((s, i) => s + i.totalTaxable, 0);
  const totalCgst = filtered.reduce((s, i) => s + i.totalCgst, 0);
  const totalSgst = filtered.reduce((s, i) => s + i.totalSgst, 0);
  const totalIgst = filtered.reduce((s, i) => s + i.totalIgst, 0);
  const totalTax = totalCgst + totalSgst + totalIgst;
  const totalInvoiceValue = filtered.reduce((s, i) => s + i.grandTotal, 0);

  return {
    type,
    period,
    fromDate,
    toDate,
    totalInvoices: filtered.length,
    totalTaxableValue: round2(totalTaxableValue),
    totalCgst: round2(totalCgst),
    totalSgst: round2(totalSgst),
    totalIgst: round2(totalIgst),
    totalTax: round2(totalTax),
    totalInvoiceValue: round2(totalInvoiceValue),
    sections,
  };
}

function buildSection(section: string, description: string, invoices: Invoice[]): GSTRSection {
  const taxableValue = invoices.reduce((s, i) => s + i.totalTaxable, 0);
  const cgst = invoices.reduce((s, i) => s + i.totalCgst, 0);
  const sgst = invoices.reduce((s, i) => s + i.totalSgst, 0);
  const igst = invoices.reduce((s, i) => s + i.totalIgst, 0);
  const tax = cgst + sgst + igst;
  const invoiceValue = invoices.reduce((s, i) => s + i.grandTotal, 0);

  return {
    section,
    description,
    invoices,
    taxableValue: round2(taxableValue),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    tax: round2(tax),
    invoiceValue: round2(invoiceValue),
  };
}

export function generateInvoiceHTML(invoice: Invoice, business: {
  name: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  upiId?: string;
}): string {
  const itemsRows = invoice.items
    .map(
      (item) => `
    <tr>
      <td>${item.description}</td>
      <td style="text-align:center">${item.hsn}</td>
      <td style="text-align:right">${item.quantity} ${item.unit}</td>
      <td style="text-align:right">${formatCurrency(item.rate)}</td>
      <td style="text-align:right">${item.discount}%</td>
      <td style="text-align:right">${formatCurrency(item.taxableAmount)}</td>
      <td style="text-align:center">${item.gstRate}%</td>
      ${
        invoice.isInterState
          ? `<td style="text-align:right">${formatCurrency(item.igst)}</td><td style="text-align:right">-</td><td style="text-align:right">-</td>`
          : `<td style="text-align:right">${formatCurrency(item.cgst)}</td><td style="text-align:right">${formatCurrency(item.sgst)}</td><td style="text-align:right">-</td>`
      }
      <td style="text-align:right"><strong>${formatCurrency(item.total)}</strong></td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${invoice.invoiceNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; color: #333; }
  .invoice { max-width: 900px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 3px solid #5266eb; padding-bottom: 20px; }
  .header h1 { color: #5266eb; font-size: 28px; }
  .header .invoice-type { color: #666; font-size: 14px; text-transform: uppercase; }
  .business-info h2 { font-size: 20px; color: #333; }
  .business-info p { font-size: 13px; color: #666; line-height: 1.6; }
  .invoice-meta { text-align: right; }
  .invoice-meta h3 { font-size: 22px; color: #5266eb; }
  .invoice-meta p { font-size: 13px; color: #666; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 25px; }
  .party-box { width: 48%; }
  .party-box h4 { font-size: 12px; text-transform: uppercase; color: #999; margin-bottom: 8px; }
  .party-box p { font-size: 13px; color: #333; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #5266eb; color: #fff; padding: 10px 8px; font-size: 12px; text-align: left; }
  td { padding: 10px 8px; font-size: 12px; border-bottom: 1px solid #eee; }
  .totals { margin-left: auto; width: 300px; }
  .totals table { width: 100%; }
  .totals td { border: none; padding: 6px 10px; font-size: 13px; }
  .totals .grand-total { background: #5266eb; color: #fff; font-size: 16px; font-weight: bold; }
  .bank-details { margin-top: 30px; padding: 15px; background: #f9f9f9; border-radius: 6px; }
  .bank-details h4 { font-size: 13px; margin-bottom: 8px; color: #333; }
  .bank-details p { font-size: 12px; color: #666; line-height: 1.8; }
  .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #999; }
  .notes { margin-top: 20px; font-size: 12px; color: #666; }
  .notes p { margin-bottom: 5px; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
  .status-paid { background: #d4edda; color: #155724; }
  .status-unpaid { background: #f8d7da; color: #721c24; }
  .status-draft { background: #e2e3e5; color: #383d41; }
</style>
</head>
<body>
<div class="invoice">
  <div class="header">
    <div class="business-info">
      <h1>Argus</h1>
      <h2>${business.name}</h2>
      <p>${business.address}<br>${business.city}, ${business.state} - ${business.pincode}<br>GSTIN: ${business.gstin}<br>Phone: ${business.phone} | Email: ${business.email}</p>
    </div>
    <div class="invoice-meta">
      <h3>${invoice.invoiceNumber}</h3>
      <p><strong>Type:</strong> ${invoice.type.replace(/_/g, " ").toUpperCase()}</p>
      <p><strong>Date:</strong> ${formatDate(invoice.date)}</p>
      <p><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</p>
      <p><span class="status-badge status-${invoice.status}">${invoice.status}</span></p>
    </div>
  </div>
  <div class="parties">
    <div class="party-box">
      <h4>Bill To</h4>
      <p><strong>${invoice.partyName || "—"}</strong>${invoice.partyPhone ? `<br>Phone: ${invoice.partyPhone}` : ""}<br>GSTIN: ${invoice.partyGstin || "Unregistered"}<br>Place of Supply: ${invoice.placeOfSupply}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>HSN</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Disc%</th>
        <th>Taxable</th>
        <th>GST%</th>
        <th>CGST</th>
        <th>SGST</th>
        <th>IGST</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>
  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td style="text-align:right">${formatCurrency(invoice.subtotal)}</td></tr>
      ${invoice.totalDiscount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${formatCurrency(invoice.totalDiscount)}</td></tr>` : ""}
      <tr><td>Taxable Amount</td><td style="text-align:right">${formatCurrency(invoice.totalTaxable)}</td></tr>
      ${invoice.totalCgst > 0 ? `<tr><td>CGST</td><td style="text-align:right">${formatCurrency(invoice.totalCgst)}</td></tr>` : ""}
      ${invoice.totalSgst > 0 ? `<tr><td>SGST</td><td style="text-align:right">${formatCurrency(invoice.totalSgst)}</td></tr>` : ""}
      ${invoice.totalIgst > 0 ? `<tr><td>IGST</td><td style="text-align:right">${formatCurrency(invoice.totalIgst)}</td></tr>` : ""}
      ${invoice.roundOff !== 0 ? `<tr><td>Round Off</td><td style="text-align:right">${formatCurrency(invoice.roundOff)}</td></tr>` : ""}
      <tr class="grand-total"><td>Grand Total</td><td style="text-align:right">${formatCurrency(invoice.grandTotal)}</td></tr>
      ${invoice.paidAmount > 0 ? `<tr><td>Paid</td><td style="text-align:right">${formatCurrency(invoice.paidAmount)}</td></tr>` : ""}
      ${invoice.balanceDue > 0 ? `<tr><td>Balance Due</td><td style="text-align:right">${formatCurrency(invoice.balanceDue)}</td></tr>` : ""}
    </table>
  </div>
  ${business.bankName ? `<div class="bank-details">
    <h4>Bank Details</h4>
    <p>Bank: ${business.bankName} | Account: ${business.bankAccount} | IFSC: ${business.bankIfsc}<br>UPI: ${business.upiId || "N/A"}</p>
  </div>` : ""}
  ${invoice.notes ? `<div class="notes"><p><strong>Notes:</strong> ${invoice.notes}</p></div>` : ""}
  ${invoice.terms ? `<div class="notes"><p><strong>Terms:</strong> ${invoice.terms}</p></div>` : ""}
  <div class="footer">
    <p>This is a computer-generated invoice from Argus GST Billing App</p>
    <p>© ${new Date().getFullYear()} ${business.name}</p>
  </div>
</div>
</body>
</html>`;
}
