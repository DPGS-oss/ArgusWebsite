"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Users, Search } from "lucide-react";
import type { AppData, Party } from "@/lib/types";
import { INDIAN_STATES } from "@/lib/types";
import { generateId, saveParty, deleteParty } from "@/lib/storage";

type PartiesProps = {
  data: AppData;
  onSaved: () => void;
};

const emptyParty = (): Party => ({
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
  type: "customer",
  createdAt: new Date().toISOString(),
});

export function Parties({ data, onSaved }: PartiesProps) {
  const [editing, setEditing] = useState<Party | null>(null);
  const [search, setSearch] = useState("");

  const parties = data.parties
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.gstin.includes(search))
    .sort((a, b) => a.name.localeCompare(b.name));

  function handleSave() {
    if (!editing) return;
    if (!editing.name) {
      alert("Party name is required");
      return;
    }
    saveParty(editing);
    setEditing(null);
    onSaved();
  }

  function handleDelete(id: string) {
    if (data.invoices.some((i) => i.partyId === id)) {
      alert("Cannot delete a party that has invoices.");
      return;
    }
    if (!confirm("Delete this party?")) return;
    deleteParty(id);
    onSaved();
  }

  function updateField(field: keyof Party, value: string) {
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
          <h1 className="text-2xl text-starlight">{editing.name ? "Edit Party" : "Add Party"}</h1>
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="btn-secondary !py-2">Cancel</button>
            <button onClick={handleSave} className="btn-primary !py-2">Save</button>
          </div>
        </div>

        <div className="rounded-lg border border-lead/20 bg-midnight p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-silver">
              Name *
              <input
                type="text"
                value={editing.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
            <label className="block text-sm text-silver">
              Type
              <select
                value={editing.type}
                onChange={(e) => updateField("type", e.target.value)}
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
              >
                <option value="customer">Customer</option>
                <option value="supplier">Supplier</option>
              </select>
            </label>
            <label className="block text-sm text-silver">
              GSTIN
              <input
                type="text"
                value={editing.gstin}
                onChange={(e) => updateField("gstin", e.target.value)}
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
            <label className="block text-sm text-silver">
              PAN
              <input
                type="text"
                value={editing.pan}
                onChange={(e) => updateField("pan", e.target.value)}
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
            <label className="block text-sm text-silver">
              Phone
              <input
                type="text"
                value={editing.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
            <label className="block text-sm text-silver">
              Email
              <input
                type="text"
                value={editing.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
            <label className="block text-sm text-silver">
              State
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
            </label>
            <label className="block text-sm text-silver">
              City
              <input
                type="text"
                value={editing.city}
                onChange={(e) => updateField("city", e.target.value)}
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
            <label className="block text-sm text-silver">
              Pincode
              <input
                type="text"
                value={editing.pincode}
                onChange={(e) => updateField("pincode", e.target.value)}
                className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
              />
            </label>
          </div>
          <label className="block text-sm text-silver">
            Address
            <input
              type="text"
              value={editing.address}
              onChange={(e) => updateField("address", e.target.value)}
              className="mt-1 w-full rounded-btn border border-lead/30 bg-graphite px-4 py-2.5 text-starlight outline-none focus:border-mercury-blue"
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl text-starlight">Parties</h1>
        <button onClick={() => setEditing(emptyParty())} className="btn-primary">
          <Plus className="mr-1 h-4 w-4" /> Add Party
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lead" />
        <input
          type="text"
          placeholder="Search by name or GSTIN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-btn border border-lead/30 bg-graphite py-2.5 pl-10 pr-4 text-sm text-starlight outline-none focus:border-mercury-blue"
        />
      </div>

      {parties.length === 0 ? (
        <div className="rounded-lg border border-lead/20 bg-midnight py-16 text-center">
          <Users className="mx-auto mb-3 h-12 w-12 text-lead" />
          <p className="text-silver">No parties yet. Add customers or suppliers to start invoicing.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-lead/20 bg-midnight">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-lead/20 text-left text-silver">
                <th className="p-4">Name</th>
                <th className="p-4">Type</th>
                <th className="p-4">GSTIN</th>
                <th className="p-4">State</th>
                <th className="p-4">Phone</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.id} className="border-b border-lead/10 hover:bg-graphite/50">
                  <td className="p-4 text-starlight">{p.name}</td>
                  <td className="p-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      p.type === "customer" ? "bg-mercury-blue/20 text-mercury-blue" : "bg-purple-500/20 text-purple-400"
                    }`}>
                      {p.type}
                    </span>
                  </td>
                  <td className="p-4 text-silver">{p.gstin || "—"}</td>
                  <td className="p-4 text-silver">{p.state || "—"}</td>
                  <td className="p-4 text-silver">{p.phone || "—"}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditing({ ...p })}
                        className="rounded p-1.5 text-silver hover:bg-graphite hover:text-mercury-blue"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="rounded p-1.5 text-silver hover:bg-graphite hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
