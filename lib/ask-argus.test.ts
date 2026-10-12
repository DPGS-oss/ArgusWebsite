import { describe, expect, it } from "vitest";
import { answerFromBooks, type AskArgusSummary } from "./ask-argus";

const summary: AskArgusSummary = {
  period: { from: "2026-04-01", to: "2026-10-12" }, invoice_count: 42, sales_total: 125000, sales_tax: 19067.8,
  purchases_total: 80000, purchase_tax: 12203.39, expenses_total: 9000, outstanding: 4200, party_count: 9,
  inventory_skus: 30, low_stock_items: 3, gstr3b_tax_due_estimate: 6864.41, profit: 29069.12,
};

describe("Ask Argus answers money questions from the books, exactly", () => {
  it.each([
    ["How much GST do I have to pay?", "₹6,864.41"],
    ["kitna gst dena hai", "₹6,864.41"],
    ["What is my profit this year?", "₹29,069.12"],
    ["munafa kitna hua", "₹29,069.12"],
    ["Who owes me money?", "₹4,200.00"],
    ["udhaar kitna baaki hai", "₹4,200.00"],
    ["total sales?", "₹1,25,000.00"],
    ["kharcha kitna hua", "₹9,000.00"],
  ])("%s", (q, figure) => {
    expect(answerFromBooks(q, summary)).toContain(figure);
  });

  it("leaves open questions to the AI", () => {
    expect(answerFromBooks("How can I grow my shop before Diwali?", summary)).toBeNull();
    expect(answerFromBooks("I follow up every week", summary)).toBeNull();
  });
});
