import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  PLANS,
  getPlan,
  getAllPlans,
  getEntitlements,
} = require("../functions/_shared/plans.js");

describe("Business / Lifetime prices (Play + website)", () => {
  it("keeps Business monthly ₹500, yearly ₹5,000, Lifetime ₹18,000 and has no ₹299 SKU", () => {
    expect(PLANS.business.price).toBe(500);
    expect(PLANS.business_monthly.price).toBe(500);
    expect(PLANS.business_yearly.price).toBe(5000);
    expect(PLANS.business_lifetime.price).toBe(18000);
    expect(getPlan("business")?.price).toBe(500);
    expect(getPlan("business_yearly")?.price).toBe(5000);
    expect(getPlan("business_lifetime")?.price).toBe(18000);

    const listed = getAllPlans();
    expect(listed.business.price).toBe(500);
    expect(listed.business_yearly.price).toBe(5000);
    expect(listed.business_lifetime.price).toBe(18000);

    for (const [id, plan] of Object.entries(PLANS)) {
      expect(plan.price, id).not.toBe(299);
      expect(String(id)).not.toMatch(/299/);
    }
    expect(getPlan("starter")).toBeNull();
    expect(getPlan("business_299")).toBeNull();
  });
});

describe("Free vs Business entitlements (Vyapar model)", () => {
  it("lets Free do unlimited Android-class billing and still gates web, CA JSON, and Tally XML", () => {
    for (const planId of [undefined, null, "", "free", "Free"]) {
      const e = getEntitlements(planId);
      expect(e.android_billing, String(planId)).toBe(true);
      expect(e.android_invoice_limit, String(planId)).toBeNull();
      expect(e.web_invoicing, String(planId)).toBe(false);
      expect(e.web_books, String(planId)).toBe(false);
      expect(e.ca_portal, String(planId)).toBe(false);
      expect(e.gstr_json, String(planId)).toBe(false);
      expect(e.tally_xml, String(planId)).toBe(false);
    }
  });

  it("unlocks web books, GSTR JSON, CA portal, and Tally XML on Business and Lifetime", () => {
    for (const planId of ["business", "business_monthly", "business_yearly", "business_lifetime"]) {
      const e = getEntitlements(planId);
      expect(e.android_billing, planId).toBe(true);
      expect(e.android_invoice_limit, planId).toBeNull();
      expect(e.web_invoicing, planId).toBe(true);
      expect(e.web_books, planId).toBe(true);
      expect(e.ca_portal, planId).toBe(true);
      expect(e.gstr_json, planId).toBe(true);
      expect(e.tally_xml, planId).toBe(true);
    }
  });
});

describe("Firebase Hosting www → apex", () => {
  it("declares www.argusinvoicing.com as a redirect site to the apex, not a content host", () => {
    const cfg = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));
    const hosting = Array.isArray(cfg.hosting) ? cfg.hosting : [cfg.hosting];
    const www = hosting.find(
      (h) =>
        h.site === "argusinvoicing-www" ||
        h.target === "www" ||
        (Array.isArray(h.redirects) &&
          h.redirects.some((r) => String(r.destination || "").includes("argusinvoicing.com")))
    );
    expect(www).toBeTruthy();
    const destinations = (www.redirects || []).map((r) => r.destination);
    expect(destinations.some((d) => d === "https://argusinvoicing.com" || d?.startsWith("https://argusinvoicing.com/"))).toBe(
      true
    );
    expect(www.rewrites || []).toEqual([]);
  });
});
