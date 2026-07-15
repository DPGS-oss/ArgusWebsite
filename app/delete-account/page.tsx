"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import Link from "next/link";

export default function DeleteAccountPage() {
  const { user, token, logout } = useAuth();
  const [email, setEmail] = useState(user?.email || "");
  const [name, setName] = useState(user?.name || "");
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (confirmText !== "DELETE") {
      setResult("error");
      setErrorMessage('Please type "DELETE" to confirm.');
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers,
        body: JSON.stringify({ email, name, reason }),
      });

      if (response.ok) {
        setResult("success");
        if (user && token) {
          setTimeout(() => logout(), 3000);
        }
      } else {
        const data = await response.json().catch(() => ({}));
        setResult("error");
        setErrorMessage(data.error || "Failed to submit deletion request.");
      }
    } catch {
      setResult("error");
      setErrorMessage("Network error. Please try again or email support@argusinvoicing.com");
    } finally {
      setSubmitting(false);
    }
  }

  if (result === "success") {
    return (
      <main className="container-page py-16 md:py-24">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-card border border-bone bg-mist p-8 text-center">
            <h1 className="mb-4 text-3xl font-normal text-starlight">
              Deletion Request Received
            </h1>
            <p className="text-silver">
              Your account and data deletion request has been submitted successfully.
              We will process it within <strong>30 days</strong>. You will receive a
              confirmation email at <strong>{email}</strong> once the deletion is complete.
            </p>
            <p className="mt-4 text-sm text-slate">
              If you are logged in, you will be signed out shortly.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block text-mercury-blue hover:underline"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container-page py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-4xl font-normal text-starlight">
          Account &amp; Data Deletion
        </h1>

        <div className="mb-8 space-y-4 text-silver">
          <p>
            Use this form to request deletion of your Argus account and all
            associated data. This includes:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Account email and authentication records</li>
            <li>Business profiles (name, GSTIN, phone, address)</li>
            <li>All invoices, customers, purchases, and inventory data</li>
            <li>GST records and reports</li>
            <li>Subscription and billing history</li>
          </ul>
          <p className="text-sm">
            <strong className="text-red-500">This action is irreversible.</strong>{" "}
            Once processed, your data cannot be recovered. We may retain certain
            records required for tax compliance, fraud prevention, or legal
            obligations.
          </p>
          <p className="text-sm">
            Requests are processed within <strong>30 days</strong>. You will
            receive a confirmation email once deletion is complete.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-card border border-bone bg-mist p-6"
        >
          <div>
            <label className="block text-sm font-medium text-ink">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-input border border-bone bg-white px-4 py-3 text-ink outline-none focus:border-signal-blue"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-input border border-bone bg-white px-4 py-3 text-ink outline-none focus:border-signal-blue"
              placeholder="you@example.com"
            />
            {user && (
              <p className="mt-1 text-xs text-slate">
                This is the email associated with your logged-in account.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink">
              Reason <span className="text-slate">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-input border border-bone bg-white px-4 py-3 text-ink outline-none focus:border-signal-blue"
              placeholder="Tell us why you're deleting your account (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              type="text"
              required
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-1 w-full rounded-input border border-bone bg-white px-4 py-3 text-ink outline-none focus:border-signal-blue"
              placeholder="DELETE"
            />
          </div>

          {result === "error" && (
            <div className="rounded-input border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Delete My Account & Data"}
          </button>

          <p className="text-center text-xs text-slate">
            By submitting this form, you consent to the permanent deletion of
            your account and all associated data.
          </p>
        </form>

        <div className="mt-6 text-center text-sm text-slate">
          Prefer email? Contact us at{" "}
          <a
            href="mailto:support@argusinvoicing.com?subject=Request%20Account%20Deletion"
            className="text-mercury-blue underline"
          >
            support@argusinvoicing.com
          </a>
        </div>

        <p className="mt-6">
          <Link href="/" className="text-mercury-blue hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
