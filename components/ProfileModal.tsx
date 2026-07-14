"use client";

import { FormEvent, useEffect, useState } from "react";
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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-lead/20 bg-midnight p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mercury-blue text-lg font-medium text-white">
            {getInitials(user.name)}
          </div>
          <div>
            <h2 className="text-xl text-starlight">{user.name}</h2>
            <p className="text-sm text-silver">{user.email}</p>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-lead/20 bg-graphite p-4">
          <h3 className="mb-3 text-starlight">Subscription</h3>
          <div className="mb-2 inline-block rounded-full bg-mercury-blue/20 px-3 py-1 text-sm text-mercury-ghost">
            {user.subscription?.plan || "Free Plan"}
          </div>
          <p className="mb-4 text-sm text-silver">
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
          <h3 className="text-starlight">Account Settings</h3>
          {[
            { label: "Business Name", value: businessName, setter: setBusinessName },
            { label: "GSTIN", value: gstin, setter: setGstin },
            { label: "Phone", value: phone, setter: setPhone },
          ].map(({ label, value, setter }) => (
            <label key={label} className="block text-sm text-silver">
              {label}
              <input
                value={value}
                onChange={(event) => setter(event.target.value)}
                className="mt-1 w-full rounded-btn border border-lead/30 bg-abyss px-4 py-3 text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
          ))}
          <button type="submit" disabled={saving} className="btn-secondary">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>

        <div>
          <h3 className="mb-3 text-starlight">Danger Zone</h3>
          <button
            className="rounded-btn bg-red-600 px-6 py-3 text-sm text-white hover:bg-red-700"
            onClick={() => logout()}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
