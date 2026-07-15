"use client";

import { useState, useEffect, useCallback } from "react";
import { Menu, X } from "lucide-react";
import type { AppData, BusinessProfile, Invoice, View } from "@/lib/types";
import { loadData, saveInvoice, deleteInvoice, pickFolder, deductStockForInvoice } from "@/lib/storage";
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
import { useAuth, hasValidSubscription } from "@/lib/auth-provider";
import { AuthModal } from "@/components/AuthModal";
import { SubscriptionGate } from "@/components/SubscriptionGate";

export default function AppPage() {
  const { user, authReady, authConfigured, setShowAuthModal } = useAuth();
  const [data, setData] = useState<AppData | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setData(loadData());
  }, []);

  const refresh = useCallback(() => {
    setData(loadData());
  }, []);

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
          <div className="w-9" />
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
