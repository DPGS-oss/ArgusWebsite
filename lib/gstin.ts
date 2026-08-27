const GSTN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export type GstinValidation = { ok: true } | { ok: false; error: string };

export function isUrp(value: string | undefined | null): boolean {
  return normalizeGstin(value) === "URP";
}

export function normalizeGstin(value: string | undefined | null): string {
  const trimmed = (value || "").trim().toUpperCase();
  if (!trimmed) return "URP";
  return trimmed;
}

export function gstinCheckDigit(first14: string): string {
  const input = first14.trim().toUpperCase();
  let factor = 2;
  let sum = 0;
  const mod = GSTN_CHARS.length;

  for (let i = input.length - 1; i >= 0; i--) {
    const codePoint = GSTN_CHARS.indexOf(input[i]);
    if (codePoint < 0) return "";
    let digit = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    digit = Math.floor(digit / mod) + (digit % mod);
    sum += digit;
  }

  const checkCodePoint = (mod - (sum % mod)) % mod;
  return GSTN_CHARS[checkCodePoint];
}

export function stateCodeFromGstin(gstin: string | undefined | null): string | null {
  const normalized = (gstin || "").trim().toUpperCase();
  if (!normalized || normalized === "URP" || normalized.length < 2) return null;
  const code = normalized.slice(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

export function isRegisteredGstin(value: string | undefined | null): boolean {
  const trimmed = (value || "").trim().toUpperCase();
  if (!trimmed || trimmed === "URP") return false;
  return validateGstin(trimmed).ok;
}

export function isValidGstin(value: string | undefined | null): boolean {
  return validateGstin(value).ok;
}

export function validateGstin(value: string | undefined | null): GstinValidation {
  const trimmed = (value || "").trim().toUpperCase();
  if (!trimmed || trimmed === "URP") return { ok: true };
  if (!GSTIN_FORMAT.test(trimmed)) {
    return { ok: false, error: "Enter a valid 15-character GSTIN, or URP if unregistered." };
  }
  const expected = gstinCheckDigit(trimmed.slice(0, 14));
  if (trimmed[14] !== expected) {
    return { ok: false, error: "GSTIN checksum is invalid." };
  }
  return { ok: true };
}
