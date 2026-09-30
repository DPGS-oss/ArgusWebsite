/**
 * Turns a spoken or typed order ("Sharma Traders ko do steel almirah, nau
 * hazaar each, aur delivery paanch sau") into a bill draft. TypeScript port of
 * argus/lib/services/local/invoice_text_parser.dart; keep the two in step.
 *
 * Prices are what the customer pays (GST-inclusive), matching the Android app.
 */

export type VoiceItem = { name: string; quantity: number; price: number; gstRate: number };
export type VoiceBill = {
  customerName: string | null;
  items: VoiceItem[];
  /** Delivery / shipping mentioned in the order (GST-inclusive). */
  delivery: number;
  language: string;
};

const SCRIPT_RANGES: Record<string, [number, number]> = {
  hi: [0x0900, 0x097f],
  bn: [0x0980, 0x09ff],
  pa: [0x0a00, 0x0a7f],
  gu: [0x0a80, 0x0aff],
  ta: [0x0b80, 0x0bff],
  te: [0x0c00, 0x0c7f],
  kn: [0x0c80, 0x0cff],
  ml: [0x0d00, 0x0d7f],
};

const HINGLISH = new Set([
  "aur", "phir", "wala", "wali", "ka", "ki", "ke", "ko", "rupaye", "rupaya", "paise", "kilo", "grahak",
  "liye", "bana", "banao", "bill", "dena", "ek", "do", "teen", "chaar", "paanch", "sau", "hazaar", "bhaiya", "ji",
]);

export function detectLanguage(text: string): string {
  const counts: Record<string, number> = {};
  for (const ch of text) {
    const cp = ch.codePointAt(0) || 0;
    for (const [lang, [lo, hi]] of Object.entries(SCRIPT_RANGES)) {
      if (cp >= lo && cp <= hi) counts[lang] = (counts[lang] || 0) + 1;
    }
  }
  const scripts = Object.entries(counts);
  if (scripts.length) return scripts.reduce((a, b) => (a[1] >= b[1] ? a : b))[0];
  const hits = text.toLowerCase().split(/[^a-z]+/).filter((w) => HINGLISH.has(w)).length;
  return hits >= 2 ? "hi-en" : "en";
}

const EN_UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const HI_UNITS: Record<string, number> = {
  ek: 1, do: 2, teen: 3, chaar: 4, char: 4, paanch: 5, panch: 5, che: 6, chhe: 6, saat: 7, aath: 8, nau: 9,
  das: 10, gyarah: 11, barah: 12, pandrah: 15, bees: 20, pachees: 25, tees: 30, chalis: 40, chaalis: 40,
  pachaas: 50, pachas: 50, saath: 60, sattar: 70, assi: 80, nabbe: 90,
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
  "बीस": 20, "पचास": 50,
};
const MULTIPLIERS: Record<string, number> = {
  hundred: 100, sau: 100, "सौ": 100, thousand: 1000, hazaar: 1000, hazar: 1000, "हज़ार": 1000, "हजार": 1000,
  lakh: 100000, "लाख": 100000,
};

/** "do sau" -> "200", "paanch hazaar" -> "5000", "two hundred fifty" -> "250". */
export function normalizeNumberWords(input: string): string {
  const out: string[] = [];
  let pending: number | null = null;
  const flush = () => {
    if (pending !== null) {
      out.push(String(pending));
      pending = null;
    }
  };
  for (const token of input.split(/\s+/)) {
    const clean = token.toLowerCase();
    const unit = EN_UNITS[clean] ?? HI_UNITS[clean];
    const mult = MULTIPLIERS[clean];
    if (unit !== undefined) pending = (pending ?? 0) + unit;
    else if (mult !== undefined) pending = (pending ? pending : 1) * mult;
    else {
      flush();
      out.push(token);
    }
  }
  flush();
  return out.join(" ");
}

export function normalizeDigits(input: string): string {
  return input.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
}

