/**
 * Admin API — email whitelist + rotating 14-day access key (emailed via Resend).
 * No public links; no self-service admin accounts.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { verifyToken, getUser, updateUser, getDb } = require('./_shared/firebase-admin');
const { checkRateLimit } = require('./_shared/rate-limit');
const { requireAdmin, verifyAdminKey, extractAdminKey } = require('./_shared/admin-auth');
const { rotateAdminAccessKey } = require('./_shared/admin-key');
const { getPlan, getExpiryIsoForPlan, LIFETIME_EXPIRY_ISO } = require('./_shared/plans');
const { sanitizeUser, summarizeUsers } = require('./_shared/subscription-utils');
const { notifySubscriptionChange } = require('./_shared/subscription-email');
const {
  buildAdminReports,
  fetchUsageForUsers,
  fetchRecentPayments,
  usageFromAppDataDoc,
} = require('./_shared/admin-stats');

const ADMIN_CORS_ORIGINS = new Set([
  'https://argusinvoicing.com',
  'https://www.argusinvoicing.com',
  'https://argus-invocing.web.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

const ADMIN_SECRETS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'RESEND_API_KEY',
];

function setAdminCors(req, res) {
  const origin = String(req.get('origin') || '');
  if (ADMIN_CORS_ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Admin-Key');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
}

function extractToken(req) {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return '';
}

async function requireUser(req, res) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  try {
    return await verifyToken(token);
  } catch (_) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

async function listAllUsers(db) {
  const snap = await db.collection('users').get();
  return snap.docs.map((doc) => sanitizeUser(doc.id, doc.data()));
}

async function handleSession(req, res, decoded) {
  const db = getDb();
  const key = extractAdminKey(req);
  const keyCheck = await verifyAdminKey(db, key);
  const admin = await requireAdmin(req, res, decoded);
  if (!admin) return;
  return res.status(200).json({
    ok: true,
    email: admin.email,
    key_expires_at: admin.key_expires_at,
    key_valid: keyCheck.ok,
  });
}

async function handleOverview(req, res) {
  const decoded = await requireUser(req, res);
  if (!decoded) return;
  const admin = await requireAdmin(req, res, decoded);
  if (!admin) return;

  const db = getDb();
  const users = await listAllUsers(db);
  const summary = summarizeUsers(users);
  const linksSnap = await db.collection('links').where('status', '==', 'active').get();
  const userIds = users.map((u) => u.id);
  const [usageByUserId, payments] = await Promise.all([
    fetchUsageForUsers(db, userIds),
    fetchRecentPayments(db),
  ]);
  const reports = buildAdminReports({
    users,
    usageByUserId,
    payments,
    linksCount: linksSnap.size,
  });

  return res.status(200).json({
    summary: {
      ...summary,
      active_ca_links: linksSnap.size,
      usage: reports.usage,
      payments: reports.payments,
      subscription_details: reports.subscription,
    },
    key_expires_at: admin.key_expires_at,
    generated_at: reports.generated_at,
  });
}

async function handleReports(req, res) {
  const decoded = await requireUser(req, res);
  if (!decoded) return;
  const admin = await requireAdmin(req, res, decoded);
  if (!admin) return;

  const db = getDb();
  const users = await listAllUsers(db);
  const linksSnap = await db.collection('links').where('status', '==', 'active').get();
  const userIds = users.map((u) => u.id);
  const [usageByUserId, payments] = await Promise.all([
    fetchUsageForUsers(db, userIds),
    fetchRecentPayments(db),
  ]);

  return res.status(200).json({
    reports: buildAdminReports({
      users,
      usageByUserId,
      payments,
      linksCount: linksSnap.size,
    }),
    key_expires_at: admin.key_expires_at,
  });
}

async function handleUserUsage(req, res, userId) {
  const decoded = await requireUser(req, res);
  if (!decoded) return;
  const admin = await requireAdmin(req, res, decoded);
  if (!admin) return;

  const db = getDb();
  const user = await getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const appDataSnap = await db.collection('users').doc(userId).collection('app_data').doc('main').get();
  const usage = appDataSnap.exists ? usageFromAppDataDoc(appDataSnap.data()) : usageFromAppDataDoc(null);

  let payments = [];
  try {
    const paymentsSnap = await db
      .collection('payments')
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .limit(20)
      .get();
    payments = paymentsSnap.docs.map((doc) => ({
      id: doc.id,
      status: doc.data().status,
      source: doc.data().source,
      plan: doc.data().plan,
      amount_paise: doc.data().amount_paise,
      created_at: doc.data().created_at,
    }));
  } catch (_) {
    const paymentsSnap = await db.collection('payments').where('user_id', '==', userId).limit(50).get();
    payments = paymentsSnap.docs
      .map((doc) => ({
        id: doc.id,
        status: doc.data().status,
        source: doc.data().source,
        plan: doc.data().plan,
        amount_paise: doc.data().amount_paise,
        created_at: doc.data().created_at,
      }))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, 20);
  }

  return res.status(200).json({
    user: sanitizeUser(userId, user),
    usage,
    payments,
  });
}

async function handleUsers(req, res) {
  const decoded = await requireUser(req, res);
  if (!decoded) return;
  const admin = await requireAdmin(req, res, decoded);
  if (!admin) return;

  const db = getDb();
  const users = await listAllUsers(db);
  const q = String(req.query.q || '').trim().toLowerCase();
  const statusFilter = String(req.query.status || '').trim().toLowerCase();

  let filtered = users;
  if (q) {
    filtered = filtered.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.business_name.toLowerCase().includes(q) ||
        u.gstin.toLowerCase().includes(q),
    );
  }
  if (statusFilter) {
    filtered = filtered.filter((u) => u.subscription_status === statusFilter);
  }

  filtered.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

  const usageByUserId = await fetchUsageForUsers(
    db,
    filtered.map((u) => u.id),
  );
  const usersWithUsage = filtered.map((user) => ({
    ...user,
    usage: usageByUserId[user.id] || null,
  }));

  return res.status(200).json({
    users: usersWithUsage,
    total: usersWithUsage.length,
    key_expires_at: admin.key_expires_at,
  });
}

async function handleUpdateSubscription(req, res, userId) {
  const decoded = await requireUser(req, res);
  if (!decoded) return;
  const admin = await requireAdmin(req, res, decoded);
  if (!admin) return;

  const body = req.body || {};
  const action = String(body.action || 'grant').toLowerCase();
  const db = getDb();
  const user = await getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const now = new Date().toISOString();
  const previousSubscription = user.subscription || null;

  if (action === 'revoke') {
    const revoked = {
      plan: 'free',
      plan_key: 'free',
      active: false,
      expiry_date: now,
      updated_at: now,
      source: 'admin_revoke',
    };
    await updateUser(userId, {
      subscription: revoked,
      updated_at: now,
    });
    try {
      await notifySubscriptionChange(user, revoked, {
        event: 'revoked',
        previousSubscription,
        source: 'admin_revoke',
      });
    } catch (mailErr) {
      console.error('subscription email failed (admin revoke):', mailErr);
    }
    return res.status(200).json({ message: 'Subscription revoked', user_id: userId });
  }

  const planId = String(body.plan || 'business_lifetime').trim();
  const planConfig = getPlan(planId);
  if (!planConfig) return res.status(400).json({ error: 'Invalid plan' });

  let months = body.duration_months != null ? Number(body.duration_months) : planConfig.duration_months;
  if (action === 'extend') {
    const currentExpiry = previousSubscription?.expiry_date;
    const base = currentExpiry ? new Date(currentExpiry) : new Date();
    const anchor = Number.isFinite(base.getTime()) && base.getTime() > Date.now() ? base : new Date();
    const extendBy = Number(body.extend_months || months || 1);
    anchor.setMonth(anchor.getMonth() + extendBy);
    months = extendBy;

    const subscription = {
      plan: planConfig.plan_key,
      plan_key: planId,
      label: planConfig.label,
      expiry_date: anchor.toISOString(),
      active: true,
      auto_renew: previousSubscription?.auto_renew === true,
      updated_at: now,
      source: 'admin_extend',
    };

    await updateUser(userId, { subscription, updated_at: now });
    await db.collection('subscriptions').doc(userId).set(
      {
        user_id: userId,
        plan: subscription.plan,
        plan_key: subscription.plan_key,
        active: true,
        source: 'admin_extend',
        store: 'admin',
        expiry_date: subscription.expiry_date,
        updated_at: now,
      },
      { merge: true },
    );

    try {
      await notifySubscriptionChange(user, subscription, {
        event: 'updated',
        previousSubscription,
        source: 'admin_extend',
      });
    } catch (mailErr) {
      console.error('subscription email failed (admin extend):', mailErr);
    }

    return res.status(200).json({ message: 'Subscription extended', user_id: userId, subscription });
  }

  const expiryIso =
    planConfig.lifetime || planId === 'business_lifetime'
      ? LIFETIME_EXPIRY_ISO
      : getExpiryIsoForPlan(planConfig, months);

  const subscription = {
    plan: planConfig.plan_key,
    plan_key: planId,
    label: planConfig.label,
    expiry_date: expiryIso,
    active: true,
    auto_renew: planId === 'business_monthly' || planId === 'business_yearly' ? false : undefined,
    updated_at: now,
    source: 'admin_grant',
  };

  await updateUser(userId, { subscription, updated_at: now });
  await db.collection('subscriptions').doc(userId).set(
    {
      user_id: userId,
      plan: subscription.plan,
      plan_key: subscription.plan_key,
      active: true,
      source: 'admin_grant',
      store: 'admin',
      expiry_date: expiryIso,
      updated_at: now,
    },
    { merge: true },
  );
  try {
    const prevKey = previousSubscription?.plan_key || previousSubscription?.plan;
    const nextKey = subscription.plan_key || subscription.plan;
    const event =
      previousSubscription?.active && prevKey && prevKey !== 'free' && prevKey !== nextKey
        ? 'updated'
        : 'activated';
    await notifySubscriptionChange(user, subscription, {
      event,
      previousSubscription,
      source: 'admin_grant',
    });
  } catch (mailErr) {
    console.error('subscription email failed (admin grant):', mailErr);
  }
  return res.status(200).json({ message: 'Subscription updated', user_id: userId, subscription });
}

exports.apiAdmin = onRequest({ region: 'us-central1', maxInstances: 5, secrets: ADMIN_SECRETS }, async (req, res) => {
  setAdminCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).send('');

  const decoded = await requireUser(req, res);
  if (!decoded) return;

  const rl = await checkRateLimit(decoded.uid, 'admin_portal');
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded', retry_after_seconds: rl.retryAfterSeconds });
  }

  const path = String(req.path || '').replace(/\/+$/, '');

  if (req.method === 'GET' && path.endsWith('/admin/session')) {
    return handleSession(req, res, decoded);
  }
  if (req.method === 'GET' && path.endsWith('/admin/overview')) {
    return handleOverview(req, res);
  }
  if (req.method === 'GET' && path.endsWith('/admin/reports')) {
    return handleReports(req, res);
  }
  if (req.method === 'GET' && path.endsWith('/admin/users')) {
    return handleUsers(req, res);
  }

  const usageMatch = path.match(/\/admin\/users\/([^/]+)\/usage$/);
  if (req.method === 'GET' && usageMatch) {
    return handleUserUsage(req, res, decodeURIComponent(usageMatch[1]));
  }

  const subMatch = path.match(/\/admin\/users\/([^/]+)\/subscription$/);
  if (req.method === 'PUT' && subMatch) {
    return handleUpdateSubscription(req, res, decodeURIComponent(subMatch[1]));
  }

  return res.status(404).json({ error: 'Unknown admin route' });
});

exports.ensureAdminKey = rotateAdminAccessKey;
