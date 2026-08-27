import { describe, expect, it } from "vitest";
import { gstinCheckDigit, isValidGstin, normalizeGstin, validateGstin } from "./gstin";

describe("GSTIN checksum", () => {
  it("accepts URP for unregistered persons (any case)", () => {
    expect(isValidGstin("URP")).toBe(true);
    expect(isValidGstin("urp")).toBe(true);
    expect(validateGstin("URP").ok).toBe(true);
  });

  it("treats blank GSTIN as unregistered and normalizes to URP", () => {
    expect(validateGstin("").ok).toBe(true);
    expect(validateGstin("   ").ok).toBe(true);
    expect(normalizeGstin("")).toBe("URP");
    expect(normalizeGstin("  urp ")).toBe("URP");
  });

  it("rejects a GSTIN with a bad checksum", () => {
    // Same body as a known-valid GSTIN, last character flipped.
    expect(isValidGstin("27AAPFU0939F1Z0")).toBe(false);
    expect(validateGstin("27AAPFU0939F1Z0").ok).toBe(false);
  });

  it("rejects malformed GSTINs", () => {
    expect(isValidGstin("ABC")).toBe(false);
    expect(isValidGstin("27AAPFU0939F1Z")).toBe(false);
    expect(isValidGstin("271234567890123")).toBe(false);
    expect(validateGstin("not-a-gstin").ok).toBe(false);
  });

  it("accepts a GSTIN with a valid checksum", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
    const body = "07AABCU9603R1Z";
    const generated = body + gstinCheckDigit(body);
    expect(generated).toHaveLength(15);
    expect(isValidGstin(generated)).toBe(true);
    expect(validateGstin("27aapfu0939f1zv").ok).toBe(true);
  });
});
