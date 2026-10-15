const test = require('node:test');
const assert = require('node:assert/strict');
const team = require('./team');

const NOW = Date.parse('2026-10-15T00:00:00Z');
const member = (email, extra = {}) => ({ email, access: 'billing', series: 'B', status: 'active', uid: `u-${email}`, ...extra });

test('two users included; extra users only while paid', () => {
  assert.equal(team.allowedUsers(null, NOW), 2);
  const t = { members: [member('a@x.in'), member('b@x.in', { series: 'C' })], extraSeats: 1, seatsPaidUntil: '2027-03-31T00:00:00Z' };
  assert.equal(team.allowedUsers(t, NOW), 3);
  assert.equal(team.membersWithAccess(t, NOW).length, 2);
  // Seats lapse: the earliest invited keeps access, the later one waits.
  const lapsed = { ...t, seatsPaidUntil: '2026-10-01T00:00:00Z' };
  assert.deepEqual(team.membersWithAccess(lapsed, NOW).map((m) => m.email), ['a@x.in']);
  const ctx = team.contextFor('u-b@x.in', 'owner1', lapsed, NOW);
  assert.equal(ctx.role, 'owner');
  assert.equal(ctx.booksUid, 'u-b@x.in');
  assert.equal(ctx.lapsed, true);
});

test('only an active member listed by the owner opens the owner\'s books', () => {
  const t = { ownerName: 'Mehta Stores', members: [member('a@x.in', { access: 'full' }), member('c@x.in', { status: 'invited', uid: null, series: 'C' })] };
  const a = team.contextFor('u-a@x.in', 'owner1', t, NOW);
  assert.deepEqual([a.role, a.booksUid, a.access, a.series, a.ownerName], ['member', 'owner1', 'full', 'B', 'Mehta Stores']);
  // A membership record the team does not back gives nothing.
  assert.equal(team.contextFor('someone-else', 'owner1', t, NOW).booksUid, 'someone-else');
  // Removed members lose access.
  const removed = { ...t, members: [{ ...t.members[0], status: 'removed' }] };
  assert.equal(team.contextFor('u-a@x.in', 'owner1', removed, NOW).role, 'owner');
});

test('series letters: a returning person gets theirs back; freed letters are reused last', () => {
  const t = { members: [member('a@x.in', { status: 'removed' })] };
  assert.equal(team.nextSeries(t, 'new@x.in'), 'C');
  assert.equal(team.nextSeries(t, 'a@x.in'), 'B');
  assert.equal(team.nextSeries(null, 'x@x.in'), 'B');
  const letters = 'BCDEFGHJKLMNPQRSTUVXYZ'.split('');
  const crowded = { members: letters.map((l, i) => member(`m${i}@x.in`, { series: l, status: i === 3 ? 'removed' : 'active' })) };
  assert.equal(team.nextSeries(crowded, 'late@x.in'), 'E');
  crowded.members[3].status = 'active';
  assert.equal(team.nextSeries(crowded, 'late@x.in'), null);
});

test('billing-only users do not see or change purchases, expenses, payroll, settings', () => {
  const stored = {
    invoices: [{ id: 'i1' }], purchases: [{ id: 'p1' }], expenses: [{ id: 'e1' }], payroll: [{ id: 'r1' }],
    gstr2b: { '102026': {} }, businesses: [{ id: 'b1', gstin: '27AAPFU0939F1ZV' }], settings: { invoicePrefix: 'INV' },
    deleted: { purchases: {} },
  };
  const view = team.viewFor(stored, 'billing');
  assert.deepEqual(view.purchases, []);
  assert.deepEqual(view.expenses, []);
  assert.deepEqual(view.gstr2b, {});
  assert.equal(view.businesses.length, 1, 'needed to make bills');
  const withLog = team.viewFor({ ...stored, auditLog: [{ id: 'a', entity: 'bill' }, { id: 'b', entity: 'purchase' }, { id: 'c', entity: 'expense' }] }, 'billing');
  assert.deepEqual(withLog.auditLog.map((e) => e.id), ['a']);
  assert.equal(team.viewFor(stored, 'full'), stored);

  const incoming = {
    ...view, invoices: [{ id: 'i1' }, { id: 'i2' }], businesses: [{ id: 'b1', gstin: 'CHANGED' }], settings: { invoicePrefix: 'X' },
    deleted: { purchases: { p1: 'now' }, invoices: { d1: 'now' } },
  };
  const saved = team.mergeMemberSave(stored, incoming, 'billing');
  assert.equal(saved.invoices.length, 2);
  assert.deepEqual(saved.purchases, [{ id: 'p1' }]);
  assert.deepEqual(saved.expenses, [{ id: 'e1' }]);
  assert.equal(saved.businesses[0].gstin, '27AAPFU0939F1ZV');
  assert.equal(saved.settings.invoicePrefix, 'INV');
  assert.deepEqual(saved.deleted.purchases, {});
  assert.deepEqual(saved.deleted.invoices, { d1: 'now' });
  const full = team.mergeMemberSave(stored, incoming, 'full');
  assert.equal(full.invoices.length, 2);
  assert.equal(full.businesses[0].gstin, 'CHANGED', 'full access can edit the business');
});

test('extra users cost ₹50 a month to the end of the period', () => {
  assert.deepEqual(team.seatQuote(1, '2027-03-31T00:00:00Z', NOW), { months: 6, amount: 30000 });
  assert.deepEqual(team.seatQuote(2, '2026-10-20T00:00:00Z', NOW), { months: 1, amount: 10000 });
  assert.deepEqual(team.seatQuote(1, null, NOW), { months: 1, amount: 5000 });
  assert.equal(team.seatQuote(1, '2030-01-01T00:00:00Z', NOW).months, 12);
});

test('nobody on the team can remove an issued bill; drafts can go', () => {
  const stored = { invoices: [{ id: 'i1', status: 'paid' }, { id: 'd1', status: 'draft' }], creditNotes: [{ id: 'c1', status: 'issued' }] };
  for (const access of ['billing', 'full']) {
    const saved = team.mergeMemberSave(stored, { invoices: [], creditNotes: [], deleted: { invoices: { i1: 'x', d1: 'x' }, creditNotes: { c1: 'x' } } }, access);
    assert.deepEqual(saved.invoices.map((i) => i.id), ['i1']);
    assert.deepEqual(saved.creditNotes.map((c) => c.id), ['c1']);
    assert.deepEqual(Object.keys(saved.deleted.invoices), ['d1']);
    assert.deepEqual(saved.deleted.creditNotes, {});
  }
});
