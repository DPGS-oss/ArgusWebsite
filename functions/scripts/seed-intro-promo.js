/**
 * Seed the single-use ₹1 intro promo in Firestore (local / ops).
 * Usage: node functions/scripts/seed-intro-promo.js
 */
const { seedIntroPromoCode, INTRO_CODE_PREFIX } = require('../_shared/promo');

seedIntroPromoCode()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (result.code) {
      console.log(`Intro code (${result.seeded ? 'new' : 'existing'}): ${result.code}`);
      console.log(`Format: ${INTRO_CODE_PREFIX} + 10 chars · single use only`);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