const NAME = "[a-zA-Z\\u0900-\\u0D7F]+";
const CUSTOMER_PATTERNS = [
  new RegExp(`(?:invoice|bill|receipt)\\s+(?:for|to|of)\\s+(?:mr\\.?\\s+|mrs\\.?\\s+|ms\\.?\\s+|shri\\s+|smt\\.?\\s+)?(${NAME}(?:\\s+${NAME}){0,2})`, "i"),
  new RegExp(`(?:customer|client|party|grahak|ग्राहक)\\s+(?:name\\s+)?(?:is\\s+|hai\\s+)?(${NAME}(?:\\s+${NAME}){0,2})`, "i"),
  new RegExp(`(${NAME}(?:\\s+${NAME}){0,1})\\s+(?:ke\\s+liye|के\\s+लिए|का\\s+बिल|ka\\s+bill)`, "i"),
  // Everyday Hinglish: "Sharma Traders ko do almirah ..."
  new RegExp(`^\\s*(${NAME}(?:\\s+${NAME}){0,2})\\s+(?:ko|को)\\b`, "i"),
];
const CUSTOMER_STOP = new Set([
  "the", "a", "an", "items", "item", "invoice", "bill", "add", "create", "make", "banao", "bana", "do", "and",
  "aur", "with", "rupees", "rs", "customer", "name", "is", "hai", "liye", "total", "gst",
]);

const titleCase = (v: string) => v.split(" ").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");

export function extractCustomerName(text: string): { name: string; match: string } | null {
  for (const pattern of CUSTOMER_PATTERNS) {
    const m = pattern.exec(text);
    if (!m) continue;
    const words = (m[1] || "").trim().split(/\s+/).filter((w) => w && !CUSTOMER_STOP.has(w.toLowerCase()));
    if (!words.length || words.every((w) => !Number.isNaN(Number(w)))) continue;
    const name = words.slice(0, 3).join(" ");
    if (name.length < 2) continue;
    return { name: titleCase(name), match: m[0] };
  }
  return null;
}

const SEGMENT_SEPARATORS = /\b(?:and|then|also|plus|next|aur|phir)\b|और|फिर|[,;\n]|तथा/i;
const UNIT_WORDS = "(?:packets?|packs?|pcs|pieces?|kgs?|kilos?|kilograms?|grams?|gms?|litres?|liters?|ltrs?|boxes?|units?|bottles?|bags?|dozens?|nos|sets?|pairs?|rolls?|sheets?|meters?|metres?)";
const CURRENCY_WORDS = /\b(?:rupees?|rupaye|rupaya|rupya|rs\.?|inr)\b|रुपये|रुपए|रूपए/gi;
const FILLER_WORDS = /\b(?:only|price|amount|cost|costs|worth|total|each|per|apiece|at|for|of|the|a|an|add|wala|wali|ka|ki|ke|mein|me|main|walla|het|par)\b/gi;
const DELIVERY_WORDS = /^(?:delivery|shipping|courier|freight|transport|bhada|bhaada|kiraya|bhara)(?:\s+(?:charges?|charge|cost|fee))?$/i;

type Parsed = { name: string; quantity: number; price: number; gstRate: number | null } | null;

