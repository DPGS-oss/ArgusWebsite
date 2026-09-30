"use client";

import { useCallback, useEffect, useState } from "react";

type Accountant = { accountant_id: string; name: string; email: string; since: string | null };

/** Owner view of which CAs can read the books, with a way to stop sharing. */
export function CaAccessList({ token }: { token: string | null }) {
  const [rows, setRows] = useState<Accountant[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/ca/accountants", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load");
      setRows(data.accountants || []);
      setError("");
    } catch {
      setError("Could not load who has access. Check your internet and try again.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function stop(a: Accountant) {
    const who = a.name || a.email || "This CA";
    if (!confirm(`${who} will no longer see your bills or reports. Stop sharing?`)) return;
    const res = await fetch(`/api/ca/invites?accountant_id=${encodeURIComponent(a.accountant_id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert("Could not stop sharing. Please try again.");
      return;
    }
    await load();
  }

  if (!token) return null;
  return (
    <div className="mt-6 border-t border-bone pt-4">
      <h3 className="text-sm font-semibold text-ink">Who can see your books</h3>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {rows === null && !error ? <p className="mt-2 text-sm text-slate">Loading…</p> : null}
      {rows && rows.length === 0 ? <p className="mt-2 text-sm text-slate">Nobody yet.</p> : null}
      {rows && rows.length > 0 ? (
        <ul className="mt-2 divide-y divide-bone">
          {rows.map((a) => (
            <li key={a.accountant_id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate text-ink">
                {a.name || a.email || "Your CA"}
                {a.name && a.email ? <span className="ml-2 text-slate">{a.email}</span> : null}
              </span>
              <button className="btn-outline !py-1.5 text-xs" onClick={() => stop(a)}>
                Stop sharing
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
