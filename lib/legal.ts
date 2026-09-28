/**
 * Published grievance / seller details. IT (SPDI) Rules 2011 r.5(9) and the
 * Consumer Protection (E-Commerce) Rules 2020 r.4 require the Grievance
 * Officer's name and contact details and the seller's geographic address.
 * Fields render only once filled in, so the site never shows placeholders.
 */
export const LEGAL_ENTITY = {
  name: "B&L Softwares and Logistics",
  email: "support@argusinvoicing.com",
  /** Registered / principal place of business. REQUIRED before launch. */
  address: "",
  /** Customer care phone. REQUIRED before launch. */
  phone: "",
  /** GSTIN, if registered. */
  gstin: "",
};

export const GRIEVANCE_OFFICER = {
  /** Full name of the Grievance Officer. REQUIRED before launch. */
  name: "",
  designation: "Grievance Officer",
  email: "support@argusinvoicing.com",
  phone: "",
};
