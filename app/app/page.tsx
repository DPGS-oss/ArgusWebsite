"use client";

import { useState, useEffect, useCallback } from "react";
import { Menu, X } from "lucide-react";
import type { AppData, BusinessProfile, Invoice, View } from "@/lib/types";
import { loadData, saveInvoice, deleteInvoice, pickFolder } from "@/lib/storage";
import { Sidebar } from "@/components/webapp/Sidebar";
import { Dashboard } from "@/components/webapp/Dashboard";
import { InvoiceList } from "@/components/webapp/InvoiceList";
import { InvoiceForm } from "@/components/webapp/InvoiceForm";
import { InvoicePreview } from "@/components/webapp/InvoicePreview";
import { Reports } from "@/components/webapp/Reports";
import { BusinessManager } from "@/components/webapp/BusinessManager";
import { Parties } from "@/components/webapp/Parties";
import { Settings } from "@/components/webapp/Settings";

export default function AppPage() {
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

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-abyss">
        <div className="text-silver">Loading Argus...</div>
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
    saveInvoice(invoice);
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
          <div className="text-silver">No invoice selected.</div>
        );

      case "parties":
        return <Parties data={d} onSaved={refresh} />;

      case "reports":
        return <Reports data={d} />;

      case "business":
        return <BusinessManager data={d} onSaved={refresh} />;

      case "settings":
        return <Settings data={d} onSaved={refresh} />;

      default:
        return <div className="text-silver">Unknown view.</div>;
    }
  }

  return (
    <div className="flex min-h-screen bg-abyss">
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
        <div className="flex items-center justify-between border-b border-lead/20 bg-midnight px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 text-silver hover:bg-graphite"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-lg font-semibold text-starlight">Argus</span>
          <div className="w-9" />
        </div>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {view === "dashboard" && !activeBusiness && data.businesses.length === 0 ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
              <h2 className="mb-2 text-2xl text-starlight">Welcome to Argus Web</h2>
              <p className="mb-6 max-w-md text-silver">
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
