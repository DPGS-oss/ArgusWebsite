function cleanSecret(value) {
  return String(value || '')
    .trim()
    .replace(/[\r\n]/g, '');
}

function getRazorpayCredentials() {
  const keyId = cleanSecret(process.env.RAZORPAY_KEY_ID);
  const keySecret = cleanSecret(process.env.RAZORPAY_KEY_SECRET);
  return { keyId, keySecret };
}

function getAuthHeader() {
  const { keyId, keySecret } = getRazorpayCredentials();
  if (!keyId || !keySecret) return null;
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
}

async function razorpayFetch(path, options = {}) {
  const authHeader = getAuthHeader();
  if (!authHeader) {
    const err = new Error('Razorpay not configured');
    err.status = 503;
    throw err;
  }

  const response = await fetch(`https://api.razorpay.com${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error?.description || data.error?.code || 'Razorpay API error');
    err.status = response.status;
    err.details = data;
    throw err;
  }
  return data;
}

module.exports = {
  cleanSecret,
  getRazorpayCredentials,
  getAuthHeader,
  razorpayFetch,
};
