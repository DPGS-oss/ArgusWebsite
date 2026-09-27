/** Home page FAQ. Shared by the visible accordion and FAQPage JSON-LD so they never drift. */
export const HOME_FAQ: { q: string; a: string }[] = [
  {
    q: "Is Argus really free?",
    a: "Yes. The Android app is free with unlimited invoices, customers, and UPI payment links. Full books, the web app, GSTR summaries, and the CA portal are part of Business (₹500/month, ₹5,000/year, or ₹18,000 Lifetime).",
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
    a: "Invite your accountant from the app. They get a free, read-only portal to your books — no extra seat charges — and you control what they can see.",
  },
  {
    q: "Where is my data stored?",
    a: "On the web, books live in your browser and can be backed up to a local folder. Cloud sync to your Argus account is optional and can be switched off in Settings.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Monthly and yearly Business plans auto-renew until you cancel. Cancelled renewals are not refunded for unused time — see the Refund Policy for details.",
  },
];
