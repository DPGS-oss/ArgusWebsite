function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function rowDate(row) {
  return String(row?.date || row?.createdAt || row?.created_at || '').slice(0, 10);
}

function inRange(row, from, to) {
  const d = rowDate(row);
  if (!d) return true;
  return d >= from && d <= to;
}

function pickBusinessProfile(appData, ownerProfile) {
  const data = appData || {};
  const businesses = Array.isArray(data.businesses) ? data.businesses : [];
  const activeId = data.activeBusinessId;
  const active = businesses.find((b) => b && b.id === activeId) || businesses[0] || null;
  return {
    name: active?.name || ownerProfile?.business_name || ownerProfile?.name || '',
    gstin: active?.gstin || ownerProfile?.gstin || '',
    pan: active?.pan || '',
    email: active?.email || ownerProfile?.email || '',
    phone: active?.phone || ownerProfile?.phone || '',
    address: [active?.address, active?.city, active?.state, active?.pincode].filter(Boolean).join(', '),
    state: active?.state || '',
    stateCode: active?.stateCode || '',
    bankName: active?.bankName || '',
    bankIfsc: active?.bankIfsc || '',
    upiId: active?.upiId || '',
  };
}

function buildCaReport(appData, from, to) {
  const data = appData || {};
  const invoices = (data.invoices || []).filter((row) => inRange(row, from, to));
  const purchases = (data.purchases || []).filter((row) => inRange(row, from, to));
  const expenses = (data.expenses || []).filter((row) => inRange(row, from, to));
  const khata = (data.khataEntries || data.khata || []).filter((row) => inRange(row, from, to));
  const stock = data.stock || data.inventory || [];

  let sales = 0;
  let salesTax = 0;
  let unpaid = 0;
  for (const inv of invoices) {
    sales += num(inv.grandTotal ?? inv.total_amount);
    salesTax += num(inv.totalTax ?? inv.total_gst_amount);
    unpaid += num(inv.balanceDue);
  }

  let purchaseTotal = 0;
  let purchaseTax = 0;
  for (const p of purchases) {
    purchaseTotal += num(p.totalAmount ?? p.total_amount ?? p.grandTotal);
    purchaseTax += num(p.totalGstAmount ?? p.total_gst_amount ?? p.totalTax);
  }

  let expenseTotal = 0;
  for (const e of expenses) {
    expenseTotal += num(e.amount);
  }

  let khataDebit = 0;
  let khataCredit = 0;
  for (const k of khata) {
    const amt = num(k.amount);
    if (k.isCredit) khataCredit += amt;
    else khataDebit += amt;
  }

  const lowStock = stock.filter((s) => {
    const current = num(s.currentStock ?? s.quantity ?? s.qty);
    const min = num(s.minStock ?? s.reorderLevel ?? 0);
    return min > 0 && current <= min;
  }).length;

  const parties = Array.isArray(data.parties) ? data.parties.length : 0;

  return {
    period: { from, to },
    sales_total: round2(sales),
    sales_tax: round2(salesTax),
    purchases_total: round2(purchaseTotal),
    purchase_tax: round2(purchaseTax),
    expenses_total: round2(expenseTotal),
    gst_payable_estimate: round2(Math.max(0, salesTax - purchaseTax)),
    outstanding_invoices: round2(unpaid),
    khata_net: round2(khataDebit - khataCredit),
    invoice_count: invoices.length,
    purchase_count: purchases.length,
    expense_count: expenses.length,
    party_count: parties,
    low_stock_items: lowStock,
    inventory_skus: stock.length,
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = { pickBusinessProfile, buildCaReport, inRange, rowDate, num };
