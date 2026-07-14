const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

const PLAN_MAP = {
  business: { amount: 49900, label: 'Business Monthly' },
  business_yearly: { amount: 49900 * 12 * 0.83, label: 'Business Yearly' },
  accountant: { amount: 19900, label: 'Accountant Monthly' },
  accountant_yearly: { amount: 19900 * 12 * 0.83, label: 'Accountant Yearly' },
  extra_gstin: { amount: 19900, label: 'Extra GSTIN' },
};

function json(statusCode, body) {
  return { statusCode, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return json(503, { error: 'Payment service not configured' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const plan = body.plan || 'business';
  const planConfig = PLAN_MAP[plan];
  if (!planConfig) {
    return json(400, { error: 'Invalid plan' });
  }

  const amount = Math.round(planConfig.amount);
  if (amount < 100) {
    return json(400, { error: 'Amount must be at least 100 paise (Rs. 1)' });
  }

  const receipt = `web_${plan}_${Date.now()}`;
  const authHeader = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
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
      return json(500, { error: 'Failed to create order', details: errorData.error?.description });
    }

    const order = await response.json();
    return json(200, {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Create order error:', error);
    return json(500, { error: 'Failed to create payment order' });
  }
};
