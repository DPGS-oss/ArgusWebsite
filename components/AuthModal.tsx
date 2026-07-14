"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth-provider";

type Tab = "login" | "register";

export function AuthModal() {
  const { showAuthModal, setShowAuthModal, login, register } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!showAuthModal) return null;

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get("email")), String(form.get("password")));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirm = String(form.get("confirmPassword"));
    if (password !== confirm) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }
    try {
      await register(String(form.get("name")), String(form.get("email")), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => setShowAuthModal(false)}
    >
      <div
        className="w-full max-w-md rounded-lg border border-lead/20 bg-midnight p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex gap-2 rounded-btn bg-graphite p-1">
          {(["login", "register"] as Tab[]).map((value) => (
            <button
              key={value}
              className={`flex-1 rounded-btn py-2 text-sm capitalize ${
                tab === value ? "bg-mercury-blue text-white" : "text-silver"
              }`}
              onClick={() => setTab(value)}
            >
              {value === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block text-sm text-silver">
              Email
              <input
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-3 text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
            <label className="block text-sm text-silver">
              Password
              <input
                name="password"
                type="password"
                required
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-3 text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <label className="block text-sm text-silver">
              Full Name
              <input
                name="name"
                type="text"
                required
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-3 text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
            <label className="block text-sm text-silver">
              Email
              <input
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-3 text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
            <label className="block text-sm text-silver">
              Password
              <input
                name="password"
                type="password"
                required
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-3 text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
            <label className="block text-sm text-silver">
              Confirm Password
              <input
                name="confirmPassword"
                type="password"
                required
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-3 text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
