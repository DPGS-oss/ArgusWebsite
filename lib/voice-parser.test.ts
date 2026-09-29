import { describe, expect, it } from "vitest";
import { detectLanguage, normalizeNumberWords, parseVoiceBill } from "./voice-parser";

describe("voice bill parser", () => {
  it("understands the Hinglish order from the homepage demo", () => {
    const bill = parseVoiceBill("Sharma Traders ko do steel almirah, nau hazaar each, aur delivery paanch sau");
    expect(bill.customerName).toBe("Sharma Traders");
    expect(bill.items).toEqual([{ name: "Steel Almirah", quantity: 2, price: 9000, gstRate: 18 }]);
    expect(bill.delivery).toBe(500);
    expect(bill.language).toBe("hi-en");
  });

  it("reads English orders with units, per-unit prices and GST", () => {
    const bill = parseVoiceBill("Bill for Mehta Retail: 5 kg rice at 60 rupees each and 2 packets biscuits 20 rupees each 5 percent gst");
    expect(bill.customerName).toBe("Mehta Retail");
    expect(bill.items[0]).toMatchObject({ name: "Kg Rice", quantity: 5, price: 60 });
    expect(bill.items[1]).toMatchObject({ quantity: 2, price: 20, gstRate: 5 });
  });

  it("splits a total price across quantity", () => {
    const bill = parseVoiceBill("3 bottles oil for 450 rupees");
    expect(bill.items[0]).toMatchObject({ quantity: 3, price: 150 });
  });

  it("handles Devanagari digits and number words", () => {
    expect(normalizeNumberWords("do sau")).toBe("200");
    expect(normalizeNumberWords("paanch hazaar")).toBe("5000");
    expect(parseVoiceBill("चीनी ५० रुपये").items[0]).toMatchObject({ price: 50 });
    expect(detectLanguage("चीनी दो किलो")).toBe("hi");
  });

  it("ignores pieces with no price", () => {
    expect(parseVoiceBill("hello bhaiya").items).toEqual([]);
  });
});
