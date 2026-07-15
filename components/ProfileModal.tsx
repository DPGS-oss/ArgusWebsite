"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { getInitials, useAuth } from "@/lib/auth-provider";

export function ProfileModal() {
  const {
    user,
    token,
    showProfileModal,
    setShowProfileModal,
    logout,
    updateLocalUser,
  } = useAuth();

  const [businessName, setBusinessName] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setBusinessName(user.business_name || "");
    setGstin(user.gstin || "");
    setPhone(user.phone || "");
  }, [user]);

  if (!showProfileModal || !user) return null;

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          business_name: businessName,
          gstin,
          phone,
        }),
      });
      if (response.ok) {
        updateLocalUser({ business_name: businessName, gstin, phone });
        alert("Settings saved successfully");
      } else {
        alert("Failed to save settings");
      }
    } catch {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => setShowProfileModal(false)}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card border border-bone bg-white p-6 shadow-subtle"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-violet text-lg font-bold text-white">
            {getInitials(user.name)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">{user.name}</h2>
            <p className="text-sm text-slate">{user.email}</p>
          </div>
        </div>

        <div className="mb-6 rounded-card border border-bone bg-mist p-4">
          <h3 className="mb-3 font-bold text-ink">Subscription</h3>
          <div className="mb-2 inline-block rounded-full bg-brand-violet/10 px-3 py-1 text-sm font-bold text-brand-violet">
            {user.subscription?.plan || "Free Plan"}
          </div>
          <p className="mb-4 text-sm text-slate">
            {user.subscription?.details || "50 invoices/month"}
          </p>
          <button
            className="btn-primary"
            onClick={() => {
              setShowProfileModal(false);
              window.location.href = "#pricing";
            }}
          >
            Upgrade Plan
          </button>
        </div>

        <form onSubmit={handleSave} className="mb-6 space-y-4">
          <h3 className="font-bold text-ink">Account Settings</h3>
          {[
            { label: "Business Name", value: businessName, setter: setBusinessName },
            { label: "GSTIN", value: gstin, setter: setGstin },
            { label: "Phone", value: phone, setter: setPhone },
          ].map(({ label, value, setter }) => (
            <label key={label} className="block text-sm text-slate">
              {label}
              <input
                value={value}
                onChange={(event) => setter(event.target.value)}
                className="mt-1 w-full rounded-input border border-bone bg-white px-4 py-3 text-ink outline-none focus:border-signal-blue"
              />
            </label>
          ))}
          <button type="submit" disabled={saving} className="btn-secondary">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>

        <div>
          <h3 className="mb-3 font-bold text-ink">Danger Zone</h3>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              className="rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-700"
              onClick={() => logout()}
            >
              Sign Out
            </button>
            <Link
              href="/delete-account"
              className="text-sm font-medium text-red-600 underline hover:text-red-700"
            >
              Request Account &amp; Data Deletion
            </Link>
          </div>
          <p className="mt-2 text-xs text-slate">
            This will open our account deletion page. We will process your request within 30 days.
          </p>
        </div>
      </div>
    </div>
  );
}
