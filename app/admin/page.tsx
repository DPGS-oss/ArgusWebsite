"use client";

import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";
import {
  Shield,
  Users,
  RefreshCw,
  Search,
  BarChart3,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth-provider";
import { AuthModal } from "@/components/AuthModal";
import {
  clearAdminKey,
  extendAdminSubscription,
  fetchAdminOverview,
  fetchAdminReports,
  fetchAdminUserUsage,
  fetchAdminUsers,
  grantAdminSubscription,
  loadAdminKey,
  revokeAdminSubscription,
  saveAdminKey,
  verifyAdminSession,
  type AdminGrantPlan,
  type AdminReports,
  type AdminSummary,
  type AdminUserRow,
} from "@/lib/admin-api";

type Tab = "dashboard" | "users" | "reports";

export default function AdminPage() {
  const { user, token, authReady, setShowAuthModal, logout } = useAuth();
  const [adminKey, setAdminKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [sessionOk, setSessionOk] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [reports, setReports] = useState<AdminReports | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [keyExpires, setKeyExpires] = useState<string | null>(null);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [usageDetail, setUsageDetail] = useState<
    Record<string, Awaited<ReturnType<typeof fetchAdminUserUsage>>>
  >({});

  useEffect(() => {
    setAdminKey(loadAdminKey());
  }, []);

  const refresh = useCallback(async () => {
    if (!token || !adminKey) return;
    setLoading(true);
    setError("");
    try {
      await verifyAdminSession(token, adminKey);
      const [overview, list, reportData] = await Promise.all([
        fetchAdminOverview(token, adminKey),
        fetchAdminUsers(token, adminKey, {
          q: query || undefined,
          status: statusFilter || undefined,
        }),
        fetchAdminReports(token, adminKey),
      ]);
      setSessionOk(true);
      setSummary(overview.summary);
      setReports(reportData.reports);
      setKeyExpires(overview.key_expires_at || reportData.key_expires_at || null);
      setUsers(list.users);
    } catch (e) {
      setSessionOk(false);
      setError(e instanceof Error ? e.message : "Access denied");
    } finally {
      setLoading(false);
    }
  }, [token, adminKey, query, statusFilter]);

  useEffect(() => {
    if (token && adminKey) refresh();
  }, [token, adminKey, refresh]);

  function submitKey(event: FormEvent) {
    event.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    saveAdminKey(trimmed);
    setAdminKey(trimmed);
    setKeyInput("");
  }

  function signOut() {
    clearAdminKey();
    setAdminKey("");
    setSessionOk(false);
    logout();
  }

  async function handleGrant(userId: string, plan: AdminGrantPlan) {
    if (!token || !adminKey) return;
    setBusyUser(userId);
    try {
      await grantAdminSubscription(token, adminKey, userId, plan);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Grant failed");
    } finally {
      setBusyUser(null);
    }
  }

  async function handleExtend(userId: string, months: number) {
    if (!token || !adminKey) return;
    setBusyUser(userId);
    try {
      await extendAdminSubscription(token, adminKey, userId, months);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extend failed");
    } finally {
      setBusyUser(null);
    }
  }

  async function handleRevoke(userId: string) {
    if (!token || !adminKey) return;
    setBusyUser(userId);
    try {
      await revokeAdminSubscription(token, adminKey, userId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setBusyUser(null);
    }
  }

  async function toggleUsage(userId: string) {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    if (!token || !adminKey || usageDetail[userId]) return;
    try {
      const detail = await fetchAdminUserUsage(token, adminKey, userId);
      setUsageDetail((prev) => ({ ...prev, [userId]: detail }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load usage");
    }
  }

  if (!authReady) {
    return <div className="flex min-h-screen items-center justify-center text-slate">Loading…</div>;
  }

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-mist px-4">
        <Shield className="mb-4 h-10 w-10 text-brand-violet" />
        <h1 className="mb-2 text-xl font-bold text-ink">Operations console</h1>
        <p className="mb-6 max-w-md text-center text-sm text-slate">
          Sign in with your authorised Firebase account, then enter the admin key from email. The same key can be reused until it expires.
        </p>
        <button className="btn-primary" onClick={() => setShowAuthModal(true)}>
          Sign in
        </button>
        <AuthModal />
      </main>
    );
  }

  if (!adminKey || !sessionOk) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-mist px-4">
        <Shield className="mb-4 h-10 w-10 text-brand-violet" />
        <h1 className="mb-2 text-xl font-bold text-ink">Admin access key</h1>
        <p className="mb-4 max-w-md text-center text-sm text-slate">
          Signed in as {user.email}. Enter the admin key emailed to the configured admin address.
          Kept for this browser tab only (cleared when you close the tab).
        </p>
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        <form onSubmit={submitKey} className="w-full max-w-md space-y-3">
          <input
            type="password"
            autoComplete="off"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="ARGUS-ADMIN-…"
            className="w-full rounded-card border border-bone bg-white px-4 py-3 text-sm"
          />
          <button type="submit" className="btn-primary w-full" disabled={!keyInput.trim()}>
            Unlock console
          </button>
        </form>
        <button type="button" className="mt-4 text-sm text-slate underline" onClick={signOut}>
          Sign out
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-bone bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate">Hidden console</p>
            <h1 className="text-xl font-bold text-ink">User, usage &amp; subscription admin</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate">
            {keyExpires ? <span>Key expires {new Date(keyExpires).toLocaleString()}</span> : null}
            <button type="button" className="btn-outline px-4 py-2" onClick={refresh} disabled={loading}>
              <RefreshCw className={`mr-2 inline h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button type="button" className="text-slate underline" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
        <div className="mx-auto mt-4 flex max-w-6xl gap-2">
          {(
            [
              ["dashboard", "Dashboard", BarChart3],
              ["users", "Users", Users],
              ["reports", "Reports", Activity],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                tab === id ? "bg-brand-violet text-white" : "bg-plaster text-slate"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {tab === "dashboard" && summary ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total users" value={String(summary.total_users)} />
              <StatCard label="Active subscribers" value={String(summary.subscribed_active)} accent />
              <StatCard label="Expired subs" value={String(summary.subscribed_expired)} />
              <StatCard label="Free / inactive" value={String(summary.free_users)} />
              <StatCard label="Accountants (CA)" value={String(summary.accountants)} />
              <StatCard label="CA links active" value={String(summary.active_ca_links)} />
              <StatCard label="Signups (7d)" value={String(summary.recent_signups_7d)} />
              <StatCard label="Signups (30d)" value={String(summary.recent_signups_30d)} />
            </section>

            {summary.usage ? (
              <section className="rounded-card border border-bone bg-white p-4">
                <h2 className="mb-3 text-lg font-semibold text-ink">Platform usage</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Users with cloud data" value={String(summary.usage.users_with_cloud_data)} />
                  <StatCard label="Total invoices synced" value={String(summary.usage.total_invoices)} />
                  <StatCard label="Total parties" value={String(summary.usage.total_parties)} />
                  <StatCard label="Active sync (7d)" value={String(summary.usage.active_sync_7d)} accent />
                  <StatCard label="Active sync (30d)" value={String(summary.usage.active_sync_30d)} />
                  <StatCard label="Purchases synced" value={String(summary.usage.total_purchases)} />
                  <StatCard label="Expenses synced" value={String(summary.usage.total_expenses)} />
                  <StatCard label="Stock items synced" value={String(summary.usage.total_stock_items)} />
                </div>
              </section>
            ) : null}

            {summary.payments ? (
              <section className="rounded-card border border-bone bg-white p-4">
                <h2 className="mb-3 text-lg font-semibold text-ink">Payments (recent)</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Verified payments" value={String(summary.payments.verified_payments)} />
                  <StatCard
                    label="Revenue (verified)"
                    value={`₹${Math.round(summary.payments.total_amount_paise / 100).toLocaleString("en-IN")}`}
                    accent
                  />
                  <StatCard label="Renewals" value={String(summary.payments.renewed_payments)} />
                  <StatCard label="Payments (30d)" value={String(summary.payments.recent_30d)} />
                </div>
              </section>
            ) : null}

            {summary.by_plan ? (
              <section className="rounded-card border border-bone bg-white p-4">
                <h2 className="mb-3 text-lg font-semibold text-ink">Plan breakdown</h2>
                <BreakdownList items={summary.by_plan} />
              </section>
            ) : null}
          </>
        ) : null}

        {tab === "users" ? (
          <section className="rounded-card border border-bone bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Users className="h-5 w-5 text-brand-violet" />
              <h2 className="text-lg font-semibold text-ink">All users</h2>
              <div className="ml-auto flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search email, GSTIN…"
                    className="rounded-full border border-bone py-2 pl-9 pr-3 text-sm"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-full border border-bone px-3 py-2 text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="free">Free</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-bone text-xs uppercase text-slate">
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Business</th>
                    <th className="py-2 pr-3">Plan</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Usage</th>
                    <th className="py-2 pr-3">Expiry</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => (
                    <Fragment key={row.id}>
                      <tr className="border-b border-bone">
                        <td className="py-3 pr-3">
                          <p className="font-medium text-ink">{row.name || "—"}</p>
                          <p className="text-xs text-slate">{row.email}</p>
                        </td>
                        <td className="py-3 pr-3 text-slate">
                          <p>{row.business_name || "—"}</p>
                          <p className="text-xs">{row.gstin || ""}</p>
                        </td>
                        <td className="py-3 pr-3 text-slate">
                          {row.subscription?.plan_key || row.subscription?.plan || "free"}
                          {row.subscription?.source ? (
                            <p className="text-xs text-ash">{row.subscription.source}</p>
                          ) : null}
                        </td>
                        <td className="py-3 pr-3">
                          <StatusBadge status={row.subscription_status} />
                        </td>
                        <td className="py-3 pr-3 text-slate">
                          {row.usage?.has_cloud_data ? (
                            <>
                              <p>{row.usage.invoices} invoices</p>
                              <p className="text-xs">
                                {row.usage.parties} parties · sync{" "}
                                {row.usage.last_sync_at
                                  ? new Date(row.usage.last_sync_at).toLocaleDateString()
                                  : "—"}
                              </p>
                            </>
                          ) : (
                            <span className="text-xs">No cloud sync</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-slate">
                          {row.subscription?.expiry_date
                            ? new Date(row.subscription.expiry_date).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex min-w-[220px] flex-wrap gap-1">
                            <GrantButton
                              label="Monthly"
                              disabled={busyUser === row.id}
                              onClick={() => handleGrant(row.id, "business_monthly")}
                            />
                            <GrantButton
                              label="Yearly"
                              disabled={busyUser === row.id}
                              onClick={() => handleGrant(row.id, "business_yearly")}
                            />
                            <GrantButton
                              label="Lifetime"
                              disabled={busyUser === row.id}
                              onClick={() => handleGrant(row.id, "business_lifetime")}
                            />
                            <button
                              type="button"
                              className="rounded-full border border-bone px-2 py-1 text-xs disabled:opacity-50"
                              disabled={busyUser === row.id}
                              onClick={() => handleExtend(row.id, 1)}
                            >
                              +1 mo
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-bone px-2 py-1 text-xs disabled:opacity-50"
                              disabled={busyUser === row.id}
                              onClick={() => handleRevoke(row.id)}
                            >
                              Revoke
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-bone px-2 py-1 text-xs"
                              onClick={() => toggleUsage(row.id)}
                            >
                              {expandedUser === row.id ? (
                                <ChevronUp className="inline h-3 w-3" />
                              ) : (
                                <ChevronDown className="inline h-3 w-3" />
                              )}{" "}
                              Usage
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedUser === row.id ? (
                        <tr className="border-b border-bone bg-mist/40">
                          <td colSpan={7} className="px-3 py-4">
                            <UsagePanel detail={usageDetail[row.id]} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {!users.length ? <p className="py-6 text-center text-slate">No users match this filter.</p> : null}
            </div>
          </section>
        ) : null}

        {tab === "reports" && reports ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Auto-renew active"
                value={String(reports.subscription.auto_renew_active)}
                accent
              />
              <StatCard label="Cloud sync users" value={String(reports.usage.users_with_cloud_data)} />
              <StatCard
                label="Total revenue tracked"
                value={`₹${Math.round(reports.payments.total_amount_paise / 100).toLocaleString("en-IN")}`}
              />
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-card border border-bone bg-white p-4">
                <h2 className="mb-3 text-lg font-semibold text-ink">Subscription status</h2>
                <BreakdownList items={reports.subscription.by_status} />
              </section>
              <section className="rounded-card border border-bone bg-white p-4">
                <h2 className="mb-3 text-lg font-semibold text-ink">Subscription source</h2>
                <BreakdownList items={reports.subscription.by_source} />
              </section>
              <section className="rounded-card border border-bone bg-white p-4">
                <h2 className="mb-3 text-lg font-semibold text-ink">Payment source</h2>
                <BreakdownList items={reports.payments.by_source} />
              </section>
              <section className="rounded-card border border-bone bg-white p-4">
                <h2 className="mb-3 text-lg font-semibold text-ink">Signups by month</h2>
                <BreakdownList items={reports.subscription.signups_by_month} sortDesc />
              </section>
            </div>

            <section className="rounded-card border border-bone bg-white p-4">
              <h2 className="mb-3 text-lg font-semibold text-ink">Top users by invoices</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-bone text-xs uppercase text-slate">
                      <th className="py-2 pr-3">User</th>
                      <th className="py-2 pr-3">Business</th>
                      <th className="py-2 pr-3">Invoices</th>
                      <th className="py-2 pr-3">Parties</th>
                      <th className="py-2 pr-3">Last sync</th>
                      <th className="py-2 pr-3">Sub status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.top_users_by_invoices.map((row) => (
                      <tr key={row.user_id} className="border-b border-bone">
                        <td className="py-2 pr-3">
                          <p className="font-medium text-ink">{row.name || row.email}</p>
                          <p className="text-xs text-slate">{row.email}</p>
                        </td>
                        <td className="py-2 pr-3 text-slate">{row.business_name || "—"}</td>
                        <td className="py-2 pr-3">{row.invoices}</td>
                        <td className="py-2 pr-3">{row.parties}</td>
                        <td className="py-2 pr-3 text-slate">
                          {row.last_sync_at
                            ? new Date(row.last_sync_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-2 pr-3">
                          <StatusBadge status={row.subscription_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-card border border-bone bg-white p-4 ${accent ? "ring-1 ring-brand-violet/30" : ""}`}>
      <p className="text-xs text-slate">{label}</p>
      <p className="text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function BreakdownList({
  items,
  sortDesc,
}: {
  items: Record<string, number>;
  sortDesc?: boolean;
}) {
  const entries = Object.entries(items).sort((a, b) =>
    sortDesc ? b[0].localeCompare(a[0]) : b[1] - a[1],
  );
  if (!entries.length) return <p className="text-sm text-slate">No data yet.</p>;
  return (
    <ul className="space-y-2">
      {entries.map(([key, count]) => (
        <li key={key} className="flex items-center justify-between rounded-card border border-bone bg-mist px-3 py-2 text-sm">
          <span className="font-medium text-ink">{key}</span>
          <span className="text-slate">{count}</span>
        </li>
      ))}
    </ul>
  );
}

function GrantButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="rounded-full bg-brand-violet px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800",
    expired: "bg-amber-100 text-amber-800",
    free: "bg-plaster text-slate",
    inactive: "bg-red-100 text-red-800",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${styles[status] || styles.free}`}>
      {status}
    </span>
  );
}

function UsagePanel({
  detail,
}: {
  detail?: Awaited<ReturnType<typeof fetchAdminUserUsage>>;
}) {
  if (!detail) return <p className="text-sm text-slate">Loading usage…</p>;

  const { usage, payments } = detail;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <h3 className="mb-2 font-semibold text-ink">Cloud data usage</h3>
        <ul className="grid grid-cols-2 gap-2 text-sm text-slate">
          <li>Invoices: {usage.invoices}</li>
          <li>Parties: {usage.parties}</li>
          <li>Purchases: {usage.purchases}</li>
          <li>Expenses: {usage.expenses}</li>
          <li>Stock items: {usage.stock_items}</li>
          <li>Quotes: {usage.quotes}</li>
          <li>Credit notes: {usage.credit_notes}</li>
          <li>Khata entries: {usage.khata_entries}</li>
          <li>Businesses: {usage.businesses}</li>
          <li>Device: {usage.device || "—"}</li>
        </ul>
        <p className="mt-2 text-xs text-slate">
          Last sync: {usage.last_sync_at ? new Date(usage.last_sync_at).toLocaleString() : "Never"}
        </p>
      </div>
      <div>
        <h3 className="mb-2 font-semibold text-ink">Recent payments</h3>
        {payments.length ? (
          <ul className="space-y-1 text-sm text-slate">
            {payments.map((pay) => (
              <li key={pay.id} className="rounded-card border border-bone bg-white px-3 py-2">
                <span className="font-medium text-ink">{pay.plan || "payment"}</span>
                {" · "}
                {pay.amount_paise ? `₹${Math.round(pay.amount_paise / 100)}` : "—"}
                {" · "}
                {pay.status}
                {pay.created_at ? (
                  <span className="text-xs"> · {new Date(pay.created_at).toLocaleDateString()}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate">No payments recorded.</p>
        )}
      </div>
    </div>
  );
}
