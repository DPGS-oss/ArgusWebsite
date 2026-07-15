const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const crypto = require('crypto');
const { verifyToken, getUser, createUser, updateUser, getDb, getAuth } = require('./_shared/firebase-admin');
const { getPlan, getAllPlans } = require('./_shared/plans');
const { checkRateLimit } = require('./_shared/rate-limit');

const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || '').trim().replace(/[\r\n]/g, '');
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || '').trim().replace(/[\r\n]/g, '');

const FIREBASE_SECRETS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];
const RAZORPAY_SECRETS = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];

function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

function rateLimitHeaders(result) {
  if (!result) return {};
  return {
    'X-RateLimit-Limit': result.limit || '',
    'X-RateLimit-Remaining': result.remaining !== undefined ? String(result.remaining) : '',
    'Retry-After': result.retryAfterSeconds ? String(result.retryAfterSeconds) : '',
  };
}

// ==================== /api/config ====================
exports.apiConfig = onRequest({ region: 'us-central1', maxInstances: 10, secrets: FIREBASE_SECRETS }, (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const clean = (v) => (v || '').trim().replace(/[\r\n]/g, '');
  const firebase_api_key = clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const firebase_auth_domain = clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
  const firebase_project_id = clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const firebase_app_id = clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);

  if (!firebase_api_key || !firebase_project_id) {
    return res.status(503).json({ error: 'Firebase not configured' });
  }

  return res.status(200).json({
    firebase_api_key,
    firebase_auth_domain,
    firebase_project_id,
    firebase_app_id,
  });
});

// ==================== /api/auth/plans ====================
exports.apiAuthPlans = onRequest({ region: 'us-central1', maxInstances: 10 }, (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(200).json({ plans: getAllPlans() });
});

// ==================== /api/auth/sync ====================
exports.apiAuthSync = onRequest({ region: 'us-central1', maxInstances: 10, secrets: FIREBASE_SECRETS }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const uid = decoded.uid;
  const email = decoded.email || '';
  const name = decoded.name || (email ? email.split('@')[0] : 'User');

  const body = req.body || {};
  const displayName = body.name || name;

  const rl = await checkRateLimit(uid, 'auth_sync');
  if (!rl.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Sync is limited to once per hour.',
      retry_after_seconds: rl.retryAfterSeconds,
    });
  }

  let user = await getUser(uid);

  if (!user) {
    const now = new Date().toISOString();
    const newUserData = {
      name: displayName,
      email,
      business_name: '',
      gstin: '',
      phone: '',
      subscription: null,
      customer_id: null,
      created_at: now,
      updated_at: now,
    };
    user = await createUser(uid, newUserData);
    return res.status(200).json({ user, requires_subscription: true });
  }

  return res.status(200).json({ user });
});

// ==================== /api/user/profile ====================
exports.apiUserProfile = onRequest({ region: 'us-central1', maxInstances: 10, secrets: FIREBASE_SECRETS }, async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const uid = decoded.uid;

  if (req.method === 'GET') {
    const rl = await checkRateLimit(uid, 'user_profile_get');
    if (!rl.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retry_after_seconds: rl.retryAfterSeconds,
      });
    }

    const user = await getUser(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ user });
  }

  if (req.method === 'PUT') {
    const rl = await checkRateLimit(uid, 'user_profile_put');
    if (!rl.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Too many profile updates.',
        retry_after_seconds: rl.retryAfterSeconds,
      });
    }

    const body = req.body || {};
    const updateData = { updated_at: new Date().toISOString() };
    if (body.business_name !== undefined) updateData.business_name = body.business_name;
    if (body.gstin !== undefined) updateData.gstin = body.gstin;
    if (body.phone !== undefined) updateData.phone = body.phone;

    const user = await updateUser(uid, updateData);
    return res.status(200).json({ user });
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

