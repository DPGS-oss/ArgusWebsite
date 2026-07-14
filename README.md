# Argus Website

Marketing website for [Argus GST Billing](https://github.com/DPGS-oss/Argus) — a Flutter-based GST invoicing and billing app for Indian businesses.

## Tech Stack

- **Framework**: Next.js 15 (App Router, static export)
- **Styling**: Tailwind CSS
- **Hosting**: Firebase Hosting
- **Functions**: Firebase Cloud Functions (Node 20)
- **Auth**: Firebase Authentication
- **Database**: Firestore
- **Payments**: Razorpay (web subscriptions)

## Getting Started

```bash
npm install
npm run dev
```

For local development with Cloud Functions emulator:

```bash
firebase emulators:start   # in a separate terminal
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_FIREBASE_API_KEY` — Firebase API key
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` — Firebase auth domain
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` — Firebase project ID
- `NEXT_PUBLIC_FIREBASE_APP_ID` — Firebase app ID
- `RAZORPAY_KEY_ID` — Razorpay key ID (set as Cloud Functions secret)
- `RAZORPAY_KEY_SECRET` — Razorpay key secret (set as Cloud Functions secret, never expose to client)

Cloud Functions secrets are set via:
```bash
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
```

Firebase Admin SDK auto-initializes in Cloud Functions — no service account key needed.

## Project Structure

```
app/              - Next.js App Router pages (marketing + /app web app)
components/       - React components (marketing + web app)
lib/              - Firebase config, auth provider, Razorpay utils, types, storage, GST utils
functions/        - Firebase Cloud Functions (API endpoints, rate limiting)
  _shared/        - Shared modules (firebase-admin, plans, rate-limit)
  index.js        - All Cloud Function endpoints
public/           - Static assets (logo, store badges)
_legacy/          - Original static HTML site (kept for reference)
```

## Deployment

```bash
npm run build
firebase deploy
```

This deploys:
- Static site to Firebase Hosting (serves `out/` directory)
- Cloud Functions to Firebase Functions
- API routes are wired via `firebase.json` rewrites

## Custom Domain

To set up `argusinvoicing.com` as the main domain:

1. Go to Firebase Console > Hosting > Add custom domain
2. Enter `argusinvoicing.com`
3. Add the provided DNS A/CNAME records to your domain registrar
4. Wait for SSL provisioning (usually 15-30 minutes)
5. Add `www.argusinvoicing.com` as a redirect to the apex domain

## Rate Limiting

All API endpoints have rate limiting stored in Firestore (`rate_limits` collection):

| Endpoint | Limit | Window |
|---|---|---|
| `/api/auth/sync` | 1 call | 1 hour |
| `/api/user/profile` (GET) | 10 calls | 1 minute |
| `/api/user/profile` (PUT) | 5 calls | 1 minute |
| `/api/payment/create-order` | 5 calls | 1 minute |
| `/api/payment/verify` | 5 calls | 1 minute |

This prevents runaway Firebase billing from excessive syncs or abuse.

## Related

- [Argus App Repo](https://github.com/DPGS-oss/Argus) — Flutter mobile app
