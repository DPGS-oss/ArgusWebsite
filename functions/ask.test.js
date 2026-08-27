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
