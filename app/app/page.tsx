"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Menu, X, Cloud, CloudOff, RefreshCw } from "lucide-react";
import type { AppData, BusinessProfile, Invoice, View } from "@/lib/types";
import { loadData, saveInvoice, deleteInvoice, pickFolder, deductStockForInvoice, saveData, generateId, initStorage, isFileSystemSupported, isUsingFileSystem, getFolderName } from "@/lib/storage";
import { syncFromCloud, syncToCloud, getLastSyncTime, type SyncStatus } from "@/lib/cloud-sync";
import { Sidebar } from "@/components/webapp/Sidebar";
import { Dashboard } from "@/components/webapp/Dashboard";
import { InvoiceList } from "@/components/webapp/InvoiceList";
import { InvoiceForm } from "@/components/webapp/InvoiceForm";
import { InvoicePreview } from "@/components/webapp/InvoicePreview";
import { Reports } from "@/components/webapp/Reports";
import { BusinessManager } from "@/components/webapp/BusinessManager";
import { Parties } from "@/components/webapp/Parties";
import { Settings } from "@/components/webapp/Settings";
import { Inventory } from "@/components/webapp/Inventory";
import { CreditNotes } from "@/components/webapp/CreditNotes";
import { DeliveryChallans } from "@/components/webapp/DeliveryChallans";
import { Expenses } from "@/components/webapp/Expenses";
import { Quotes } from "@/components/webapp/Quotes";
import { Purchases } from "@/components/webapp/Purchases";
import { Payments } from "@/components/webapp/Payments";
import { Templates } from "@/components/webapp/Templates";
import { Khata } from "@/components/webapp/Khata";
import { RecurringInvoices } from "@/components/webapp/RecurringInvoices";
import { Books } from "@/components/webapp/Books";
import { postInvoiceLedger, persistLedger, applyPaymentToInvoice } from "@/lib/books";
import { FilesArchive } from "@/components/webapp/FilesArchive";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth, hasValidSubscription } from "@/lib/auth-provider";
import { AuthModal } from "@/components/AuthModal";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import {
  WebAppTutorial,
  hasCompletedTutorial,
} from "@/components/webapp/WebAppTutorial";
import { getExpiryIso } from "@/lib/subscription";

function trialDaysLeft(user: { subscription?: { plan_key?: string; plan?: string; expiry_date?: string | null; source?: string } } | null): number | null {
  if (!user?.subscription) return null;
  const key = String(user.subscription.plan_key || user.subscription.plan || "").toLowerCase();
  const isTrial =
    key.includes("trial") || String(user.subscription.source || "").toLowerCase() === "trial";
  if (!isTrial) return null;
  const expiry = getExpiryIso(user.subscription);
  if (!expiry) return null;
  const ms = new Date(expiry).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 86400000));
}

