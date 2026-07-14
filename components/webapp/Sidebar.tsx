"use client";

import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Package,
  Settings as SettingsIcon,
  FolderOpen,
  LogOut,
  Home,
} from "lucide-react";
import type { View } from "@/lib/types";
import { useAuth } from "@/lib/auth-provider";
import { getInitials } from "@/lib/auth-provider";
import { isUsingFileSystem, getFolderName } from "@/lib/storage";

type SidebarProps = {
  view: View;
  onNavigate: (view: View) => void;
  onPickFolder: () => void;
};

const menuItems: { view: View; label: string; icon: typeof LayoutDashboard }[] = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "invoices", label: "Invoices", icon: FileText },
  { view: "parties", label: "Parties", icon: Users },
  { view: "reports", label: "GSTR Reports", icon: BarChart3 },
  { view: "stock", label: "Inventory", icon: Package },
  { view: "business", label: "Business", icon: LayoutDashboard },
  { view: "settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar({ view, onNavigate, onPickFolder }: SidebarProps) {
  const { user, logout } = useAuth();
  const folderName = getFolderName();
  const usingFS = isUsingFileSystem();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-lead/20 bg-midnight">
      <div className="flex items-center gap-3 border-b border-lead/20 px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.svg" alt="Argus" width={28} height={28} />
          <span className="text-lg font-medium text-starlight">Argus</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {menuItems.map(({ view: v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => onNavigate(v)}
            className={`mb-1 flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition ${
              view === v || (v === "invoices" && (view === "invoice-form" || view === "invoice-preview"))
                ? "bg-mercury-blue text-white"
                : "text-silver hover:bg-graphite hover:text-starlight"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="border-t border-lead/20 p-3">
        <button
          onClick={onPickFolder}
          className="mb-2 flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-silver transition hover:bg-graphite hover:text-starlight"
        >
          <FolderOpen className="h-4 w-4" />
          <div className="flex flex-col text-left">
            <span>Invoice Folder</span>
            <span className="text-xs text-lead">
              {usingFS ? `📁 ${folderName}` : "Click to select"}
            </span>
          </div>
        </button>

        {user && (
          <div className="mb-2 flex items-center gap-3 rounded-lg bg-graphite px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mercury-blue text-xs font-medium text-white">
              {getInitials(user.name)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm text-starlight">{user.name}</p>
              <p className="truncate text-xs text-silver">{user.email}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Link
            href="/"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-lead/30 px-3 py-2 text-xs text-silver transition hover:text-starlight"
          >
            <Home className="h-3.5 w-3.5" />
            Home
          </Link>
          <button
            onClick={() => logout()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-lead/30 px-3 py-2 text-xs text-silver transition hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
