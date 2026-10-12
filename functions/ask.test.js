const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_ASK_MODEL, OPENROUTER_CHAT_URL } = require('./ask');

test('Ask Argus defaults to OpenRouter free router', () => {
  assert.equal(DEFAULT_ASK_MODEL, 'openrouter/free');
  assert.equal(OPENROUTER_CHAT_URL, 'https://openrouter.ai/api/v1/chat/completions');
});

test('Ask Argus reports unconfigured when OpenRouter key missing', async () => {
  const prev = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  const { callOpenRouter } = require('./ask');
  const result = await callOpenRouter('What is my GST?', { sales_total: 1000 });
  assert.equal(result.configured, false);
  assert.equal(result.provider, 'openrouter');
  if (prev) process.env.OPENROUTER_API_KEY = prev;
});

test('Ask Argus flags rupee amounts the AI made up, and accepts real ones', () => {
  const { unverifiedAmounts } = require('./ask');
  const summary = { sales_total: 125000, sales_tax: 19067.8, outstanding: 4200, top_parties: [{ label: 'A', total: 50000 }] };
  assert.deepEqual(unverifiedAmounts('Sales ₹1,25,000 with GST ₹19,067.80; Mehta owes Rs. 4,200.', summary), []);
  assert.deepEqual(unverifiedAmounts('Top customer ₹50,000. Net of GST ₹1,05,932.20.', summary), []);
  assert.deepEqual(unverifiedAmounts('Sales about ₹1.25 lakh.', summary), []);
  assert.deepEqual(unverifiedAmounts('Your profit is ₹38,000.', summary), [38000]);
  assert.deepEqual(unverifiedAmounts('GST due is ₹2 lakh', summary), [200000]);
});
