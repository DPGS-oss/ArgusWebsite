const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RESERVATION_TTL_MS,
  maxRedemptions,
  isExhausted,
  pruneReservations,
  slotsTaken,
  hasRedeemedPayment,
  hasRedeemedUid,
} = require('../_shared/promo-logic');

test('maxRedemptions defaults to 1', () => {
  assert.equal(maxRedemptions({}), 1);
  assert.equal(maxRedemptions({ max_redemptions: 10 }), 10);
});

test('isExhausted after 10 of 10', () => {
  assert.equal(isExhausted({ max_redemptions: 10, redemption_count: 9, status: 'available' }), false);
  assert.equal(isExhausted({ max_redemptions: 10, redemption_count: 10, status: 'available' }), true);
  assert.equal(isExhausted({ max_redemptions: 10, redemption_count: 3, status: 'redeemed' }), true);
});

test('pruneReservations drops stale slots and keeps live ones', () => {
  const now = Date.now();
  const data = {
    max_redemptions: 10,
    reservations: {
      stale: { at: new Date(now - RESERVATION_TTL_MS - 1000).toISOString(), order_id: 'old' },
      live: { at: new Date(now - 1000).toISOString(), order_id: 'new' },
    },
  };
  const pruned = pruneReservations(data, now);
  assert.deepEqual(Object.keys(pruned), ['live']);
});

test('slotsTaken counts redemptions plus active reservations', () => {
  assert.equal(slotsTaken(3, { a: {}, b: {} }), 5);
});

test('10-use code still has room with 9 redemptions', () => {
  const data = { max_redemptions: 10, redemption_count: 9, reservations: {}, status: 'available' };
  assert.equal(isExhausted(data), false);
  assert.equal(slotsTaken(data.redemption_count, {}) < maxRedemptions(data), true);
});

test('hasRedeemedPayment and hasRedeemedUid check arrays', () => {
  const data = {
    redeemed_uids: ['u1'],
    redeemed_payment_ids: ['pay_1'],
    redeemed_by: 'u1',
    redeemed_payment_id: 'pay_1',
  };
  assert.equal(hasRedeemedUid(data, 'u1'), true);
  assert.equal(hasRedeemedUid(data, 'u2'), false);
  assert.equal(hasRedeemedPayment(data, 'pay_1'), true);
  assert.equal(hasRedeemedPayment(data, 'pay_2'), false);
});
