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
  Home,
} from "lucide-react";
import type { View } from "@/lib/types";
import { isUsingFileSystem, getFolderName } from "@/lib/storage";
import { ProfileDropdown } from "@/components/ProfileDropdown";

type SidebarProps = {
  view: View;
  onNavigate: (view: View) => void;
  onPickFolder: () => void;
  onSync?: () => void;
  syncStatus?: string;
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

export function Sidebar({ view, onNavigate, onPickFolder, onSync, syncStatus }: SidebarProps) {
  const folderName = getFolderName();
  const usingFS = isUsingFileSystem();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-bone bg-mist">
      <div className="flex items-center gap-3 border-b border-bone px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.svg" alt="Argus" width={28} height={28} />
          <span className="text-lg font-bold text-ink">Argus</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {menuItems.map(({ view: v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => onNavigate(v)}
            className={`mb-1 flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm transition ${
              view === v || (v === "invoices" && (view === "invoice-form" || view === "invoice-preview"))
                ? "bg-brand-violet text-white"
                : "text-slate hover:bg-plaster hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="border-t border-bone p-3">
        <button
          onClick={onPickFolder}
          className="mb-2 flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm text-slate transition hover:bg-plaster hover:text-ink"
        >
          <FolderOpen className="h-4 w-4" />
          <div className="flex flex-col text-left">
            <span>Invoice Folder</span>
            <span className="text-xs text-ash">
              {usingFS ? `📁 ${folderName}` : "Click to select"}
            </span>
          </div>
        </button>

        <ProfileDropdown
          variant="sidebar"
          onNavigateSettings={() => onNavigate("settings")}
          onSync={onSync}
          syncStatus={syncStatus}
        />
      </div>
    </aside>
  );
}
