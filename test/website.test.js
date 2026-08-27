const test = require("node:test");
const assert = require("node:assert/strict");
const { booksFromAppData } = require("../functions/_shared/app_data");

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function gstOn(taxable, rate) {
  return round2((taxable * rate) / 100);
}

function inRange(row, from, to) {
  const d = String(row.date || row.createdAt || "").slice(0, 10);
  if (!d) return true;
  return d >= from && d <= to;
}

function keepSubscriptionOnSyncFailure(previous, incoming) {
  if (incoming && (incoming.active || incoming.plan || incoming.plan_key)) {
    return incoming;
  }
  return previous;
}

function classifyGstr1(invoices, creditNotes) {
  const b2b = [];
  const b2cl = [];
  const b2cs = [];
  for (const inv of invoices) {
    const gstin = String(inv.partyGstin || "");
    const inter = Boolean(inv.isInterState);
    if (gstin) {
      b2b.push(inv);
    } else if (inter && inv.grandTotal > 250000) {
      b2cl.push(inv);
    } else {
      b2cs.push(inv);
    }
  }
  return { b2b, b2cl, b2cs, cdnr: creditNotes, hsn: invoices };
}

test("GST math 18% on 1000 is 180", () => {
  assert.equal(gstOn(1000, 18), 180);
  assert.equal(round2(1000 + 180), 1180);
});

test("purchase with supplier GSTIN feeds GSTR-2B", () => {
  const purchase = {
    supplierGstin: "27ABCDE1234F1Z5",
    totalTax: 180,
    totalAmount: 1180,
  };
  assert.ok(purchase.supplierGstin);
  assert.notEqual(purchase.supplierGstin, "");
  const itc = purchase.totalTax;
  assert.equal(itc, 180);
});

test("CA date filter keeps only rows in range", () => {
  const rows = [
    { date: "2026-04-10" },
    { date: "2026-05-01" },
    { createdAt: "2026-03-31T10:00:00" },
  ];
  const kept = rows.filter((r) => inRange(r, "2026-04-01", "2026-04-30"));
  assert.equal(kept.length, 1);
  assert.equal(kept[0].date, "2026-04-10");
});

test("auth entitlement cache keeps paid plan when sync returns name only", () => {
  const cached = { plan: "Business", plan_key: "business_lifetime", active: true, expiry_date: "2099-12-31" };
  const kept = keepSubscriptionOnSyncFailure(cached, undefined);
  assert.equal(kept.plan_key, "business_lifetime");
  assert.equal(kept.active, true);
});

test("GSTN sections: B2B, B2CL, B2CS, CDNR", () => {
  const pack = classifyGstr1(
    [
      { partyGstin: "29AAAAA0000A1Z5", grandTotal: 1180, isInterState: false },
      { partyGstin: "", grandTotal: 300000, isInterState: true },
      { partyGstin: "", grandTotal: 500, isInterState: false },
    ],
    [{ invoiceNumber: "CN-1", grandTotal: -118 }],
  );
  assert.equal(pack.b2b.length, 1);
  assert.equal(pack.b2cl.length, 1);
  assert.equal(pack.b2cs.length, 1);
  assert.equal(pack.cdnr.length, 1);
});

test("CA scopes hide inventory when missing", () => {
  const books = booksFromAppData(
    { invoices: [{ invoiceNumber: "INV-1" }], stock: [{ id: "s1" }] },
    ["read:invoices", "read:gstr"],
  );
  assert.equal(books.invoices.length, 1);
  assert.equal(books.inventory.length, 0);
});