function parseSegment(segment: string, defaultGstRate: number): Parsed {
  let s = segment;
  let gstRate: number | null = null;
  const gst = /(?:gst|tax)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*percent?|(\d+(?:\.\d+)?)\s*percent\s*(?:gst|tax)?/i.exec(s);
  if (gst) {
    const r = Number(gst[1] ?? gst[2]);
    gstRate = r >= 0 && r <= 100 ? r : null;
    s = s.slice(0, gst.index) + " " + s.slice(gst.index + gst[0].length);
  }

  let price: number | null = null;
  let priceIsTotal = false;
  const unitPrice = /(?:at|@)?\s*(?:rs\.?|rupees?|rupaye|inr|रुपये)?\s*(\d+(?:\.\d+)?)\s*(?:rs\.?|rupees?|rupaye|रुपये)?\s*(?:each|apiece|per\s+\w+|प्रत्येक)/i.exec(s);
  if (unitPrice) {
    price = Number(unitPrice[1]);
    s = s.slice(0, unitPrice.index) + " " + s.slice(unitPrice.index + unitPrice[0].length);
  }
  if (price === null) {
    const cur = /(?:(for|total)\s+)?(?:rs\.?|rupees?|rupaye|inr|रुपये)\s*(\d+(?:\.\d+)?)|(?:(for|total)\s+)?(\d+(?:\.\d+)?)\s*(?:rs\.?|rupees?|rupaye|रुपये|ka|ki|के|का)/i.exec(s);
    if (cur) {
      price = Number(cur[2] ?? cur[4]);
      priceIsTotal = (cur[1] ?? cur[3]) !== undefined;
      s = s.slice(0, cur.index) + " " + s.slice(cur.index + cur[0].length);
    }
  }

  let qty = 1;
  let qtyFound = false;
  const qtyUnit = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${UNIT_WORDS}`, "i").exec(s);
  if (qtyUnit) {
    qty = Number(qtyUnit[1]) || 1;
    if (/dozen/i.test(qtyUnit[0])) qty *= 12;
    qtyFound = true;
    s = s.replace(new RegExp(`\\b${qtyUnit[1].replace(".", "\\.")}\\b`), " ");
  }

  const nums = [...s.matchAll(/(\d+(?:\.\d{1,2})?)/g)].map((m) => m[1]);
  // A lone number leading the piece ("2 steel almirah") is a quantity, not a
  // price: let the caller carry it into the next piece ("9000 each").
  if (price === null && !qtyFound && nums.length === 1 && s.trimStart().startsWith(nums[0])) {
    return null;
  }
  if (price === null && nums.length) {
    price = Number(nums[nums.length - 1]);
    if (!qtyFound && nums.length >= 2) qty = Number(nums[0]) || 1;
  } else if (!qtyFound && nums.length) {
    qty = Number(nums[0]) || 1;
  }
  if (price === null || !(price > 0)) return null;
  qty = Math.max(0.01, Math.min(qty, 1e6));
  if (priceIsTotal && qty > 1) price = price / qty;

  const name = s
    .replace(/\b\d+(?:\.\d+)?\b/g, " ")
    .replace(CURRENCY_WORDS, " ")
    .replace(FILLER_WORDS, " ")
    .replace(/[^\w\sऀ-ൿ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || (new RegExp(`^${UNIT_WORDS}$`, "i").test(name))) return null;
  return { name: titleCase(name), quantity: qty, price, gstRate: gstRate ?? defaultGstRate };
}

export function parseVoiceBill(text: string, defaultGstRate = 18): VoiceBill {
  const language = detectLanguage(text);
  let t = normalizeDigits(text)
    .replace(/(?<=\d),(?=\d{3}\b)/g, "")
    .replace(/₹/g, " rs ")
    .replace(/%/g, " percent ")
    .replace(/@/g, " at ");
  t = normalizeNumberWords(t).replace(/\s+/g, " ").trim();

  const customer = extractCustomerName(t);
  // Remove the customer phrase so it never leaks into an item name.
  if (customer) t = t.replace(customer.match, " ").replace(/^\s*[:\-–]\s*/, "").trim();

  const items: VoiceItem[] = [];
  let delivery = 0;
  let carry = "";
  for (const raw of t.split(SEGMENT_SEPARATORS).map((x) => (x || "").trim()).filter(Boolean)) {
    // A piece with no price ("2 steel almirah") joins the next one ("9000 each").
    const parsed = parseSegment(`${carry} ${raw}`.trim(), defaultGstRate);
    if (!parsed) {
      carry = `${carry} ${raw}`.trim();
      continue;
    }
    carry = "";
    if (DELIVERY_WORDS.test(parsed.name)) delivery += parsed.price * parsed.quantity;
    else items.push({ name: parsed.name, quantity: parsed.quantity, price: parsed.price, gstRate: parsed.gstRate ?? defaultGstRate });
  }
  return { customerName: customer?.name ?? null, items, delivery, language };
}
