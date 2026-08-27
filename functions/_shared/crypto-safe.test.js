const test = require('node:test');
const assert = require('node:assert/strict');
const { safeEqualString, hmacSha256Hex } = require('./crypto-safe');
const {
  verifyWebhookSignature,
  verifySubscriptionPaymentSignature,
} = require('./razorpay-subscriptions');

test('safeEqualString is length-safe and equal for matches', () => {
  assert.equal(safeEqualString('abc', 'abc'), true);
  assert.equal(safeEqualString('abc', 'abd'), false);
  assert.equal(safeEqualString('abc', 'ab'), false);
  assert.equal(safeEqualString('', ''), false);
});

test('hmac helpers verify Razorpay-style signatures', () => {
  const secret = 'whsec_test';
  const body = '{"event":"subscription.charged"}';
  const sig = hmacSha256Hex(secret, body);
  assert.equal(verifyWebhookSignature(body, sig, secret), true);
  assert.equal(verifyWebhookSignature(body, 'deadbeef', secret), false);
  assert.equal(verifyWebhookSignature(body, sig, ''), false);

  const paySig = hmacSha256Hex(secret, 'pay_1|sub_1');
  assert.equal(verifySubscriptionPaymentSignature('pay_1', 'sub_1', paySig, secret), true);
  assert.equal(verifySubscriptionPaymentSignature('pay_1', 'sub_1', paySig + '0', secret), false);
});
