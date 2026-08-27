"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { AuthModal } from "@/components/AuthModal";
import { BrandLogo } from "@/components/BrandLogo";

function readHashParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function RedeemInner() {
  const { user, token: idToken, authReady, setShowAuthModal } = useAuth();
  const [inviteToken, setInviteToken] = useState("");
  const [backup, setBackup] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (user) setShowAuthModal(false);
  }, [user, setShowAuthModal]);

  useEffect(() => {
    // Prefer fragment (#token=&key=) so secrets never hit query logs / Referer.
    const hash = readHashParams();
    const fromHash = hash.get("token") || "";
    const key = hash.get("key");
    if (key) sessionStorage.setItem("argus_ca_pending_key", key);
    if (fromHash) {
      setInviteToken(fromHash);
      return;
    }
    // Legacy links: ?token= still accepted once, then stripped from the address bar.
    const q = new URLSearchParams(window.location.search).get("token") || "";
    if (q) {
      setInviteToken(q);
      const nextHash = key ? `#token=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}` : `#token=${encodeURIComponent(q)}`;
      window.history.replaceState(null, "", `/ca/redeem/${nextHash}`);
    }
  }, []);

  async function redeem() {
    if (!idToken) {
      setShowAuthModal(true);
      return;
    }
    setWorking(true);
    setStatus("");
    try {
      const res = await fetch("/api/ca/invites/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          token: inviteToken || undefined,
          backup_code: backup || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.detail || "Could not redeem invite");
      }
      const pendingKey =
        readHashParams().get("key") ||
        sessionStorage.getItem("argus_ca_pending_key") ||
        "";
      if (pendingKey && data.owner_id) {
        sessionStorage.setItem(`argus_ca_share_key:${data.owner_id}`, pendingKey);
        sessionStorage.removeItem("argus_ca_pending_key");
      }
      const hash = pendingKey ? `#key=${encodeURIComponent(pendingKey)}` : "";
      window.location.href = `/ca/portal/?owner=${encodeURIComponent(data.owner_id)}${hash}`;
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Redeem failed");
    } finally {
      setWorking(false);
    }
  }

  if (!authReady) {
    return <div className="p-10 text-center text-slate">Loading…</div>;
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <div className="mb-6">
        <BrandLogo size={32} />
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Join as CA</h1>
      <p className="mb-8 text-slate">
        Sign in with Google or email, then redeem the owner&apos;s invite. This dashboard is free and
        read-only — you do not pay.
      </p>
      {!user ? (
        <button className="btn-primary" onClick={() => setShowAuthModal(true)}>
          Sign in to continue
        </button>
      ) : (
        <div className="space-y-4 rounded-card border border-bone bg-white p-6">
          <p className="text-sm text-slate">Signed in as {user.email}</p>
          {inviteToken ? (
            <p className="text-xs text-slate">Invite token loaded from this link (not stored on the server).</p>
          ) : (
            <label className="block text-sm text-slate">
              Backup code from the owner
              <input
                className="mt-1 w-full rounded-card border border-bone px-3 py-2 text-ink"
                value={backup}
                onChange={(e) => setBackup(e.target.value.toUpperCase())}
                maxLength={16}
                placeholder="Backup code"
              />
            </label>
          )}
          {inviteToken ? (
            <label className="block text-sm text-slate">
              Or backup code
              <input
                className="mt-1 w-full rounded-card border border-bone px-3 py-2 text-ink"
                value={backup}
                onChange={(e) => setBackup(e.target.value.toUpperCase())}
                maxLength={16}
              />
            </label>
          ) : null}
          <button className="btn-primary w-full" disabled={working} onClick={redeem}>
            {working ? "Linking…" : "Redeem and open CA portal"}
          </button>
          {status ? <p className="text-sm text-red-600">{status}</p> : null}
        </div>
      )}
      <AuthModal />
    </main>
  );
}

export default function CaRedeemPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate">Loading…</div>}>
      <RedeemInner />
    </Suspense>
  );
}
