const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const { resolveAppData, booksFromAppData, flutterPayloadToAppData } = require('./app_data');

test('booksFromAppData is non-empty for Flutter-shaped invoices', () => {
  const appData = flutterPayloadToAppData({
    invoices: [
      {
        invoice_number: 'INV-001',
        customer_name: 'Ravi Stores',
        total_amount: 1180,
        total_gst_amount: 180,
        created_at: '2026-04-10T10:00:00.000',
        place_of_supply: '27',
      },
    ],
    customers: [{ id: 'c1', name: 'Ravi Stores', gstin: '27ABCDE1234F1Z5' }],
  });
  const books = booksFromAppData(appData);
  assert.equal(books.invoices.length, 1);
  assert.equal(books.invoices[0].invoiceNumber, 'INV-001');
  assert.equal(books.invoices[0].partyName, 'Ravi Stores');
  assert.equal(books.parties[0].name, 'Ravi Stores');
});

test('resolveAppData prefers appData then data_compressed', () => {
  const fromField = resolveAppData({ appData: { invoices: [{ invoiceNumber: 'A' }] } });
  assert.equal(fromField.invoices[0].invoiceNumber, 'A');

  const gz = zlib.gzipSync(Buffer.from(JSON.stringify({
    invoices: [{ invoice_number: 'B', customer_name: 'X', total_amount: 10 }],
  })));
  const fromGzip = resolveAppData({ data_compressed: gz.toString('base64') });
  assert.equal(fromGzip.invoices[0].invoiceNumber, 'B');
});
