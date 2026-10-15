/**
 * Edit log (audit trail): every change to bills, notes, payments, purchases,
 * expenses, stock, customers and business details, with who, when, from which
 * device and what changed. It only ever grows: there is no way to edit or
 * clear it (CGST Rule 56(8); Companies Act audit-trail rule). The same log is
 * kept by the Android app and merged through sync.
 */
import type { AppData } from "./types";

export type AuditEntity =
  | "bill" | "credit_note" | "debit_note" | "payment" | "purchase" | "expense"
  | "stock" | "customer" | "business" | "settings" | "user";
export type AuditAction = "created" | "edited" | "cancelled" | "deleted" | "recorded";

export interface AuditEntry {
  id: string;
  at: string;
  byUid: string;
  byName: string;
  device: "web" | "android";
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  /** Bill number, customer name and so on — what the owner recognises. */
  ref: string;
  detail: string;
  /** Set by the server when the entry first reaches the cloud. */
  syncedAt?: string;
}

let actor = { uid: "", name: "" };

/** Who is making changes in this browser (set from the signed-in user). */
export function setAuditActor(next: { uid: string; name: string } | null) {
  actor = next ? { uid: next.uid, name: next.name } : { uid: "", name: "" };
}

function newId() {
  return `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function auditEntry(e: Pick<AuditEntry, "action" | "entity" | "entityId" | "ref" | "detail">): AuditEntry {
  return { id: newId(), at: new Date().toISOString(), byUid: actor.uid, byName: actor.name || "Owner", device: "web", ...e };
}

/** Adds entries to the log (in place on `data`, which the caller then saves). */
export function appendAudit(data: AppData, ...entries: AuditEntry[]): AppData {
  data.auditLog = [...(data.auditLog || []), ...entries];
  return data;
}

const show = (v: unknown) => {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
};

/** "Name: A → B; Phone: — → 98…" for the fields that changed. */
export function describeFields<T extends object>(before: T | undefined, after: T, labels: Partial<Record<keyof T, string>>): string {
  if (!before) return "";
  const parts: string[] = [];
  for (const [key, label] of Object.entries(labels) as [keyof T, string][]) {
    const a = (before as Record<keyof T, unknown>)[key];
    const b = (after as Record<keyof T, unknown>)[key];
    if (show(a) !== show(b)) parts.push(`${label}: ${show(a)} → ${show(b)}`);
  }
  return parts.join("; ");
}
