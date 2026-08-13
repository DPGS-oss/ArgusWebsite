"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-provider";
import { AuthModal } from "@/components/AuthModal";

function RedeemInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const { user, token: idToken, authReady, setShowAuthModal } = useAuth();
  const [backup, setBackup] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (user) setShowAuthModal(false);
  }, [user, setShowAuthModal]);

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
        body: JSON.stringify({ token, backup_code: backup || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.detail || "Could not redeem invite");
      }
      window.location.href = `/ca/portal/?owner=${encodeURIComponent(data.owner_id)}`;
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
          {token ? (
            <p className="break-all text-xs text-slate">Invite token attached to this link.</p>
          ) : (
            <label className="block text-sm text-slate">
              8-character backup code
              <input
                className="mt-1 w-full rounded-card border border-bone px-3 py-2 text-ink"
                value={backup}
                onChange={(e) => setBackup(e.target.value.toUpperCase())}
                maxLength={8}
                placeholder="A1B2C3D4"
              />
            </label>
          )}
          {!token ? null : (
            <label className="block text-sm text-slate">
              Or backup code
              <input
                className="mt-1 w-full rounded-card border border-bone px-3 py-2 text-ink"
                value={backup}
                onChange={(e) => setBackup(e.target.value.toUpperCase())}
                maxLength={8}
              />
            </label>
          )}
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