// ==================== /api/payment/create-order ====================
exports.apiPaymentCreateOrder = onRequest({ region: 'us-central1', maxInstances: 10, secrets: RAZORPAY_SECRETS }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: 'Payment service not configured' });
  }

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const uid = decoded.uid;

  const rl = await checkRateLimit(uid, 'payment_create_order');
  if (!rl.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Too many payment attempts.',
      retry_after_seconds: rl.retryAfterSeconds,
    });
  }

  const body = req.body || {};
  const plan = body.plan || 'business';
  const planConfig = getPlan(plan);
  if (!planConfig) return res.status(400).json({ error: 'Invalid plan' });

  const amount = Math.round(planConfig.amount);
  if (amount < 100) return res.status(400).json({ error: 'Amount must be at least 100 paise (Rs. 1)' });

  const receipt = `web_${plan}_${Date.now()}`;
  const authHeaderRz = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeaderRz,
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt,
        payment_capture: 1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Razorpay order creation failed:', errorData);
      return res.status(500).json({ error: 'Failed to create order', details: errorData.error?.description });
    }

    const order = await response.json();
    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// ==================== /api/payment/verify ====================
exports.apiPaymentVerify = onRequest({ region: 'us-central1', maxInstances: 10, secrets: RAZORPAY_SECRETS }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: 'Payment service not configured' });
  }

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const uid = decoded.uid;

  const rl = await checkRateLimit(uid, 'payment_verify');
  if (!rl.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Too many verification attempts.',
      retry_after_seconds: rl.retryAfterSeconds,
    });
  }

  const body = req.body || {};
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, duration_months } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature' });
  }

  const planConfig = getPlan(plan);
  if (!planConfig) return res.status(400).json({ error: 'Invalid plan' });

  try {
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const months = duration_months || planConfig.duration_months;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + months);

    const subscription = {
      plan: planConfig.plan_key,
      label: planConfig.label,
      expiry_date: expiryDate.toISOString(),
      active: true,
      updated_at: new Date().toISOString(),
    };

    const user = await getUser(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let customerId = user.customer_id;
    if (!customerId) {
      const hash = crypto.createHash('sha256').update(uid + (user.email || '')).digest('hex');
      customerId = `cust_${hash.substring(0, 16)}`;
    }

    const updateData = {
      subscription,
      customer_id: customerId,
      updated_at: new Date().toISOString(),
    };

    const updatedUser = await updateUser(uid, updateData);

    return res.status(200).json({
      message: 'Payment verified and subscription activated',
      verified: true,
      subscription,
      customer_id: customerId,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ error: 'Payment verification failed' });
  }
});

// ==================== /api/account/delete ====================
exports.apiAccountDelete = onRequest({ region: 'us-central1', maxInstances: 10, secrets: FIREBASE_SECRETS }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const email = (body.email || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  const reason = (body.reason || '').trim();

  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Rate limit by email
  const rl = await checkRateLimit(`delete_${email}`, 'account_delete');
  if (!rl.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. You have already submitted a deletion request recently.',
      retry_after_seconds: rl.retryAfterSeconds,
    });
  }

  let uid = null;

  // If auth token is provided, verify and use it for actual deletion
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = await verifyToken(token);
      uid = decoded.uid;
    } catch (err) {
      // Token invalid — continue as unauthenticated request
    }
  }

  const db = getDb();
  const requestData = {
    email,
    name,
    reason,
    uid,
    status: uid ? 'pending' : 'pending_verification',
    created_at: new Date().toISOString(),
  };

  await db.collection('deletion_requests').add(requestData);

  // If user is authenticated, delete their data immediately
  if (uid) {
    try {
      const auth = getAuth();
      // Delete Firestore user document
      await db.collection('users').doc(uid).delete();
      // Delete the auth account
      await auth.deleteUser(uid);
      // Update request status
      // Note: we can't update the doc we just added without a reference,
      // but the deletion is done
    } catch (err) {
      console.error('Account deletion error:', err);
      // Don't fail the response — the request is recorded
    }
  }

  return res.status(200).json({
    message: 'Deletion request received. We will process it within 30 days.',
    email,
  });
});

// ==================== Scheduled cleanup for rate_limits ====================
exports.cleanupRateLimits = onSchedule(
  { schedule: '0 3 * * *', region: 'us-central1', maxInstances: 1 },
  async () => {
    const db = getDb();
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    const usersSnapshot = await db.collection('rate_limits').get();

    let deletedCount = 0;
    for (const userDoc of usersSnapshot.docs) {
      const endpoints = await userDoc.ref.listCollections();
      for (const endpointCol of endpoints) {
        const oldDocs = await endpointCol.where('timestamp', '<', cutoff).get();
        for (const doc of oldDocs.docs) {
          await doc.ref.delete();
          deletedCount++;
        }
      }
    }

    console.log(`Rate limit cleanup: deleted ${deletedCount} old entries`);
  }
);
