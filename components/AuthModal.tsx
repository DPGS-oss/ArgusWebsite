"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth-provider";

type Tab = "login" | "register";

export function AuthModal() {
  const { showAuthModal, setShowAuthModal, login, loginWithGoogle, register } = useAuth();
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

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
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
        className="w-full max-w-md rounded-card border border-bone bg-white p-6 shadow-subtle"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex gap-2 rounded-full bg-plaster p-1">
          {(["login", "register"] as Tab[]).map((value) => (
            <button
              key={value}
              className={`flex-1 rounded-full py-2 text-sm font-bold capitalize ${
                tab === value ? "bg-ink text-white" : "text-slate"
              }`}
              onClick={() => setTab(value)}
            >
              {value === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 rounded-card bg-red-500/10 px-4 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Google Sign-In */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mb-4 flex w-full items-center justify-center gap-3 rounded-input border border-bone bg-white px-4 py-3 text-sm font-bold text-ink transition hover:bg-plaster"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {loading ? "Signing in..." : "Continue with Google"}
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-bone" />
          <span className="text-xs text-slate">or</span>
          <div className="h-px flex-1 bg-bone" />
        </div>

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block text-sm text-slate">
              Email
              <input
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-input border border-bone bg-white px-4 py-3 text-ink outline-none focus:border-signal-blue"
              />
            </label>
            <label className="block text-sm text-slate">
              Password
              <input
                name="password"
                type="password"
                required
                className="mt-1 w-full rounded-input border border-bone bg-white px-4 py-3 text-ink outline-none focus:border-signal-blue"
              />
            </label>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <label className="block text-sm text-slate">
              Full Name
              <input
                name="name"
                type="text"
                required
                className="mt-1 w-full rounded-input border border-bone bg-white px-4 py-3 text-ink outline-none focus:border-signal-blue"
              />
            </label>
            <label className="block text-sm text-slate">
              Email
              <input
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-input border border-bone bg-white px-4 py-3 text-ink outline-none focus:border-signal-blue"
              />
            </label>
            <label className="block text-sm text-slate">
              Password
              <input
                name="password"
                type="password"
                required
                className="mt-1 w-full rounded-input border border-bone bg-white px-4 py-3 text-ink outline-none focus:border-signal-blue"
              />
            </label>
            <label className="block text-sm text-slate">
              Confirm Password
              <input
                name="confirmPassword"
                type="password"
                required
                className="mt-1 w-full rounded-input border border-bone bg-white px-4 py-3 text-ink outline-none focus:border-signal-blue"
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
