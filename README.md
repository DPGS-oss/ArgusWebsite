# Argus Website

Marketing website for [Argus GST Billing](https://github.com/DPGS-oss/Argus) — a Flutter-based GST invoicing and billing app for Indian businesses.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Hosting**: Netlify
- **Auth**: Firebase Authentication
- **Payments**: Razorpay (web subscriptions)

## Getting Started

```bash
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

## Project Structure

```
app/          - Next.js App Router pages
components/   - React components (Hero, Features, Pricing, etc.)
lib/          - Firebase config, auth provider, Razorpay utils
netlify/      - Netlify serverless functions (payment creation/verification)
public/       - Static assets (logo, store badges)
_legacy/      - Original static HTML site (kept for reference)
```

## Related

- [Argus App Repo](https://github.com/DPGS-oss/Argus) — Flutter mobile app
