export type GSTRate = 0 | 3 | 5 | 12 | 18 | 28;

export type InvoiceStatus = "draft" | "paid" | "unpaid" | "cancelled";

export type InvoiceType = "tax_invoice" | "bill_of_supply" | "credit_note" | "debit_note";

export interface BusinessProfile {
  id: string;
  name: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
  upiId: string;
  logo?: string;
}

export interface Party {
  id: string;
  name: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  type: "customer" | "supplier";
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  hsn: string;
  quantity: number;
  unit: string;
  rate: number;
  discount: number;
  gstRate: GSTRate;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  stockItemId?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  businessId: string;
  partyId: string;
  partyName: string;
  partyGstin: string;
  partyPhone: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  totalDiscount: number;
  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  balanceDue: number;
  paymentMode: string;
  notes: string;
  terms: string;
  placeOfSupply: string;
  isInterState: boolean;
  isTotalMode: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HSNCode {
  code: string;
  description: string;
  gstRate: GSTRate;
  category: string;
}

export interface StockItem {
  id: string;
  name: string;
  hsn: string;
  unit: string;
  openingStock: number;
  currentStock: number;
  minStock: number;
  rate: number;
  gstRate: GSTRate;
  barcode?: string;
}

export interface AppData {
  businesses: BusinessProfile[];
  parties: Party[];
  invoices: Invoice[];
  stock: StockItem[];
  activeBusinessId: string | null;
  invoiceCounter: number;
  settings: AppSettings;
}

export interface AppSettings {
  theme: "dark" | "light";
  currency: string;
  invoicePrefix: string;
  invoiceSuffix: string;
  defaultGstRate: GSTRate;
  defaultPaymentTerms: string;
  defaultNotes: string;
  defaultTerms: string;
  roundOff: boolean;
  folderName: string;
}

export type GSTRReportType = "gstr1" | "gstr2b" | "gstr3b" | "gstr4";

export interface GSTRReport {
  type: GSTRReportType;
  period: string;
  fromDate: string;
  toDate: string;
  totalInvoices: number;
  totalTaxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  totalInvoiceValue: number;
  sections: GSTRSection[];
}

export interface GSTRSection {
  section: string;
  description: string;
  invoices: Invoice[];
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  invoiceValue: number;
}

export type View =
  | "dashboard"
  | "invoices"
  | "invoice-form"
  | "invoice-preview"
  | "parties"
  | "reports"
  | "stock"
  | "business"
  | "settings";

export const INDIAN_STATES: { name: string; code: string }[] = [
  { name: "Andhra Pradesh", code: "37" },
  { name: "Arunachal Pradesh", code: "12" },
  { name: "Assam", code: "18" },
  { name: "Bihar", code: "10" },
  { name: "Chhattisgarh", code: "22" },
  { name: "Goa", code: "30" },
  { name: "Gujarat", code: "24" },
  { name: "Haryana", code: "06" },
  { name: "Himachal Pradesh", code: "02" },
  { name: "Jharkhand", code: "20" },
  { name: "Karnataka", code: "29" },
  { name: "Kerala", code: "32" },
  { name: "Madhya Pradesh", code: "23" },
  { name: "Maharashtra", code: "27" },
  { name: "Manipur", code: "14" },
  { name: "Meghalaya", code: "17" },
  { name: "Mizoram", code: "15" },
  { name: "Nagaland", code: "13" },
  { name: "Odisha", code: "21" },
  { name: "Punjab", code: "03" },
  { name: "Rajasthan", code: "08" },
  { name: "Sikkim", code: "11" },
  { name: "Tamil Nadu", code: "33" },
  { name: "Telangana", code: "36" },
  { name: "Tripura", code: "16" },
  { name: "Uttar Pradesh", code: "09" },
  { name: "Uttarakhand", code: "05" },
  { name: "West Bengal", code: "19" },
  { name: "Andaman and Nicobar Islands", code: "35" },
  { name: "Chandigarh", code: "04" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", code: "26" },
  { name: "Delhi", code: "07" },
  { name: "Jammu and Kashmir", code: "01" },
  { name: "Ladakh", code: "38" },
  { name: "Lakshadweep", code: "31" },
  { name: "Puducherry", code: "34" },
];

export const UNITS = [
  "NOS",
  "PCS",
  "KG",
  "GM",
  "LTR",
  "ML",
  "MTR",
  "CM",
  "BOX",
  "PKT",
  "SET",
  "PR",
  "DAY",
  "HRS",
  "JOB",
  "BAG",
  "ROLL",
  "LOT",
];

export const PAYMENT_MODES = [
  "Cash",
  "UPI",
  "Bank Transfer",
  "Cheque",
  "Card",
  "Other",
];
