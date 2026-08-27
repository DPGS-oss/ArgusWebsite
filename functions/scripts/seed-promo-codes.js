#!/usr/bin/env node
/**
 * Seed exactly 50 single-use beta promo codes into Firestore.
 *
 * Usage (from functions/):
 *   node scripts/seed-promo-codes.js
 *   node scripts/seed-promo-codes.js --force   # only if fewer than 50 exist; never overwrites redeemed
 *
 * Requires Google Application Default Credentials for the Firebase project,
 * e.g. `gcloud auth application-default login` or GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Writes CSV to scripts/promo-codes-OUTPUT.csv (gitignored pattern recommended).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getAdmin, getDb } = require('../_shared/firebase-admin');
const { CAMPAIGN, OFFER } = require('../_shared/promo');

const TARGET_COUNT = 50;
const CODE_PREFIX = 'ARGUS-';
// Unambiguous alphabet (no 0/O, 1/I/L)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
  const bytes = crypto.randomBytes(8);
  let body = '';
  for (let i = 0; i < 8; i++) {
    body += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return CODE_PREFIX + body;
}

async function main() {
  getAdmin();
  const db = getDb();
  const force = process.argv.includes('--force');

  const existing = await db.collection('promo_codes').where('campaign', '==', CAMPAIGN).get();
  const existingCount = existing.size;

  if (existingCount >= TARGET_COUNT && !force) {
    console.error(
      `Campaign ${CAMPAIGN} already has ${existingCount} codes. Refusing to seed. Use --force only to top up missing slots.`
    );
    process.exit(1);
  }

  const existingCodes = new Set(existing.docs.map((d) => d.id));
  const need = Math.max(0, TARGET_COUNT - existingCount);
  if (need === 0) {
    console.log('Nothing to seed.');
    process.exit(0);
  }

  const expires = new Date();
  expires.setMonth(expires.getMonth() + 6);
  const nowIso = new Date().toISOString();
  const created = [];

  while (created.length < need) {
    const code = generateCode();
    if (existingCodes.has(code)) continue;

    const doc = {
      code,
      campaign: CAMPAIGN,
      status: 'available',
      plan: OFFER.plan,
      plan_key: OFFER.plan_key,
      label: OFFER.label,
      duration_months: OFFER.duration_months,
      base_amount_paise: OFFER.base_amount_paise,
      gst_percent: OFFER.gst_percent,
      amount_paise: OFFER.amount_paise,
      max_redemptions: 1,
      redemption_count: 0,
      reserved_by: null,
      reserved_at: null,
      reserved_order_id: null,
      redeemed_by: null,
      redeemed_at: null,
      redeemed_payment_id: null,
      expires_at: expires.toISOString(),
      created_at: nowIso,
      updated_at: nowIso,
    };

    await db.collection('promo_codes').doc(code).create(doc);
    existingCodes.add(code);
    created.push(code);
    process.stdout.write(`\rCreated ${created.length}/${need}`);
  }

  console.log('\n');

  const outDir = path.join(__dirname);
  const outFile = path.join(outDir, `promo-codes-${Date.now()}.csv`);
  const csv = ['code,campaign,amount_paise,duration_months,status']
    .concat(created.map((c) => `${c},${CAMPAIGN},${OFFER.amount_paise},${OFFER.duration_months},available`))
    .join('\n');
  fs.writeFileSync(outFile, csv, 'utf8');

  console.log(`Seeded ${created.length} codes for campaign ${CAMPAIGN}.`);
  console.log(`CSV written to ${outFile}`);
  console.log('Keep this file private. Do not commit it to git.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
