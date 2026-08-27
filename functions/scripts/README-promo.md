# Beta promo codes (₹118 / 3 months)

## Seed 50 single-use codes (production or emulator)

```bash
cd functions
# ADC or service account required for the target Firebase project
npm run seed:promo
```

Creates `promo_codes/{CODE}` docs and writes a private CSV:
`functions/scripts/promo-codes-<timestamp>.csv` (gitignored).

## Local smoke path

1. Deploy/update functions + Firestore rules, or run emulators.
2. Sign in on the website.
3. On Pricing or SubscriptionGate, apply an `ARGUS-…` code.
4. Pay ₹118 via Razorpay test keys.
5. Confirm Firestore: code `status: redeemed`, user Business expiry ~+3 months.

## Security notes

- Codes are single-use; reserved for 20 minutes during checkout.
- One beta offer per user (`promo_offer_used`).
- Clients cannot read `promo_codes` / `promo_redemptions` / `payments`.
- Verify checks Razorpay amount + payment replay.
