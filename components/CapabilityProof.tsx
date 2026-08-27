"use client";

import { BookOpen, FileSpreadsheet, Smartphone, Users } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

const proofs = [
  {
    icon: BookOpen,
    title: "Full books, not just bills",
    text: "Sales, purchases, stock, khata, and GST summaries in one workspace.",
  },
  {
    icon: FileSpreadsheet,
    title: "GST-ready every day",
    text: "Invoice once — GSTR-1, 2B, and 3B style summaries stay ready for your portal filing.",
  },
  {
    icon: Users,
    title: "CA portal included",
    text: "Invite your accountant with a free read-only link. No extra seats.",
  },
  {
    icon: Smartphone,
    title: "Phone + web, same login",
    text: "Start free on Android (5 invoices). Unlock the full suite on web when you grow.",
  },
];

export function CapabilityProof() {
  return (
    <section className="border-y border-bone bg-mist py-14 md:py-16">
      <div className="container-page">
        <Reveal>
          <div className="mb-10 text-center">
            <p className="mb-2 text-xs font-semibold tracking-widest text-brand-violet uppercase">
              Built for Indian shops
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
              Accounting that matches how you actually work
            </h2>
          </div>
        </Reveal>
        <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
          {proofs.map(({ icon: Icon, title, text }) => (
            <StaggerItem key={title} className="rounded-card border border-bone bg-white p-5">
              <div className="mb-3 inline-flex rounded-full bg-brand-violet/10 p-2.5 text-brand-violet">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 text-base font-bold text-ink">{title}</h3>
              <p className="text-sm leading-relaxed text-slate">{text}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
