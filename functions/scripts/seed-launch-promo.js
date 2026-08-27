#!/usr/bin/env node
/**
 * Seed ARGUS100: ₹100 for 3 months of Business, 10 redemptions.
 *
 * Usage (from functions/):
 *   node scripts/seed-launch-promo.js
 *
 * Requires Google Application Default Credentials for the Firebase project.
 */

const { getAdmin, getDb } = require('../_shared/firebase-admin');
const { seedLaunchPromoCode, LAUNCH_CODE, LAUNCH_OFFER } = require('../_shared/promo');

async function main() {
  getAdmin();
  getDb();
  const result = await seedLaunchPromoCode();
  console.log(
    JSON.stringify(
      {
        ...result,
        offer: {
          code: LAUNCH_CODE,
          amount_rupees: LAUNCH_OFFER.amount_paise / 100,
          duration_months: LAUNCH_OFFER.duration_months,
          max_redemptions: LAUNCH_OFFER.max_redemptions,
        },
      },
      null,
      2,
    ),
  );
  if (result.existing) {
    console.log(`Code ${LAUNCH_CODE} already exists (status=${result.data?.status}, uses=${result.data?.redemption_count || 0}/${LAUNCH_OFFER.max_redemptions}).`);
  } else {
    console.log(`Seeded ${LAUNCH_CODE}: ₹${LAUNCH_OFFER.amount_paise / 100} for ${LAUNCH_OFFER.duration_months} months, ${LAUNCH_OFFER.max_redemptions} uses.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
