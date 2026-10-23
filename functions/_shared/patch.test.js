const test = require('node:test');
const assert = require('node:assert/strict');
const { applyPatch } = require('./patch');

test('a save of only what changed: adds, edits, removes, keeps what it did not mention', () => {
  const stored = {
    invoices: [{ id: 'a', total: 1 }, { id: 'b', total: 2 }, { id: 'phone', total: 9 }],
    khataEntries: [{ id: 'k1' }, { id: 'k2' }],
    settings: { invoicePrefix: 'INV' },
    stock: [{ id: 's1', currentStock: 5 }],
    deleted: { invoices: { old: 't0' } },
  };
  const out = applyPatch(stored, {
    changes: { invoices: [{ id: 'b', total: 3 }, { id: 'c', total: 4 }], khataEntries: [{ id: 'k3' }] },
    removed: { khataEntries: ['k1'] },
    small: { settings: { invoicePrefix: 'BILL' } },
    deleted: { invoices: { a: 't1' } },
  });
  assert.deepEqual(out.invoices.map((r) => [r.id, r.total]), [['b', 3], ['phone', 9], ['c', 4]], 'a deleted, b edited, c added, the phone bill kept');
  assert.deepEqual(out.khataEntries.map((r) => r.id), ['k2', 'k3']);
  assert.deepEqual(out.settings, { invoicePrefix: 'BILL' });
  assert.deepEqual(out.stock, stored.stock, 'lists not mentioned are untouched');
  assert.deepEqual(out.deleted.invoices, { old: 't0', a: 't1' });
});

test('small parts cannot overwrite a record list', () => {
  const out = applyPatch({ invoices: [{ id: 'a' }] }, { small: { invoices: [] } });
  assert.deepEqual(out.invoices, [{ id: 'a' }]);
});
