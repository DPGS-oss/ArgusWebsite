/**
 * End-to-end check of shared books against the LOCAL emulators (run
 * scripts/emulator-seed.js first). Plays the owner's phone, the staff
 * member's phone and the website, and prints PASS/FAIL per step.
 */
const FN = 'http://127.0.0.1:5001/argus-invocing/us-central1';
const AUTH = 'http://127.0.0.1:9099';
const PASSWORD = 'argus-emulator-test-1';

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  — ${extra}` : ''}`);
};

async function token(email) {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const j = await res.json();
  return { token: j.idToken, uid: j.localId };
}

async function call(who, fn, path, body, method) {
  const res = await fetch(`${FN}/${fn}${path}`, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: { Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const bill = (id, number, total, date = '2026-10-10T10:00:00.000') => {
  const taxable = Math.round((total / 1.05) * 100) / 100;
  const tax = Math.round((total - taxable) * 100) / 100;
  const half = Math.round((tax / 2) * 100) / 100;
  return {
    id, invoice_number: number, customer_name: 'Walk-in', customer_id: '', created_at: date, invoice_date: date, notes: '',
    place_of_supply: '27', shipping_charges: 0, shipping_is_reimbursement: false, round_off: 0, status: 'paid',
    total_amount: total, total_gst_amount: tax, total_cgst: half, total_sgst: Math.round((tax - half) * 100) / 100, total_igst: 0,
    items: [{ name: 'Paracetamol 500mg strip', hsn_code: '3004', quantity: 4, unit_price: total / 4, gst_rate: 5, taxable_value: taxable, cgst: half, sgst: Math.round((tax - half) * 100) / 100, igst: 0, total }],
  };
};

async function main() {
  const owner = await token('owner@argus.test');
  const staff = await token('staff@argus.test');
  const free = await token('free@argus.test');

  // Clean slate for repeat runs.
  await call(staff, 'apiTeam', '/api/team/leave', {});
  const t0 = await call(owner, 'apiTeam', '/api/team', undefined);
  for (const m of (t0.body.team && t0.body.team.members) || []) await call(owner, 'apiTeam', '/api/team/remove', { email: m.email });

  // 1. Owner's phone syncs a bill, a purchase and stock.
  const item = { id: 'it-para', name: 'Paracetamol 500mg strip', hsn_code: '3004', gst_rate: 5, sell_price: 31.5, stock_on_hand: 96, reorder_level: 10, cost_price: 22 };
  const purchase = {
    id: 'pu-1', purchase_number: 'P-1', supplier_name: 'Cipla Distributor', supplier_gstin: '27AAACC1234F1Z8', supplier_invoice_number: 'CD/889',
    purchase_date: '2026-10-02', total_amount: 2310, total_gst_amount: 110, total_cgst: 55, total_sgst: 55, total_igst: 0, reverse_charge: false, itc_eligible: true,
    created_at: '2026-10-02T09:00:00', items: [{ name: 'Paracetamol 500mg strip', hsn_code: '3004', quantity: 100, unit_price: 23.1, gst_rate: 5, taxable_value: 2200, gst_amount: 110, cgst: 55, sgst: 55, igst: 0, total: 2310 }],
  };
  const moves = [
    { id: 'open_it-para', itemId: 'it-para', date: '2026-10-01', kind: 'opening', qty: 0, godown: 'Main', createdAt: '2026-10-01T00:00:00Z' },
    { id: 'mv-pu', itemId: 'it-para', date: '2026-10-02', kind: 'purchase', qty: 100, godown: 'Main', batch: 'PX22', expiry: '2026-11-10', unitCost: 22, ref: 'CD/889', refId: 'pu-1', createdAt: '2026-10-02T09:00:00Z' },
    { id: 'mv-s1', itemId: 'it-para', date: '2026-10-10', kind: 'sale', qty: -4, godown: 'Main', batch: 'PX22', ref: 'INV/26-27/0001', refId: 'ob-1', createdAt: '2026-10-10T10:00:00Z' },
  ];
  let r = await call(owner, 'apiDataPhoneSync', '/api/data/phone-sync', {
    booksUid: owner.uid, invoices: [bill('ob-1', 'INV/26-27/0001', 126)], customers: [], inventory: [item], purchases: [purchase], stockMoves: moves, godowns: [],
    auditLog: [{ id: 'a-o1', at: '2026-10-10T10:00:00Z', byUid: owner.uid, byName: 'Ravi Mehta', device: 'android', action: 'created', entity: 'bill', entityId: 'ob-1', ref: 'INV/26-27/0001', detail: 'Bill ₹126' }],
    auditSince: '',
  });
  check('owner phone sync works', r.status === 200, `status ${r.status} ${r.body.error || ''}`);
  check('owner is the owner of their books', r.body.books && r.body.books.role === 'owner' && r.body.books.booksUid === owner.uid);

  // 2. Invite staff with billing only.
  r = await call(owner, 'apiTeam', '/api/team/invite', { email: 'Staff@Argus.test', access: 'billing' });
  check('owner invites staff (billing only)', r.status === 200 && r.body.team.members.length === 1, `status ${r.status} ${r.body.error || ''}`);
  const series = r.body.team && r.body.team.members[0] && r.body.team.members[0].series;
  check('staff gets series B', series === 'B', series);

  r = await call(owner, 'apiTeam', '/api/team/invite', { email: 'free@argus.test', access: 'full' });
  check('a third user needs a paid seat', r.status === 402 && r.body.needs_seats === true, `status ${r.status} ${r.body.error || ''}`);

  // 3. Staff sees the invite and joins.
  r = await call(staff, 'apiTeam', '/api/team', undefined);
  check('staff sees the invite', r.body.invite && r.body.invite.ownerName === 'Mehta Medical Stores', JSON.stringify(r.body.invite));
  r = await call(free, 'apiTeam', '/api/team/accept', {});
  check('someone not invited cannot join', r.status === 404, `status ${r.status}`);
  r = await call(staff, 'apiTeam', '/api/team/accept', {});
  check('staff joins', r.status === 200 && r.body.role === 'member' && r.body.booksUid === owner.uid, `status ${r.status} ${r.body.error || ''}`);

  // 4. Profile: owner's plan applies; books info present.
  r = await call(staff, 'apiUserProfile', '/api/user/profile', undefined);
  const prof = r.body.user || {};
  check('staff profile carries the owner\'s Business plan', prof.subscription && prof.subscription.active === true, JSON.stringify(prof.subscription));
  check('staff profile says billing-only member, series B', prof.books && prof.books.role === 'member' && prof.books.access === 'billing' && prof.books.series === 'B');

  // 5. Staff phone: old books refused, then the owner's books, no purchases.
  r = await call(staff, 'apiDataPhoneSync', '/api/data/phone-sync', { booksUid: staff.uid, invoices: [bill('own-x', 'INV/26-27/0001', 50)] });
  check('staff phone holding its own books is told to switch', r.status === 409 && r.body.books_uid === owner.uid, `status ${r.status}`);
  r = await call(staff, 'apiDataPhoneSync', '/api/data/phone-sync', { invoices: [] });
  check('an old app version as a member is asked to update', r.status === 426, `status ${r.status}`);
  r = await call(staff, 'apiDataPhoneSync', '/api/data/phone-sync', {
    booksUid: owner.uid, invoices: [bill('sb-1', 'INV/26-27/B0001', 63, '2026-10-11T11:00:00.000')], customers: [], inventory: [{ ...item, stock_on_hand: 94 }],
    purchases: [{ ...purchase, id: 'pu-evil', supplier_invoice_number: 'FAKE/1' }], stockMoves: [], godowns: [],
    auditLog: [{ id: 'a-s1', at: '2026-10-11T11:00:00Z', byUid: staff.uid, byName: 'Sunita (counter)', device: 'android', action: 'created', entity: 'bill', entityId: 'sb-1', ref: 'INV/26-27/B0001', detail: 'Bill ₹63' }],
    auditSince: '', deleted: { purchases: ['pu-1'] },
  });
  check('staff phone syncs into the owner\'s books', r.status === 200, `status ${r.status} ${r.body.error || ''}`);
  check('staff phone receives the owner\'s bill', (r.body.invoices || []).some((i) => i.id === 'ob-1'));
  check('staff phone receives no purchases', Array.isArray(r.body.purchases) && r.body.purchases.length === 0);
  check('staff phone receives stock movements', (r.body.stockMoves || []).some((m) => m.id === 'mv-pu'));

  // 6. Website as staff: purchases hidden; locked parts cannot be changed.
  r = await call(staff, 'apiDataLoad', '/api/data/load', undefined);
  const staffView = r.body.data || {};
  check('staff website load works', r.status === 200, `status ${r.status} ${r.body.error || ''}`);
  check('staff website sees no purchases', (staffView.purchases || []).length === 0);
  check('staff website sees both bills', ['ob-1', 'sb-1'].every((id) => (staffView.invoices || []).some((i) => i.id === id)));
  r = await call(staff, 'apiDataSave', '/api/data/save', {
    appData: { ...staffView, settings: { ...(staffView.settings || {}), invoicePrefix: 'HACK' }, expenses: [{ id: 'e-x', amount: 1 }] },
    base_updated_at: r.body.updated_at, books_uid: owner.uid,
  });
  check('staff website save works', r.status === 200, `status ${r.status} ${r.body.error || ''}`);
  r = await call(staff, 'apiDataSave', '/api/data/save', { appData: staffView, books_uid: staff.uid });
  check('staff website holding other books is told to reload', r.status === 409 && r.body.error === 'books_changed', `status ${r.status}`);

  r = await call(owner, 'apiDataLoad', '/api/data/load', undefined);
  const ownerView = r.body.data || {};
  check('owner still has the purchase (staff could not delete it)', (ownerView.purchases || []).some((p) => p.id === 'pu-1'));
  check('staff could not add a purchase', !(ownerView.purchases || []).some((p) => p.id === 'pu-evil'));
  check('staff could not change settings', (ownerView.settings || {}).invoicePrefix !== 'HACK');
  check('staff could not add expenses', !(ownerView.expenses || []).some((e) => e.id === 'e-x'));
  check('owner sees staff\'s bill', (ownerView.invoices || []).some((i) => i.invoiceNumber === 'INV/26-27/B0001'));
  check('edit log names the staff member', (ownerView.auditLog || []).some((e) => e.byName === 'Sunita (counter)'));
  const sum = (ownerView.stockMoves || []).filter((m) => m.itemId === 'it-para').reduce((t, m) => t + m.qty, 0);
  const stock = (ownerView.stock || []).find((s) => s.id === 'it-para');
  check('stock movements add up to the stock count', stock && Math.abs(sum - stock.currentStock) < 1e-9, `moves ${sum} vs stock ${stock && stock.currentStock}`);

  // 7. Reports.
  r = await call(staff, 'apiReports', '/api/reports/gstr9?fy=2026-27', undefined);
  check('billing-only staff cannot open GST returns', r.status === 403, `status ${r.status}`);
  r = await call(owner, 'apiReports', '/api/reports/gstr9?fy=2026-27', undefined);
  check('owner GSTR-9 works', r.status === 200, `status ${r.status} ${r.body.error || ''}`);
  const t4 = r.body.report && JSON.stringify(r.body.report).length;
  check('owner GSTR-9 has content', !!t4);

  // 8. Full access.
  r = await call(owner, 'apiTeam', '/api/team/access', { email: 'staff@argus.test', access: 'full' });
  check('owner gives staff full access', r.status === 200 && r.body.team.members[0].access === 'full');
  r = await call(staff, 'apiReports', '/api/reports/gstr9?fy=2026-27', undefined);
  check('full-access staff can open GST returns', r.status === 200, `status ${r.status}`);
  r = await call(staff, 'apiDataLoad', '/api/data/load', undefined);
  check('full-access staff sees purchases', (r.body.data.purchases || []).length === 1);

  // 9. Owner-only actions.
  r = await call(staff, 'apiTeam', '/api/team/invite', { email: 'x@argus.test', access: 'full' });
  check('staff cannot invite others', r.status === 403, `status ${r.status}`);

  // 10. Leave.
  r = await call(staff, 'apiTeam', '/api/team/leave', {});
  check('staff leaves', r.status === 200 && r.body.role === 'owner' && r.body.booksUid === staff.uid);
  r = await call(staff, 'apiDataPhoneSync', '/api/data/phone-sync', { booksUid: owner.uid, invoices: [] });
  check('after leaving, the phone is told to go back to its own books', r.status === 409 && r.body.books_uid === staff.uid, `status ${r.status}`);
  r = await call(staff, 'apiDataLoad', '/api/data/load', undefined);
  check('after leaving, no Business plan of their own', r.status === 402, `status ${r.status}`);

  const failed = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
