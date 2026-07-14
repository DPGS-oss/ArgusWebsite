"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Building2, Check } from "lucide-react";
import type { AppData, BusinessProfile } from "@/lib/types";
import { INDIAN_STATES } from "@/lib/types";
import { generateId, saveBusiness, setActiveBusiness, saveData } from "@/lib/storage";

type BusinessManagerProps = {
  data: AppData;
  onSaved: () => void;
};

const emptyBusiness = (): BusinessProfile => ({
  id: generateId(),
  name: "",
  gstin: "",
  pan: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  stateCode: "",
  pincode: "",
  bankName: "",
  bankAccount: "",
  bankIfsc: "",
  bankBranch: "",
  upiId: "",
});

export function BusinessManager({ data, onSaved }: BusinessManagerProps) {
  const [editing, setEditing] = useState<BusinessProfile | null>(null);
  const [isNew, setIsNew] = useState(false);

  function handleNew() {
    setEditing(emptyBusiness());
    setIsNew(true);
  }

  function handleEdit(b: BusinessProfile) {
    setEditing({ ...b });
    setIsNew(false);
  }

  function handleSave() {
    if (!editing) return;
    if (!editing.name) {
      alert("Business name is required");
      return;
    }
    saveBusiness(editing);
    if (isNew) setActiveBusiness(editing.id);
    setEditing(null);
    onSaved();
  }

  function handleSelect(id: string) {
    setActiveBusiness(id);
    onSaved();
  }

  function handleDelete(id: string) {
    if (data.invoices.some((i) => i.businessId === id)) {
      alert("Cannot delete a business that has invoices.");
      return;
    }
    if (!confirm("Delete this business?")) return;
    const updated = { ...data, businesses: data.businesses.filter((b) => b.id !== id) };
    if (updated.activeBusinessId === id) {
      updated.activeBusinessId = updated.businesses[0]?.id || null;
    }
    saveData(updated);
    onSaved();
  }

  function updateField(field: keyof BusinessProfile, value: string) {
    if (!editing) return;
    if (field === "state") {
      const state = INDIAN_STATES.find((s) => s.name === value);
      setEditing({ ...editing, state: value, stateCode: state?.code || "" });
    } else {
      setEditing({ ...editing, [field]: value });
    }
  }

  if (editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl text-starlight">
            {isNew ? "Add Business" : "Edit Business"}
          </h1>
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="btn-secondary !py-2">Cancel</button>
            <button onClick={handleSave} className="btn-primary !py-2">
              <Check className="mr-1 h-4 w-4" /> Save
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-lead/20 bg-midnight p-6 space-y-4">
          <h2 className="text-lg text-starlight">Business Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business Name *" value={editing.name} onChange={(v) => updateField("name", v)} />
            <Field label="GSTIN" value={editing.gstin} onChange={(v) => updateField("gstin", v)} />
            <Field label="PAN" value={editing.pan} onChange={(v) => updateField("pan", v)} />
            <Field label="Email" value={editing.email} onChange={(v) => updateField("email", v)} />
            <Field label="Phone" value={editing.phone} onChange={(v) => updateField("phone", v)} />
            <div>
              <label className="block text-sm text-silver">State</label>
              <select
                value={editing.state}
                onChange={(e) => updateField("state", e.target.value)}
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
              >
                <option value="">Select state...</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.name}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            <Field label="City" value={editing.city} onChange={(v) => updateField("city", v)} />
            <Field label="Pincode" value={editing.pincode} onChange={(v) => updateField("pincode", v)} />
          </div>
          <Field label="Address" value={editing.address} onChange={(v) => updateField("address", v)} full />
        </div>

        <div className="rounded-lg border border-lead/20 bg-midnight p-6 space-y-4">
          <h2 className="text-lg text-starlight">Bank Details (Optional)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank Name" value={editing.bankName} onChange={(v) => updateField("bankName", v)} />
            <Field label="Account Number" value={editing.bankAccount} onChange={(v) => updateField("bankAccount", v)} />
            <Field label="IFSC Code" value={editing.bankIfsc} onChange={(v) => updateField("bankIfsc", v)} />
            <Field label="Branch" value={editing.bankBranch} onChange={(v) => updateField("bankBranch", v)} />
            <Field label="UPI ID" value={editing.upiId} onChange={(v) => updateField("upiId", v)} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl text-starlight">Business Profiles</h1>
        <button onClick={handleNew} className="btn-primary">
          <Plus className="mr-1 h-4 w-4" /> Add Business
        </button>
      </div>

      {data.businesses.length === 0 ? (
        <div className="rounded-lg border border-lead/20 bg-midnight py-16 text-center">
          <Building2 className="mx-auto mb-3 h-12 w-12 text-lead" />
          <p className="text-silver">No business profiles yet. Add one to start creating invoices.</p>
          <button onClick={handleNew} className="btn-primary mt-4">Add Your First Business</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.businesses.map((b) => (
            <div
              key={b.id}
              className={`rounded-lg border p-5 ${
                data.activeBusinessId === b.id
                  ? "border-mercury-blue bg-midnight"
                  : "border-lead/20 bg-midnight"
              }`}
            >
              {data.activeBusinessId === b.id && (
                <span className="mb-2 inline-block rounded-full bg-mercury-blue/20 px-2 py-0.5 text-xs text-mercury-blue">
                  Active
                </span>
              )}
              <h3 className="text-lg text-starlight">{b.name}</h3>
              <p className="text-sm text-silver">GSTIN: {b.gstin || "N/A"}</p>
              <p className="text-sm text-silver">{b.city}, {b.state}</p>
              <p className="text-sm text-silver">{b.phone}</p>
              <div className="mt-4 flex gap-2">
                {data.activeBusinessId !== b.id && (
                  <button
                    onClick={() => handleSelect(b.id)}
                    className="rounded-btn border border-lead/30 px-3 py-1.5 text-xs text-silver hover:text-starlight"
                  >
                    Set Active
                  </button>
                )}
                <button
                  onClick={() => handleEdit(b)}
                  className="rounded-btn border border-lead/30 px-3 py-1.5 text-xs text-silver hover:text-mercury-blue"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="rounded-btn border border-lead/30 px-3 py-1.5 text-xs text-silver hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  full?: boolean;
}) {
  return (
    <label className={`block text-sm text-silver ${full ? "sm:col-span-2" : ""}`}>
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
      />
    </label>
  );
}
