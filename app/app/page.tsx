"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Menu, X, Cloud, CloudOff, RefreshCw } from "lucide-react";
import type { AppData, BusinessProfile, Invoice, View } from "@/lib/types";
import { loadData, saveInvoice, deleteInvoice, pickFolder, deductStockForInvoice, saveData } from "@/lib/storage";
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
import { useAuth, hasValidSubscription } from "@/lib/auth-provider";
import { AuthModal } from "@/components/AuthModal";
import { SubscriptionGate } from "@/components/SubscriptionGate";

export default function AppPage() {
  const { user, authReady, authConfigured, setShowAuthModal, token } = useAuth();
  const [data, setData] = useState<AppData | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSyncedFromCloud = useRef(false);

  useEffect(() => {
    setLastSync(getLastSyncTime());
  }, []);

  useEffect(() => {
    if (!token || !user || !hasValidSubscription(user)) {
      setData(loadData());
      return;
    }

    if (hasSyncedFromCloud.current) return;
    hasSyncedFromCloud.current = true;

    setSyncStatus("syncing");
    syncFromCloud(token).then(({ data: syncedData, merged }) => {
      setData(syncedData);
      setLastSync(getLastSyncTime());
      setSyncStatus(merged ? "synced" : "idle");
    }).catch(() => {
      setData(loadData());
      setSyncStatus("error");
    });
  }, [token, user]);

  const refresh = useCallback(() => {
    setData(loadData());
    if (token && user && hasValidSubscription(user)) {
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
            Please sign in to access the dashboard. Use the same account as the Argus app.
          </p>
        </div>
        <button
          onClick={() => setShowAuthModal(true)}
          className="btn-primary"
        >
          Sign In
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
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-slate">Loading Argus...</div>
      </div>
    );
  }

  const activeBusiness: BusinessProfile | null =
    data.businesses.find((b) => b.id === data.activeBusinessId) || null;

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
    await pickFolder();
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
            onBack={() => navigate("invoices")}
            onEdit={handleEditInvoice}
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

      case "recurring":
        return <RecurringInvoices data={d} onSaved={refresh} />;

      default:
        return <div className="text-slate">Unknown view.</div>;
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
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
          <span className="text-lg font-bold text-ink">Argus</span>
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
