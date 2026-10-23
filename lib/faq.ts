/** Home page FAQ. Shared by the visible accordion and FAQPage JSON-LD so they never drift. */
export const HOME_FAQ: { q: string; a: string }[] = [
  {
    q: "Is Argus really free?",
    a: "Yes. The Android app is free for 20 bills a month (with a small \"Made with Argus\" watermark), plus customers and UPI payment links. Full books, the web app, GSTR summaries, and the CA portal are part of Business (₹500/month, ₹5,000/year, or ₹18,000 Lifetime for our first 200 early adopters).",
  },
  {
    q: "Does Argus file my GST returns?",
    a: "No. Argus prepares GSTR-1, GSTR-2B, and GSTR-3B style summaries and GSTN-format JSON so month-end is a review. You or your CA still file on the GST portal.",
  },
  {
    q: "Is Argus updated for GST 2.0 rates?",
    a: "Yes. New bills default to the 0%, 5%, 18%, and 40% slabs effective 22 September 2025, and the GST check flags old 12% or 28% rates on new invoices.",
  },
  {
    q: "How does my CA get access?",
    a: "Invite your accountant from the app. They get a free, read-only portal to your latest books — no extra seat charges — and you can remove them at any time.",
  },
  {
    q: "Where is my data stored?",
    a: "With Business, your books sync to your Argus account by default, so your phone, the website and your CA see the same books. They are yours: we never sell them or use them for ads, only you, the people you add and the CAs you invite can see them, and they are stored on Google Cloud, encrypted in transit and at rest. You can switch sync off, export or delete everything at any time.",
  },
  {
    q: "How do you keep up with GST changes?",
    a: "A panel of practising chartered accountants advises us on GST rules. When rates or rules change, we update the rate list and the GST checks within days, and the update reaches your app and the website without waiting for an app update.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Monthly and yearly Business plans auto-renew until you cancel. Cancelled renewals are not refunded for unused time — see the Refund Policy for details.",
  },
];
