"use client";

import { useCallback, useEffect, useState } from "react";
import Script from "next/script";
import { useAuth } from "@/lib/auth-provider";

type Member = { email: string; name: string; access: "billing" | "full"; status: "invited" | "active"; series: string; hasAccess: boolean };
type TeamInfo = { included: number; allowed: number; extraSeats: number; seatsPaidUntil: string | null; seatPricePaise: number; members: Member[] };
type Me = {
  role: "owner" | "member";
  access: "billing" | "full";
  series: string;
  ownerName?: string;
  lapsed?: boolean;
  team?: TeamInfo;
  invite?: { ownerName: string; access: "billing" | "full" };
};

const ACCESS_LABEL = { billing: "Billing only", full: "Full access" };
const ACCESS_HELP = {
  billing: "Bills, customers, stock and payments. No purchases, expenses, payroll, GST returns, profit or settings.",
  full: "Everything you can do, except managing users.",
};

function day(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" });
}

type RazorpayCtor = new (o: Record<string, unknown>) => { open: () => void };

/** People who use these books: invite, choose access, remove; add users beyond two. */
export function Team() {
  const { token, refreshProfile, user } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<"billing" | "full">("billing");
  const [addSeats, setAddSeats] = useState(1);

  const call = useCallback(
    async (path: string, body?: unknown) => {
      const res = await fetch(`/api/team${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      return json;
    },
    [token],
  );

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setMe(await call(""));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(path: string, body: unknown, after?: () => Promise<void> | void) {
    setBusy(true);
    setError("");
    try {
      const out = await call(path, body);
      if (out.team && me) setMe({ ...me, team: out.team });
      else await load();
      if (after) await after();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Joining or leaving changes whose books this browser opens: reload from scratch.
  const switchBooks = async () => {
    await refreshProfile();
    window.location.reload();
  };

  async function buySeats() {
    setBusy(true);
    setError("");
    try {
      const order = await call("/seats/order", { add: addSeats });
      const Razorpay = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
      if (!Razorpay) throw new Error("Payment window did not load. Refresh and try again.");
      new Razorpay({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount,
        currency: "INR",
        name: "Argus - GST Billing",
        description: `${addSeats} more user${addSeats === 1 ? "" : "s"} until ${day(order.until)}`,
        prefill: { email: user?.email || "", name: user?.name || "" },
        theme: { color: "#5266eb" },
        handler: (r: Record<string, string>) => void act("/seats/verify", r),
      }).open();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!me) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold text-ink">Users</h1>
        <p className="text-sm text-slate">{error || "Loading…"}</p>
      </div>
    );
  }

  if (me.role === "member") {
    return (
      <div className="max-w-xl">
        <h1 className="mb-2 text-2xl font-bold text-ink">Users</h1>
        <div className="rounded-card border border-bone bg-white p-4 text-sm text-slate">
          <p>
            You are using the books of <b className="text-ink">{me.ownerName || "the owner"}</b> with{" "}
            <b className="text-ink">{ACCESS_LABEL[me.access]}</b>. {ACCESS_HELP[me.access]}
          </p>
          <p className="mt-2">Your bills are numbered in your own series (…/W{me.series}0001 here, …/{me.series}0001 in the app).</p>
          <button className="btn-outline mt-4 px-4 py-2 text-sm" disabled={busy} onClick={() => confirm("Stop using these books?") && act("/leave", {}, switchBooks)}>
            Leave these books
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  const t = me.team;
  const used = 1 + (t?.members.length || 0);
  const full = t ? used >= t.allowed : false;
  return (
    <div className="max-w-2xl">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <h1 className="mb-2 text-2xl font-bold text-ink">Users</h1>
      <p className="mb-4 text-sm text-slate">
        Let someone else make bills in your books, on the website or the app. Your plan includes 2 users (you and one more). More users are ₹50 a month each.
      </p>

      {me.invite ? (
        <div className="mb-4 rounded-card border border-brand-violet bg-white p-4 text-sm text-slate">
          <p>
            <b className="text-ink">{me.invite.ownerName || "A business"}</b> invited you to their books ({ACCESS_LABEL[me.invite.access]}).
            You will see their bills instead of yours while you are a member.
          </p>
          <button className="btn-primary mt-3 px-4 py-2 text-sm" disabled={busy} onClick={() => act("/accept", {}, switchBooks)}>
            Join their books
          </button>
        </div>
      ) : null}
      {me.lapsed ? (
        <p className="mb-4 rounded-card border border-bone bg-white p-4 text-sm text-slate">
          The owner&apos;s extra users have run out, so you are back in your own books until they add more.
        </p>
      ) : null}

      <ul className="mb-4 divide-y divide-bone rounded-card border border-bone bg-white">
        <li className="p-3 text-sm">
          <b className="text-ink">{user?.name || "You"}</b> <span className="text-slate">(owner, bills …/W0001)</span>
        </li>
        {(t?.members || []).map((m) => (
          <li key={m.email} className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <b className="text-ink">{m.name || m.email}</b>
              <div className="text-xs text-slate">
                {m.email} · {m.status === "invited" ? "invited, not joined yet" : "joined"} · bills …/W{m.series}0001
                {!m.hasAccess ? " · no access until you add a user" : ""}
              </div>
            </div>
            <select className="input-field !w-auto" value={m.access} disabled={busy}
              onChange={(e) => act("/access", { email: m.email, access: e.target.value })}>
              <option value="billing">{ACCESS_LABEL.billing}</option>
              <option value="full">{ACCESS_LABEL.full}</option>
            </select>
            <button className="btn-outline px-3 py-1.5 text-xs" disabled={busy}
              onClick={() => confirm(`Remove ${m.email}? Bills they made stay in your books.`) && act("/remove", { email: m.email })}>
              Remove
            </button>
          </li>
        ))}
      </ul>

      {!full ? (
        <div className="mb-4 rounded-card border border-bone bg-white p-4">
          <h2 className="mb-2 font-semibold text-ink">Invite someone</h2>
          <div className="flex flex-wrap gap-2">
            <input className="input-field flex-1" type="email" placeholder="Their email (they sign in with it)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select className="input-field !w-auto" value={access} onChange={(e) => setAccess(e.target.value as "billing" | "full")}>
              <option value="billing">{ACCESS_LABEL.billing}</option>
              <option value="full">{ACCESS_LABEL.full}</option>
            </select>
            <button className="btn-primary px-4 py-2 text-sm" disabled={busy || !email.trim()} onClick={() => act("/invite", { email, access }, () => setEmail(""))}>
              Invite
            </button>
          </div>
          <p className="mt-2 text-xs text-slate">{ACCESS_HELP[access]} They sign in to Argus with this email and tap “Join their books” under Users.</p>
        </div>
      ) : null}

      <div className="rounded-card border border-bone bg-white p-4 text-sm text-slate">
        <p>
          {used} of {t?.allowed ?? 2} users.
          {t && t.extraSeats ? ` ${t.extraSeats} extra paid until ${day(t.seatsPaidUntil)}.` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select className="input-field !w-auto" value={addSeats} onChange={(e) => setAddSeats(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} more user{n === 1 ? "" : "s"}</option>)}
          </select>
          <button className="btn-outline px-4 py-2 text-sm" disabled={busy} onClick={buySeats}>
            Add for ₹{50 * addSeats} a month
          </button>
        </div>
        <p className="mt-2 text-xs">Paid to the end of your current plan period, in one payment.</p>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