export default function AppPage() {
  const { user, authReady, authConfigured, setShowAuthModal, token, firebaseUser } = useAuth();
  const [data, setData] = useState<AppData | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [storageBooted, setStorageBooted] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSyncedFromCloud = useRef(false);

  useEffect(() => {
    setLastSync(getLastSyncTime());
  }, []);

  useEffect(() => {
    let cancelled = false;
    initStorage().then((local) => {
      if (cancelled) return;
      setStorageBooted(true);
      if (isUsingFileSystem()) setFolderName(getFolderName());
      if (!token || !user || !hasValidSubscription(user)) {
        setData(local);
        return;
      }
      if (local.settings.cloudSharing === false) {
        setData(local);
        return;
      }
      if (hasSyncedFromCloud.current) {
        setData(local);
        return;
      }
      hasSyncedFromCloud.current = true;
      setSyncStatus("syncing");
      syncFromCloud(token)
        .then(({ data: syncedData, merged }) => {
          if (cancelled) return;
          setData(syncedData);
          setLastSync(getLastSyncTime());
          setSyncStatus(merged ? "synced" : "idle");
        })
        .catch(() => {
          if (cancelled) return;
          setData(loadData());
          setSyncStatus("error");
        });
    });
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid || !storageBooted) return;
    if (!hasValidSubscription(user)) return;
    if (!hasCompletedTutorial(uid)) {
      setShowTutorial(true);
    }
  }, [firebaseUser?.uid, user, storageBooted]);

  const refresh = useCallback(() => {
    setData(loadData());
    if (isUsingFileSystem()) setFolderName(getFolderName());
    else setFolderName(null);
    if (token && user && hasValidSubscription(user) && loadData().settings.cloudSharing !== false) {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        setSyncStatus("syncing");
        syncToCloud(token).then((ok) => {
          setSyncStatus(ok ? "synced" : "error");
          setLastSync(getLastSyncTime());
        }).catch(() => setSyncStatus("error"));
      }, 2000);
    }
  }, [token, user]);

  async function handleManualSync() {
    if (!token) return;
    setSyncStatus("syncing");
    const result = await syncFromCloud(token);
    setData(result.data);
    setLastSync(getLastSyncTime());
    setSyncStatus(result.merged ? "synced" : "idle");
  }

  // Auth not ready yet — show loading
  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-slate">Loading Argus...</div>
      </div>
    );
  }

  // Auth not configured (Firebase not set up) — show error
  if (!authConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mb-2 text-slate">Authentication is not configured.</div>
          <a href="/" className="text-signal-blue hover:underline">← Back to Home</a>
        </div>
      </div>
    );
  }

  // Not logged in — show login prompt + AuthModal
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-ink">Welcome to Argus Web</h1>
          <p className="max-w-md text-slate">
            Sign in with the same account as the Android app. New here? Start a 14-day Business
            trial after sign-in — no card required.
          </p>
        </div>
        <button
          onClick={() => setShowAuthModal(true)}
          className="btn-primary"
        >
          Sign in to start trial
        </button>
        <a href="/" className="mt-6 text-sm text-slate hover:text-ink">
          ← Back to Home
        </a>
        <AuthModal />
      </div>
    );
  }

  // Logged in but no valid subscription — show paywall
  if (!hasValidSubscription(user)) {
    return <SubscriptionGate />;
  }

  // Auth ready + logged in + valid subscription — load app data
  if (!data || !storageBooted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-slate">Loading Argus...</div>
      </div>
    );
  }

  const activeBusiness: BusinessProfile | null =
    data.businesses.find((b) => b.id === data.activeBusinessId) || null;
  const daysLeft = trialDaysLeft(user);

  function navigate(view: View) {
    setView(view);
    setEditingInvoice(null);
    setPreviewInvoice(null);
    setSidebarOpen(false);
  }

  function handleNewInvoice() {
    setEditingInvoice(null);
    setPreviewInvoice(null);
    setView("invoice-form");
    setSidebarOpen(false);
  }

  function handleEditInvoice(invoice: Invoice) {
    setEditingInvoice(invoice);
    setPreviewInvoice(null);
    setView("invoice-form");
  }

  function handlePreviewInvoice(invoice: Invoice) {
    setPreviewInvoice(invoice);
    setEditingInvoice(null);
    setView("invoice-preview");
  }

  function handleSaveInvoice(invoice: Invoice) {
    const existing = data?.invoices.find((i) => i.id === invoice.id);
    saveInvoice(invoice);
    if (!existing) {
      deductStockForInvoice(invoice);
    }
    const after = loadData();
    persistLedger(postInvoiceLedger(after, invoice));
    refresh();
    setEditingInvoice(null);
    setPreviewInvoice(invoice);
    setView("invoice-preview");
  }

  function handleDeleteInvoice(id: string) {
    deleteInvoice(id);
    refresh();
    setView("invoices");
  }

  async function handlePickFolder() {
    const name = await pickFolder();
    if (name) setFolderName(name);
    refresh();
  }

  function renderContent() {
    const d = data!;
    switch (view) {
      case "dashboard":
        return (
          <Dashboard
            data={d}
            business={activeBusiness}
            onNavigate={navigate}
            onEditInvoice={handlePreviewInvoice}
          />
        );

      case "invoices":
        return (
          <InvoiceList
            data={d}
            onNew={handleNewInvoice}
            onPreview={handlePreviewInvoice}
            onEdit={handleEditInvoice}
            onDelete={handleDeleteInvoice}
          />
        );

      case "invoice-form":
        return (
          <InvoiceForm
            data={d}
            business={activeBusiness}
            editingInvoice={editingInvoice}
            onSave={handleSaveInvoice}
            onBack={() => navigate("invoices")}
          />
        );

      case "invoice-preview":
        return previewInvoice ? (
          <InvoicePreview
            invoice={previewInvoice}
            business={activeBusiness}
            stock={d.stock}
            onBack={() => navigate("invoices")}
            onEdit={handleEditInvoice}
            onMarkPaid={() => {
              const amt = previewInvoice.balanceDue || previewInvoice.grandTotal;
              persistLedger(
                applyPaymentToInvoice(d, {
                  id: generateId(),
                  invoiceId: previewInvoice.id,
                  amount: amt,
                  method: "UPI",
                  date: new Date().toISOString().slice(0, 10),
                  note: "I got it",
                })
              );
              refresh();
            }}
          />
        ) : (
          <div className="text-slate">No invoice selected.</div>
        );

      case "parties":
        return <Parties data={d} onSaved={refresh} />;

      case "reports":
        return <Reports data={d} />;

      case "stock":
        return <Inventory data={d} onSaved={refresh} />;

      case "business":
        return <BusinessManager data={d} onSaved={refresh} />;

      case "settings":
        return <Settings data={d} onSaved={refresh} />;

      case "credit-notes":
        return <CreditNotes data={d} onSaved={refresh} />;

      case "delivery-challans":
        return <DeliveryChallans data={d} onSaved={refresh} />;

      case "expenses":
        return <Expenses data={d} onSaved={refresh} />;

      case "quotes":
        return <Quotes data={d} onSaved={refresh} />;

      case "purchases":
        return <Purchases data={d} onSaved={refresh} />;

      case "payments":
        return <Payments data={d} onSaved={refresh} />;

      case "templates":
        return <Templates data={d} onSaved={refresh} />;

      case "khata":
        return <Khata data={d} onSaved={refresh} />;

      case "books":
        return <Books data={d} onSaved={refresh} />;

      case "recurring":
        return <RecurringInvoices data={d} onSaved={refresh} />;

      case "files":
        return <FilesArchive />;

      default:
        return <div className="text-slate">Unknown view.</div>;
    }
  }

  function setSharing(enabled: boolean) {
    const cur = loadData();
    saveData({ ...cur, settings: { ...cur.settings, cloudSharing: enabled } });
    setData(loadData());
    if (enabled && token) {
      hasSyncedFromCloud.current = false;
      handleManualSync();
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {showTutorial && firebaseUser?.uid ? (
        <WebAppTutorial
          userId={firebaseUser.uid}
          onComplete={() => setShowTutorial(false)}
          onGoToBusiness={() => navigate("business")}
          onGoToSettings={() => navigate("settings")}
        />
      ) : null}

      {data && data.settings.cloudSharing === undefined && !showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md rounded-2xl bg-white p-6">
            <h2 className="text-xl font-bold text-ink">Share books with the phone app?</h2>
            <p className="mt-2 text-sm text-slate">
              Turn this on if you use both this website and the installed Argus app. Invoices, inventory, UPI QR, and saved PDFs sync through your login.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button className="btn-primary" onClick={() => setSharing(true)}>
                Yes — sync phone and website
              </button>
              <button className="btn-secondary" onClick={() => setSharing(false)}>
                Not now — keep data in this browser
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          view={view}
          onNavigate={navigate}
          onPickFolder={handlePickFolder}
          onSync={handleManualSync}
          syncStatus={syncStatus}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="flex items-center justify-between border-b border-bone bg-mist px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-full p-2 text-slate hover:bg-plaster"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <BrandLogo href="/app/" size={28} showWordmark />
          <button
            onClick={handleManualSync}
            className="rounded-full p-2 text-slate hover:bg-plaster"
            title="Sync"
          >
            {syncStatus === "syncing" ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : syncStatus === "error" ? (
              <CloudOff className="h-4 w-4 text-red-500" />
            ) : (
              <Cloud className="h-4 w-4 text-emerald-500" />
            )}
          </button>
        </div>

        {/* Desktop sync bar */}
        <div className="hidden items-center justify-end gap-2 border-b border-bone bg-mist px-8 py-2 lg:flex">
          <span className="text-xs text-slate">
            {folderName
              ? `Local folder: ${folderName}`
              : isFileSystemSupported()
                ? "No local folder yet"
                : "Saved in this browser (IndexedDB)"}
            {" · "}
            {syncStatus === "syncing"
              ? "Syncing..."
              : syncStatus === "error"
              ? "Sync failed"
              : lastSync
              ? `Last synced: ${new Date(lastSync).toLocaleTimeString()}`
              : "Not synced yet"}
          </span>
          <button
            onClick={handleManualSync}
            className="flex items-center gap-1 rounded-full px-3 py-1 text-xs text-slate hover:bg-plaster hover:text-ink"
          >
            {syncStatus === "syncing" ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Sync Now
          </button>
        </div>

        {daysLeft != null ? (
          <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 lg:px-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-emerald-950">
                {daysLeft === 0
                  ? "Your free trial ends today."
                  : `Business trial: ${daysLeft} day${daysLeft === 1 ? "" : "s"} left.`}{" "}
                Subscribe anytime to keep full web access.
              </p>
              <a
                href="/#pricing"
                className="shrink-0 rounded-full bg-ink px-4 py-2 text-center text-xs font-bold text-white hover:bg-brand-violet"
              >
                View plans
              </a>
            </div>
          </div>
        ) : null}

        {isFileSystemSupported() && !folderName && !showTutorial ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 lg:px-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-950">
                Optional: choose a folder for{" "}
                <code className="rounded bg-amber-100 px-1">argus-books.json</code> backup.
                You can also do this later in Settings.
              </p>
              <button
                type="button"
                onClick={handlePickFolder}
                className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-brand-violet"
              >
                Choose folder
              </button>
            </div>
          </div>
        ) : null}

        {!isFileSystemSupported() && !showTutorial ? (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-3 lg:px-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-sky-950">
                Firefox and Safari can&apos;t open a disk folder from the browser (security rule).
                Your books still save automatically in this browser. For a portable file backup,
                use <strong>Settings → Export Data</strong> (or cloud sync if enabled).
              </p>
              <button
                type="button"
                onClick={() => navigate("settings")}
                className="shrink-0 rounded-full border border-sky-300 bg-white px-4 py-2 text-xs font-bold text-sky-950 hover:bg-sky-100"
              >
                Open Settings
              </button>
            </div>
          </div>
        ) : null}

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {view === "dashboard" && !activeBusiness && data.businesses.length === 0 ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
              <h2 className="mb-2 text-2xl font-bold text-ink">Welcome to Argus Web</h2>
              <p className="mb-6 max-w-md text-slate">
                You need to create a business profile before you can start creating invoices.
              </p>
              <button
                onClick={() => navigate("business")}
                className="btn-primary"
              >
                Create Your First Business
              </button>
            </div>
          ) : (
            renderContent()
          )}
        </main>
      </div>
    </div>
  );
}
