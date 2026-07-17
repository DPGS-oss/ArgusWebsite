"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  User,
  Settings as SettingsIcon,
  Cloud,
  LogOut,
  Home,
  ChevronDown,
} from "lucide-react";
import { getInitials, useAuth } from "@/lib/auth-provider";

type ProfileDropdownProps = {
  onNavigateSettings?: () => void;
  onSync?: () => void;
  syncStatus?: string;
  variant?: "navbar" | "sidebar";
};

export function ProfileDropdown({
  onNavigateSettings,
  onSync,
  syncStatus = "idle",
  variant = "navbar",
}: ProfileDropdownProps) {
  const { user, logout, setShowProfileModal } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const isSidebar = variant === "sidebar";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-full transition ${
          isSidebar
            ? "w-full bg-plaster px-3 py-2.5 hover:bg-bone"
            : "bg-ink px-3 py-2 text-white hover:bg-onyx"
        }`}
      >
        <div
          className={`flex items-center justify-center rounded-full bg-brand-violet text-xs font-bold text-white ${
            isSidebar ? "h-8 w-8" : "h-6 w-6"
          }`}
        >
          {getInitials(user.name)}
        </div>
        {isSidebar && (
          <div className="flex-1 overflow-hidden text-left">
            <p className="truncate text-sm text-ink">{user.name}</p>
            <p className="truncate text-xs text-slate">{user.email}</p>
          </div>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""} ${
            isSidebar ? "text-slate" : "text-white/70"
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-2 w-64 rounded-card border border-bone bg-white p-2 shadow-subtle ${
            isSidebar ? "bottom-full left-0 mb-2" : "right-0 top-full"
          }`}
        >
          <div className="border-b border-bone px-3 py-2">
            <p className="truncate text-sm font-bold text-ink">{user.name}</p>
            <p className="truncate text-xs text-slate">{user.email}</p>
            {user.subscription?.plan && (
              <span className="mt-1 inline-block rounded-full bg-brand-violet/10 px-2 py-0.5 text-xs font-bold text-brand-violet">
                {user.subscription.plan}
              </span>
            )}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              setShowProfileModal(true);
            }}
            className="flex w-full items-center gap-3 rounded-full px-3 py-2 text-sm text-slate transition hover:bg-mist hover:text-ink"
          >
            <User className="h-4 w-4" />
            Profile & Account
          </button>

          {onNavigateSettings && (
            <button
              onClick={() => {
                setOpen(false);
                onNavigateSettings();
              }}
              className="flex w-full items-center gap-3 rounded-full px-3 py-2 text-sm text-slate transition hover:bg-mist hover:text-ink"
            >
              <SettingsIcon className="h-4 w-4" />
              App Settings
            </button>
          )}

          {onSync && (
            <button
              onClick={() => {
                setOpen(false);
                onSync();
              }}
              className="flex w-full items-center gap-3 rounded-full px-3 py-2 text-sm text-slate transition hover:bg-mist hover:text-ink"
            >
              <Cloud className="h-4 w-4" />
              Sync Now
              {syncStatus === "syncing" && (
                <span className="ml-auto text-xs text-slate">...</span>
              )}
              {syncStatus === "synced" && (
                <span className="ml-auto text-xs text-emerald-500">✓</span>
              )}
            </button>
          )}

          <Link
            href="/"
            className="flex w-full items-center gap-3 rounded-full px-3 py-2 text-sm text-slate transition hover:bg-mist hover:text-ink"
            onClick={() => setOpen(false)}
          >
            <Home className="h-4 w-4" />
            Home
          </Link>

          <div className="my-1 border-t border-bone" />

          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-3 rounded-full px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
