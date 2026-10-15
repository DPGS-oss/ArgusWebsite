/** Whose books this person opens (their own, or the owner's when on a team). */
export type TeamBooks = {
  booksUid: string;
  role: "owner" | "member";
  access: "full" | "billing";
  series: string;
  ownerName?: string;
};

/** Screens a billing-only user does not get. */
export const OWNER_ONLY_VIEWS = ["purchases", "expenses", "payroll", "gst-returns", "reports", "books", "business", "settings", "compliance"];

export function canOpenView(view: string, user: { books?: TeamBooks } | null): boolean {
  return user?.books?.access !== "billing" || !OWNER_ONLY_VIEWS.includes(view);
}
