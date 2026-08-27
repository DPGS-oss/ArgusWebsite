/**
 * Local Resend smoke test — reads RESEND_API_KEY from env or functions/.env (gitignored).
 * Usage: npm run test:resend
 * Optional: RESEND_TEST_TO=you@example.com
 */
const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  for (const name of ['.env.local', '.env']) {
    const envPath = path.join(__dirname, '..', name);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadDotEnv();

const { sendEmail } = require('../_shared/resend-client');

async function main() {
  const to = process.env.RESEND_TEST_TO || 'devanshpundhir25@gmail.com';
  if (!process.env.RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY. Set it in functions/.env.local or your shell.');
    process.exit(1);
  }

  const result = await sendEmail({
    to,
    subject: 'Argus Resend test',
    html: '<p>Congrats — <strong>Resend</strong> is wired for Argus admin emails.</p>',
    text: 'Congrats — Resend is wired for Argus admin emails.',
  });

  if (!result.sent) {
    console.error('Send failed:', result);
    process.exit(1);
  }

  console.log('Email sent. Resend id:', result.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
