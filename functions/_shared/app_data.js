/**
 * Resolve the canonical website AppData blob from a Firestore app_data/main doc.
 * Prefers `appData`; falls back to gzip `data_compressed` or legacy `data`.
 */
const zlib = require('zlib');

function flutterPayloadToAppData(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (Array.isArray(parsed.parties) || parsed.invoiceNumber || parsed.grandTotal) {
    return parsed;
  }
  const invoices = (parsed.invoices || []).map((inv) => ({
    ...inv,
    invoiceNumber: inv.invoiceNumber || inv.invoice_number || '',
    partyName: inv.partyName || inv.customer_name || inv.customerName || '',
    grandTotal: inv.grandTotal ?? inv.total_amount ?? inv.totalAmount ?? 0,
    totalTax: inv.totalTax ?? inv.total_gst_amount ?? 0,
    date: inv.date || String(inv.created_at || inv.createdAt || '').slice(0, 10),
    placeOfSupply: inv.placeOfSupply || inv.place_of_supply || '',
    createdAt: inv.createdAt || inv.created_at || '',
  }));
  const parties = parsed.parties || (parsed.customers || []).map((c) => ({
    id: c.id,
    name: c.name,
    gstin: c.gstin || '',
    phone: c.phone || '',
    email: c.email || '',
    address: c.billing_address || c.address || '',
    type: 'customer',
  }));
  return {
    businesses: parsed.businesses || [],
    parties,
    invoices,
    stock: parsed.stock || parsed.inventory || [],
    activeBusinessId: parsed.activeBusinessId || null,
    invoiceCounter: parsed.invoiceCounter || invoices.length,
    settings: parsed.settings || {},
    creditNotes: parsed.creditNotes || [],
    deliveryChallans: parsed.deliveryChallans || [],
    expenses: parsed.expenses || [],
    quotes: parsed.quotes || [],
    purchases: parsed.purchases || [],
    payments: parsed.payments || [],
    templates: parsed.templates || [],
    khataEntries: parsed.khataEntries || parsed.khata || [],
  };
}

function resolveAppData(docData) {
  if (!docData || typeof docData !== 'object') return null;
  if (docData.appData && typeof docData.appData === 'object') {
    return flutterPayloadToAppData(docData.appData);
  }
  if (docData.data_compressed) {
    try {
      const buf = zlib.gunzipSync(Buffer.from(String(docData.data_compressed), 'base64'));
      return flutterPayloadToAppData(JSON.parse(buf.toString('utf8')));
    } catch (_) {
      return null;
    }
  }
  if (docData.data && typeof docData.data === 'object') {
    return flutterPayloadToAppData(docData.data);
  }
  return null;
}

const DEFAULT_SCOPES = [
  'read:invoices',
  'read:purchases',
  'read:expenses',
  'read:khata',
  'read:gstr',
  'read:inventory',
];

function pickBusinessProfile(appData) {
  const data = appData || {};
  const businesses = Array.isArray(data.businesses) ? data.businesses : [];
  const activeId = data.activeBusinessId;
  const active = businesses.find((b) => b && b.id === activeId) || businesses[0] || null;
  if (!active) return null;
  return {
    id: active.id || '',
    name: active.name || '',
    gstin: active.gstin || '',
    pan: active.pan || '',
    email: active.email || '',
    phone: active.phone || '',
    address: active.address || '',
    city: active.city || '',
    state: active.state || '',
    stateCode: active.stateCode || '',
    pincode: active.pincode || '',
    bankName: active.bankName || '',
    bankIfsc: active.bankIfsc || '',
    upiId: active.upiId || '',
  };
}

function booksFromAppData(appData, scopes) {
  const data = appData || {};
  const allowed = new Set(Array.isArray(scopes) && scopes.length ? scopes : DEFAULT_SCOPES);
  const books = {
    read_only: true,
    business_profile: pickBusinessProfile(data),
    settings: data.settings || {},
    invoices: allowed.has('read:invoices') ? (data.invoices || []) : [],
    purchases: allowed.has('read:purchases') ? (data.purchases || []) : [],
    expenses: allowed.has('read:expenses') ? (data.expenses || []) : [],
    khata: allowed.has('read:khata') ? (data.khataEntries || data.khata || []) : [],
    inventory: allowed.has('read:inventory') ? (data.stock || []) : [],
    parties: data.parties || [],
    payments: data.payments || [],
    creditNotes: data.creditNotes || [],
    scopes: Array.from(allowed),
  };
  return books;
}

module.exports = {
  resolveAppData,
  flutterPayloadToAppData,
  booksFromAppData,
  pickBusinessProfile,
  DEFAULT_SCOPES,
};
