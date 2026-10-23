/**
 * Published grievance / seller details. IT (SPDI) Rules 2011 r.5(9) and the
 * Consumer Protection (E-Commerce) Rules 2020 r.4 require the Grievance
 * Officer's name and contact details and the seller's geographic address.
 * Fields render only once filled in, so the site never shows placeholders.
 */
export const LEGAL_ENTITY = {
  name: "B&L Softwares and Logistics",
  email: "support@argusinvoicing.com",
  /** Registered / principal place of business. */
  address: "Hauz Khas, New Delhi 110016",
  /** Customer care phone. */
  phone: "+91 96549 54190",
  /** GSTIN, if registered. */
  gstin: "",
};

export const GRIEVANCE_OFFICER = {
  name: "Devansh Pundhir",
  designation: "Grievance Officer",
  email: "support@argusinvoicing.com",
  phone: "+91 96549 54190",
};

/** WhatsApp support chat (digits only, with country code). Shown as the floating chat button. */
export const SUPPORT_WHATSAPP = "919654954190";

/**
 * The promise shown wherever cloud sync is mentioned (it is on by default).
 * Every line must stay true: see the Privacy Policy, section 5.
 */
export const CLOUD_PROMISE = [
  "Your books are yours. We never sell them or use them for ads.",
  "Only you, the people you add and the CAs you invite can see them. Our staff look only to fix a problem you report, or when the law requires.",
  "Stored on Google Cloud, encrypted in transit and at rest. Turn sync off, export or delete everything at any time.",
];
