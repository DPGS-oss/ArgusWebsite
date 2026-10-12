/**
 * Calendar dates for bills, always in Indian time. `toISOString()` is UTC, so
 * between midnight and 5:30 am IST it gives yesterday's date — a bill made at
 * 12:30 am on 1 April would land in the previous financial year. Dates here
 * are plain "YYYY-MM-DD" strings and the arithmetic never touches time zones.
 */

const IST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });

/** "YYYY-MM-DD" for an instant, in Indian time. */
export function istDate(at: Date = new Date()): string {
  return IST.format(at);
}

export function todayIST(): string {
  return istDate();
}

function parts(iso: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) {
    const t = todayIST();
    return [Number(t.slice(0, 4)), Number(t.slice(5, 7)), Number(t.slice(8, 10))];
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function fmt(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Adds months, keeping the day but never spilling into the next month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = parts(iso);
  const index = y * 12 + (m - 1) + months;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  return fmt(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export function addPeriod(iso: string, frequency: string, interval = 1): string {
  const n = Math.max(1, interval);
  switch (frequency) {
    case "weekly":
      return addDays(iso, 7 * n);
    case "quarterly":
      return addMonths(iso, 3 * n);
    case "yearly":
      return addMonths(iso, 12 * n);
    default:
      return addMonths(iso, n);
  }
}

/** First and last day of a "YYYY-MM" month. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  return { from: fmt(y, m, 1), to: fmt(y, m, daysInMonth(y, m)) };
}

/** Financial year (April–March) of a date, e.g. "26-27". */
export function financialYear(iso: string): string {
  const [y, m] = parts(iso);
  const start = m >= 4 ? y : y - 1;
  const yy = (n: number) => String(n % 100).padStart(2, "0");
  return `${yy(start)}-${yy(start + 1)}`;
}
