const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canStartTrial,
  normalizeDeviceId,
  clientIpFromReq,
  evaluateClaimDoc,
  claimDocId,
  buildTrialSubscription,
  TRIAL_DAYS,
} = require('../_shared/trial');

test('canStartTrial blocks used trial and active sub', () => {
  assert.equal(canStartTrial(null).status, 404);
  assert.equal(canStartTrial({ trial_used: true }).status, 409);
  assert.equal(
    canStartTrial({
      subscription: { active: true, expiry_date: new Date(Date.now() + 86400000).toISOString() },
    }).status,
    400,
  );
  assert.equal(canStartTrial({ email: 'a@b.c' }).ok, true);
});

test('normalizeDeviceId accepts stable ids only', () => {
  assert.equal(normalizeDeviceId('short'), null);
  assert.equal(normalizeDeviceId('../../../etc/passwd'), null);
  assert.equal(normalizeDeviceId('abcd-efgh-ijkl-mnop'), 'abcd-efgh-ijkl-mnop');
  assert.equal(normalizeDeviceId('  device_ABCDEF1234567890  '), 'device_ABCDEF1234567890');
});

test('clientIpFromReq prefers x-forwarded-for and skips localhost', () => {
  const req = {
    get(name) {
      if (name === 'x-forwarded-for') return '203.0.113.10, 10.0.0.1';
      return '';
    },
    headers: {},
    ip: '127.0.0.1',
  };
  assert.equal(clientIpFromReq(req), '203.0.113.10');

  const local = {
    get() {
      return '';
    },
    headers: {},
    ip: '127.0.0.1',
  };
  assert.equal(clientIpFromReq(local), null);
});

test('evaluateClaimDoc allows same uid, blocks other uid', () => {
  assert.equal(evaluateClaimDoc(null, 'u1', 'device').ok, true);
  assert.equal(evaluateClaimDoc({ uid: 'u1' }, 'u1', 'device').ok, true);
  assert.equal(evaluateClaimDoc({ uid: 'u2' }, 'u1', 'device').status, 409);
});

test('claimDocId is stable hash prefix', () => {
  assert.equal(claimDocId('ip', '1.2.3.4'), claimDocId('ip', '1.2.3.4'));
  assert.match(claimDocId('device', 'abc'), /^device_[a-f0-9]{40}$/);
});

test('buildTrialSubscription is 14-day business_trial', () => {
  const sub = buildTrialSubscription();
  assert.equal(sub.plan_key, 'business_trial');
  assert.equal(sub.active, true);
  assert.equal(TRIAL_DAYS, 14);
  const end = new Date(sub.expiry_date).getTime();
  const approx = Date.now() + TRIAL_DAYS * 86400000;
  assert.ok(Math.abs(end - approx) < 120000);
});
