/**
 * Hybrid Ask Argus — cloud LLM only on explicit owner tap.
 * Uses OpenRouter (free-tier models) with a stripped summary payload.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { verifyToken, getUser } = require('./_shared/firebase-admin');
const { checkRateLimit } = require('./_shared/rate-limit');
const { isBusinessPlan } = require('./_shared/subscription-utils');

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_ASK_MODEL = 'openrouter/free';
const SITE_URL = 'https://argusinvoicing.com';

const ASK_CORS_ORIGINS = new Set([
  'https://argusinvoicing.com',
  'https://www.argusinvoicing.com',
  'https://argus-invocing.web.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

const ASK_SECRETS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'OPENROUTER_API_KEY',
];

function setAskCors(req, res) {
  const origin = String(req.get('origin') || '');
  if (ASK_CORS_ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
}

function extractToken(req) {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return '';
}

function subscriptionActive(sub) {
  if (!sub || sub.active !== true) return false;
  const plan = sub.plan_key || sub.plan;
  if (!isBusinessPlan(plan)) return false;
  const expiry = sub.expiry_date || sub.expiryDate;
  if (!expiry) return false;
  return new Date(expiry).getTime() > Date.now();
}

function sanitizeSummary(summary) {
  if (!summary || typeof summary !== 'object') return null;
  const out = { ...summary };
  if (!out.include_party_names) {
    delete out.top_parties;
    delete out.party_names;
    delete out.parties;
  }
  delete out.include_party_names;
  return out;
}

async function callOpenRouter(question, summary) {
  const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
  if (!apiKey) {
    return {
      answer:
        'Ask Argus is not configured on the server yet. GST math and reports still run on your device.',
      configured: false,
      provider: 'openrouter',
    };
  }

  const model = (process.env.ASK_ARGUS_MODEL || DEFAULT_ASK_MODEL).trim();
  const system = [
    'You are Argus, a concise GST billing assistant for Indian shop owners.',
    'Use only the provided summary numbers. Do not invent transactions or party names.',
    'Prefer bullet points. Mention when data is insufficient.',
  ].join(' ');

  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SITE_URL,
      'X-OpenRouter-Title': 'Argus GST Billing',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Question: ${question}\n\nSummary JSON:\n${JSON.stringify(summary)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('ask-argus openrouter error', res.status, errText);
    return {
      answer: 'Could not reach OpenRouter. Try again in a minute (free tier rate limits apply).',
      configured: true,
      provider: 'openrouter',
      error: true,
    };
  }

  const data = await res.json();
  const answer = data?.choices?.[0]?.message?.content?.trim() || 'No answer returned.';
  return { answer, configured: true, provider: 'openrouter', model };
}

exports.apiAsk = onRequest({ region: 'us-central1', maxInstances: 10, secrets: ASK_SECRETS }, async (req, res) => {
  setAskCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (_) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const rl = await checkRateLimit(decoded.uid, 'ask_argus');
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded', retry_after_seconds: rl.retryAfterSeconds });
  }

  const user = await getUser(decoded.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (String(user.account_type || '').toLowerCase() === 'accountant') {
    return res.status(403).json({ error: 'Ask Argus is available to business owners only' });
  }
  if (!subscriptionActive(user.subscription)) {
    return res.status(403).json({ error: 'Business subscription required for Ask Argus' });
  }

  const body = req.body || {};
  const question = String(body.question || '').trim();
  if (!question || question.length > 2000) {
    return res.status(400).json({ error: 'question required (max 2000 chars)' });
  }

  const summary = sanitizeSummary(body.summary);
  if (!summary) return res.status(400).json({ error: 'summary object required' });

  const result = await callOpenRouter(question, summary);
  return res.status(200).json({
    answer: result.answer,
    hybrid: true,
    configured: result.configured !== false,
    provider: result.provider || 'openrouter',
    model: result.model || null,
    party_names_sent: Boolean(body.summary?.include_party_names),
  });
});

module.exports = {
  apiAsk: exports.apiAsk,
  callOpenRouter,
  DEFAULT_ASK_MODEL,
  OPENROUTER_CHAT_URL,
};
