/**
 * GST reports for the Android app, computed from the books synced to the
 * cloud (the website computes the same reports in the browser from the same
 * modules): GSTR-9 worksheet, GSTR-2B matching and the exempt supplies report.
 *
 *   GET  /api/reports/gstr9?fy=2026-27
 *   POST /api/reports/gstr2b   { json: <GSTR-2B file>, save?: true }
 *   GET  /api/reports/exempt?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
const { onRequest } = require('firebase-functions/v2/https');
const { verifyToken, getUser, getDb } = require('./_shared/firebase-admin');
const { checkRateLimit } = require('./_shared/rate-limit');
const { hasActiveBusinessSubscription } = require('./_shared/subscription-utils');
const { resolveAppData } = require('./_shared/app_data');
const { buildGstr9, gstr9Rows, exemptReport } = require('./_shared/gstr9');
const { parse2b, match2b, itcTotals } = require('./_shared/gstr2b');
const { sellerGstinFromAppData } = require('./_shared/ca-exports');

function extractToken(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function loadBooks(uid) {
  const ref = getDb().collection('users').doc(uid).collection('app_data').doc('main');
  const snap = await ref.get();
  return { ref, data: snap.exists ? resolveAppData(snap.data()) || {} : {} };
}

/** Uploaded GSTR-2B credit per month, for GSTR-9 Table 8A. */
function itcByMonth(data) {
  const out = {};
  for (const [period, v] of Object.entries(data.gstr2b || {})) if (v && v.itc) out[period] = v.itc;
  return out;
}

function currentFy() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const y = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

exports.apiReports = onRequest({ region: 'us-central1', maxInstances: 10, memory: '512MiB' }, async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (_) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  const user = await getUser(decoded.uid);
  if (!hasActiveBusinessSubscription(user)) {
    return res.status(402).json({ error: 'GST reports need the Business plan', requires_subscription: true });
  }
  const rl = await checkRateLimit(decoded.uid, 'reports');
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limit exceeded', retry_after_seconds: rl.retryAfterSeconds });

  const path = String(req.path || '').replace(/\/+$/, '');
  try {
    if (req.method === 'GET' && path.endsWith('/reports/gstr9')) {
      const fy = /^\d{4}-\d{2}$/.test(String(req.query.fy || '')) ? String(req.query.fy) : currentFy();
      const { data } = await loadBooks(decoded.uid);
      const report = buildGstr9(data, fy, itcByMonth(data));
      return res.status(200).json({ gstin: sellerGstinFromAppData(data), report, rows: gstr9Rows(report) });
    }

    if (req.method === 'POST' && path.endsWith('/reports/gstr2b')) {
      const body = req.body || {};
      if (!body.json || typeof body.json !== 'object') return res.status(400).json({ error: 'Upload the GSTR-2B JSON file from the GST portal.' });
      if (Buffer.byteLength(JSON.stringify(body.json), 'utf8') > 5_000_000) return res.status(413).json({ error: 'File too large (max 5MB)' });
      const parsed = parse2b(body.json);
      if (!parsed.docs.length && !parsed.period) {
        return res.status(400).json({ error: 'This does not look like a GSTR-2B file. Download it from Returns → GSTR-2B → Download JSON.' });
      }
      const { ref, data } = await loadBooks(decoded.uid);
      const own = String(sellerGstinFromAppData(data) || '').toUpperCase();
      if (parsed.gstin && own && parsed.gstin !== own) {
        return res.status(400).json({ error: `This GSTR-2B is for ${parsed.gstin}, but your business GSTIN is ${own}.` });
      }
      const result = match2b(parsed, data.purchases || []);
      if (body.save !== false && parsed.period) {
        // Keep the month's 2B credit for GSTR-9 Table 8A. Written like phone sync:
        // the whole book in one transaction, so nothing else is lost or overwritten.
        await getDb().runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          const now = new Date().toISOString();
          const current = (snap.exists ? resolveAppData(snap.data()) : null) || {};
          const appData = {
            ...current,
            gstr2b: { ...(current.gstr2b || {}), [parsed.period]: { itc: itcTotals(parsed), summary: result.summary, uploadedAt: now } },
          };
          tx.set(ref, {
            appData,
            updated_at: now,
            data_compressed: require('firebase-admin/firestore').FieldValue.delete(),
          }, { merge: true });
        });
      }
      return res.status(200).json({ gstin: parsed.gstin, ...result });
    }

    if (req.method === 'GET' && path.endsWith('/reports/exempt')) {
      const from = DAY.test(String(req.query.from || '')) ? String(req.query.from) : `${currentFy().slice(0, 4)}-04-01`;
      const to = DAY.test(String(req.query.to || '')) ? String(req.query.to) : new Date().toISOString().slice(0, 10);
      const { data } = await loadBooks(decoded.uid);
      return res.status(200).json(exemptReport(data, from, to));
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (e) {
    console.error('reports error', e);
    return res.status(500).json({ error: 'Could not build the report. Try again.' });
  }
});
