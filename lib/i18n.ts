export type WebsiteLang = "en" | "hi";

const HI: Record<string, string> = {
  booksTitle: "बही",
  booksSubtitle: "पार्टी, नकद, बैंक और लाभ-हानि। कोई जर्नल स्क्रीन नहीं।",
  party: "पार्टी",
  cash: "नकद",
  bank: "बैंक",
  pnl: "लाभ-हानि",
  opening: "ओपनिंग",
  noParty: "अभी कोई पार्टी बकाया नहीं। नीचे उधार या भुगतान दर्ज करें।",
  noCash: "अभी कोई नकद लेन-देन नहीं। नीचे नकद अंदर/बाहर दर्ज करें।",
  noBank: "अभी कोई बैंक लेन-देन नहीं। नीचे बैंक अंदर/बाहर दर्ज करें।",
  addEntry: "जोड़ें",
  amount: "राशि",
  particulars: "विवरण",
  paymentReceived: "भुगतान मिला",
  moneyIn: "अंदर",
  moneyOut: "बाहर",
  partyName: "पार्टी का नाम",
  postTo: "पैसे इसमें डालें",
  none: "नहीं",
  udhaar: "उधार",
  advance: "एडवांस",
  caClients: "क्लाइंट",
  caOverview: "सारांश",
  caInvoices: "इनवॉइस",
  caPurchases: "खरीद",
  caExpenses: "खर्च",
  caKhata: "पार्टी",
  caGst: "GST पैक",
  caPlaintext: "CA आपकी बही सादे पाठ में देखता है जब तक E2EE नहीं आता।",
  downloadGstn: "GSTN JSON डाउनलोड",
};

const EN: Record<string, string> = {
  booksTitle: "Books",
  booksSubtitle: "Party, Cash, Bank, and P&L. No journal screen.",
  party: "Party",
  cash: "Cash",
  bank: "Bank",
  pnl: "P&L",
  opening: "Opening",
  noParty: "No Party balances yet. Record udhaar or a payment below.",
  noCash: "No Cash movements yet. Record cash in or out below.",
  noBank: "No Bank movements yet. Record bank in or out below.",
  addEntry: "Add",
  amount: "Amount",
  particulars: "Particulars",
  paymentReceived: "Payment received",
  moneyIn: "In",
  moneyOut: "Out",
  partyName: "Party name",
  postTo: "Also post to",
  none: "None",
  udhaar: "Udhaar",
  advance: "Advance",
  caClients: "Clients",
  caOverview: "Overview",
  caInvoices: "Invoices",
  caPurchases: "Purchases",
  caExpenses: "Expenses",
  caKhata: "Party",
  caGst: "GST pack",
  caPlaintext: "CA sees your books in plaintext until E2EE ships.",
  downloadGstn: "Download GSTN JSON",
};

export function detectWebsiteLang(): WebsiteLang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem("argus.lang");
    if (stored === "hi" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en") || "en";
  return nav.toLowerCase().startsWith("hi") ? "hi" : "en";
}

export function t(key: string, lang: WebsiteLang = detectWebsiteLang()): string {
  const table = lang === "hi" ? HI : EN;
  return table[key] || EN[key] || key;
}
