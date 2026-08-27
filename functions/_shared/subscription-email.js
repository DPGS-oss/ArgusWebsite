const { sendEmail } = require('./resend-client');

const SITE_APP_URL = 'https://argusinvoicing.com/app/';

function formatExpiry(iso) {
  if (!iso) return 'No expiry set';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  if (d.getFullYear() >= 2099) return 'Lifetime access';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function planLabel(sub) {
  if (!sub) return 'Free';
  return sub.label || sub.plan_key || sub.plan || 'Business';
}

function sourceLabel(source) {
  const map = {
    razorpay: 'Website payment (Razorpay)',
    razorpay_promo: 'Website promo offer',
    admin_grant: 'Support team',
    admin_revoke: 'Support team',
    trial: '14-day free trial',
  };
  return map[source] || source || 'Argus';
}

function buildSubscriptionMessage({ name, event, subscription, previousSubscription, source }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const plan = planLabel(subscription);
  const expiry = formatExpiry(subscription?.expiry_date);
  const prevPlan = planLabel(previousSubscription);
  const via = sourceLabel(source);

  if (event === 'revoked') {
    return {
      subject: 'Argus Business subscription ended',
      text: [
        greeting,
        '',
        'Your Argus Business subscription is no longer active.',
        previousSubscription ? `Previous plan: ${prevPlan}` : '',
        '',
        'You can still sign in and use free-tier features. To renew, visit https://argusinvoicing.com/#pricing',
        '',
        '— Argus GST Billing',
      ]
        .filter(Boolean)
        .join('\n'),
      html: [
        `<p>${greeting}</p>`,
        '<p>Your <strong>Argus Business</strong> subscription is no longer active.</p>',
        previousSubscription ? `<p>Previous plan: <strong>${prevPlan}</strong></p>` : '',
        '<p>You can still sign in and use free-tier features. To renew, visit <a href="https://argusinvoicing.com/#pricing">argusinvoicing.com</a>.</p>',
        '<p>— Argus GST Billing</p>',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  if (event === 'updated') {
    return {
      subject: `Argus subscription updated — ${plan}`,
      text: [
        greeting,
        '',
        'Your Argus subscription has been updated.',
        `New plan: ${plan}`,
        `Valid until: ${expiry}`,
        `Updated by: ${via}`,
        previousSubscription && prevPlan !== plan ? `Previous plan: ${prevPlan}` : '',
        '',
        `Open the web app: ${SITE_APP_URL}`,
        '',
        '— Argus GST Billing',
      ]
        .filter(Boolean)
        .join('\n'),
      html: [
        `<p>${greeting}</p>`,
        '<p>Your Argus subscription has been <strong>updated</strong>.</p>',
        `<p>New plan: <strong>${plan}</strong><br/>Valid until: <strong>${expiry}</strong><br/>Updated by: ${via}</p>`,
        previousSubscription && prevPlan !== plan
          ? `<p>Previous plan: ${prevPlan}</p>`
          : '',
        `<p><a href="${SITE_APP_URL}">Open the web app</a></p>`,
        '<p>— Argus GST Billing</p>',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  return {
    subject: `Argus Business subscription confirmed — ${plan}`,
    text: [
      greeting,
      '',
      'Thank you — your Argus Business subscription is now active.',
      `Plan: ${plan}`,
      `Valid until: ${expiry}`,
      `Confirmed via: ${via}`,
      '',
      `Launch the web app: ${SITE_APP_URL}`,
      '',
      '— Argus GST Billing',
    ].join('\n'),
    html: [
      `<p>${greeting}</p>`,
      '<p>Thank you — your <strong>Argus Business</strong> subscription is now <strong>active</strong>.</p>',
      `<p>Plan: <strong>${plan}</strong><br/>Valid until: <strong>${expiry}</strong><br/>Confirmed via: ${via}</p>`,
      `<p><a href="${SITE_APP_URL}">Launch the web app</a></p>`,
      '<p>— Argus GST Billing</p>',
    ].join('\n'),
  };
}

/**
 * @param {'activated'|'updated'|'revoked'} event
 */
async function notifySubscriptionChange(user, subscription, { event, previousSubscription, source } = {}) {
  const email = String(user?.email || '').trim();
  if (!email) {
    return { sent: false, reason: 'no_email' };
  }

  const { subject, text, html } = buildSubscriptionMessage({
    name: user.name || user.displayName || '',
    event,
    subscription,
    previousSubscription,
    source,
  });

  return sendEmail({ to: email, subject, text, html });
}

module.exports = {
  notifySubscriptionChange,
  buildSubscriptionMessage,
  formatExpiry,
  planLabel,
};
