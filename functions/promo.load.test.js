/**
 * Guards the deploy-load contract: functions/index.js requires ./_shared/promo.
 * Constants come from /api/promo/self-test in index.js (amount_paise === 11800,
 * duration_months === 3). Do not weaken those assertions.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const promoPath = path.join(__dirname, '_shared', 'promo.js');
assert.ok(fs.existsSync(promoPath), 'functions/_shared/promo.js is missing');

const promo = require('./_shared/promo');

const required = [
  'OFFER',
  'CAMPAIGN',
  'normalizeCode',
  'validateCodeForUser',
  'reserveCode',
  'attachOrderToReservation',
  'redeemCode',
  'findRedemptionByPaymentId',
  'findPaymentRecord',
  'recordPayment',
];

for (const name of required) {
  assert.ok(promo[name] != null, `missing export: ${name}`);
}

assert.strictEqual(typeof promo.normalizeCode, 'function');
assert.strictEqual(typeof promo.validateCodeForUser, 'function');
assert.strictEqual(typeof promo.reserveCode, 'function');
assert.strictEqual(typeof promo.attachOrderToReservation, 'function');
assert.strictEqual(typeof promo.redeemCode, 'function');
assert.strictEqual(typeof promo.findRedemptionByPaymentId, 'function');
assert.strictEqual(typeof promo.findPaymentRecord, 'function');
assert.strictEqual(typeof promo.recordPayment, 'function');

assert.strictEqual(promo.OFFER.amount_paise, 11800);
assert.strictEqual(promo.OFFER.duration_months, 3);
assert.ok(promo.OFFER.label);
assert.ok(promo.OFFER.plan);
assert.ok(promo.OFFER.plan_key);
assert.strictEqual(typeof promo.OFFER.base_amount_paise, 'number');
assert.strictEqual(typeof promo.OFFER.gst_percent, 'number');
assert.ok(promo.OFFER.campaign);
assert.strictEqual(promo.OFFER.campaign, promo.CAMPAIGN);

assert.strictEqual(promo.normalizeCode(''), '');
assert.strictEqual(promo.normalizeCode(' argus-ab12 '), 'ARGUS-AB12');
assert.strictEqual(promo.normalizeCode('ARGUS-XXXXXXXX'), 'ARGUS-XXXXXXXX');

require('./index.js');

console.log('promo load test ok');
