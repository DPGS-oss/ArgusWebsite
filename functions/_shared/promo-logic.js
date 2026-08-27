const RESERVATION_TTL_MS = 20 * 60 * 1000;

function maxRedemptions(data) {
  const n = Number(data && data.max_redemptions);
  return n > 0 ? n : 1;
}

function isExhausted(data) {
  if (!data) return true;
  if (data.status === 'disabled' || data.status === 'redeemed') return true;
  return (data.redemption_count || 0) >= maxRedemptions(data);
}

function pruneReservations(data, nowMs) {
  const reservations = { ...((data && data.reservations) || {}) };
  if (maxRedemptions(data) > 1 && data.status === 'reserved' && data.reserved_by) {
    if (!reservations[data.reserved_by]) {
      reservations[data.reserved_by] = {
        at: data.reserved_at,
        order_id: data.reserved_order_id || null,
      };
    }
  }
  for (const [uid, slot] of Object.entries(reservations)) {
    const at = slot && slot.at ? Date.parse(slot.at) : 0;
    if (!at || nowMs - at > RESERVATION_TTL_MS) delete reservations[uid];
  }
  return reservations;
}

function slotsTaken(redemptionCount, reservations) {
  return (redemptionCount || 0) + Object.keys(reservations || {}).length;
}

function hasRedeemedPayment(data, paymentId) {
  if (!paymentId || !data) return false;
  if (data.redeemed_payment_id === paymentId) return true;
  return (data.redeemed_payment_ids || []).includes(paymentId);
}

function hasRedeemedUid(data, uid) {
  if (!uid || !data) return false;
  if (data.redeemed_by === uid) return true;
  return (data.redeemed_uids || []).includes(uid);
}

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = {
  RESERVATION_TTL_MS,
  maxRedemptions,
  isExhausted,
  pruneReservations,
  slotsTaken,
  hasRedeemedPayment,
  hasRedeemedUid,
  fail,
};
