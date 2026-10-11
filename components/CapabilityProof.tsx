"use client";

import { Handshake, Store, ShoppingBag, Truck, Warehouse } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

const trades = [
  { label: "Kirana Stores", icon: Store },
  { label: "Distributors", icon: Truck },
  { label: "Service Businesses", icon: Handshake },
  { label: "Retailers", icon: ShoppingBag },
  { label: "Wholesalers", icon: Warehouse },
];

const stats = [
  { value: "₹0", label: "20 free bills a month on Android" },
  { value: "14 days", label: "Full Business trial, no card" },
  { value: "0·5·18·40%", label: "GST 2.0 slabs, validated per bill" },
  { value: "Free", label: "Read-only seat for your CA" },
];

export function CapabilityProof() {
  return (
    <section className="relative border-b border-bone bg-white py-14 md:py-16">
      <div className="container-page">
        <Reveal>
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate">
            Built for kirana stores, distributors, and service businesses across India
          </p>
          <ul className="mb-12 flex flex-wrap justify-center gap-3">
            {trades.map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full bg-mist px-4 py-2 text-sm font-medium text-ink ring-1 ring-bone"
              >
                <Icon className="h-4 w-4 text-brand-violet" />
                {label}
              </li>
            ))}
          </ul>
        </Reveal>
        <Stagger className="grid grid-cols-2 gap-px overflow-hidden rounded-card-lg border border-bone bg-bone lg:grid-cols-4" stagger={0.08}>
          {stats.map(({ value, label }) => (
            <StaggerItem key={label} y={16} className="bg-white px-6 py-8 text-center">
              <div className="gradient-text whitespace-nowrap font-display text-2xl font-bold tracking-tight sm:text-3xl xl:text-4xl">{value}</div>
              <p className="mt-2 text-sm text-slate">{label}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
