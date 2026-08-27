/**
 * CI/local guard: fail if live API key patterns appear in tracked frontend paths.
 * Does not scan gitignored .env.local files.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['app', 'components', 'lib', 'public'];
const FORBIDDEN = [
  /\bsk-or-v1-[A-Za-z0-9]+\b/,
  /\bre_[A-Za-z0-9_]{20,}\b/,
  /\brzp_(live|test)_[A-Za-z0-9]+\b/,
  /RESEND_API_KEY\s*=\s*['"]?re_/,
  /OPENROUTER_API_KEY\s*=\s*['"]?sk-or/,
  /RAZORPAY_KEY_SECRET\s*=\s*['"]?[A-Za-z0-9]+/,
  /ARGUS1RUPEE/,
  /ARGUS1-[A-Z0-9X]{8,}/,
  /ARGUS-[X]{6,}/,
];

const ALLOWLIST_SNIPPETS = ['X-Admin-Key', 'localStorage', 'sessionStorage', 'argus_admin_key'];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?|json|html|css)$/.test(name)) out.push(full);
  }
  return out;
}

const hits = [];
for (const sub of SCAN_DIRS) {
  for (const file of walk(path.join(ROOT, sub))) {
    const text = fs.readFileSync(file, 'utf8');
    if (ALLOWLIST_SNIPPETS.some((s) => text.includes(s) && !FORBIDDEN.some((re) => re.test(text)))) {
      /* admin header name is ok */
    }
    for (const re of FORBIDDEN) {
      if (re.test(text)) {
        hits.push({ file: path.relative(ROOT, file), pattern: re.source });
      }
    }
  }
}

if (hits.length) {
  console.error('Secret scan failed — possible keys in frontend:');
  for (const h of hits) console.error(`  ${h.file} (${h.pattern})`);
  process.exit(1);
}

console.log('Secret scan OK: no API keys in app/components/lib/public');
