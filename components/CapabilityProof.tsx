"use client";

import { Reveal, Stagger, StaggerItem } from "./Reveal";

const stats = [
  { value: "₹0", label: "Unlimited invoices on Android" },
  { value: "14 days", label: "Full Business trial, no card" },
  { value: "0·5·18·40%", label: "GST 2.0 slabs, validated per bill" },
  { value: "Free", label: "Read-only seat for your CA" },
];

export function CapabilityProof() {
  return (
    <section className="relative border-b border-bone bg-white py-14 md:py-16">
      <div className="container-page">
        <Reveal>
          <p className="mb-10 text-center text-sm font-medium text-slate">
            Built for kirana stores, distributors, and service businesses across India
          </p>
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
