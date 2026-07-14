const crypto = require('crypto');

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

function json(statusCode, body) {
  return { statusCode, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!RAZORPAY_KEY_SECRET) {
    return json(503, { error: 'Payment service not configured' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json(400, { error: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature' });
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return json(400, { error: 'Invalid payment signature' });
    }

    return json(200, {
      message: 'Payment verified successfully',
      verified: true,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return json(500, { error: 'Payment verification failed' });
  }
};
