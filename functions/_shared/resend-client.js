const { Resend } = require('resend');

/** Verified sender on argusinvoicing.com (Resend). Override with ADMIN_FROM_EMAIL. */
const DEFAULT_FROM = 'Argus GST Billing <noreply@argusinvoicing.com>';
const DEFAULT_REPLY_TO = 'support@argusinvoicing.com';

function getResendApiKey() {
  return (process.env.RESEND_API_KEY || '').trim();
}

function getFromAddress() {
  return (process.env.ADMIN_FROM_EMAIL || DEFAULT_FROM).trim();
}

function getReplyTo() {
  return (process.env.REPLY_TO_EMAIL || DEFAULT_REPLY_TO).trim();
}

function getResendClient() {
  const apiKey = getResendApiKey();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

/**
 * @param {{ to: string | string[], subject: string, text?: string, html?: string, from?: string }} opts
 */
async function sendEmail(opts) {
  const resend = getResendClient();
  if (!resend) {
    return { sent: false, reason: 'no_resend_key' };
  }

  const to = Array.isArray(opts.to) ? opts.to : [opts.to];
  const payload = {
    from: opts.from || getFromAddress(),
    to,
    subject: opts.subject,
    reply_to: opts.reply_to || getReplyTo(),
  };
  if (opts.html) payload.html = opts.html;
  if (opts.text) payload.text = opts.text;

  const { data, error } = await resend.emails.send(payload);
  if (error) {
    console.error('resend: send failed', error);
    return { sent: false, reason: 'resend_failed', error };
  }
  return { sent: true, id: data?.id || null };
}

module.exports = { sendEmail, getResendClient, getFromAddress, getReplyTo, DEFAULT_FROM, DEFAULT_REPLY_TO };
