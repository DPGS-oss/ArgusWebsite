"use client";

import { useEffect, useRef, useState } from "react";

function formatNumber(num: number) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M+`;
  if (num >= 1_000) return `${Math.round(num / 1_000)}K+`;
  return num.toString();
}

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [countsStarted, setCountsStarted] = useState(false);
  const [businesses, setBusinesses] = useState(0);
  const [invoices, setInvoices] = useState(0);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setCountsStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!countsStarted) return;

    const targets = [
      { value: 10000, setter: setBusinesses },
      { value: 1_000_000, setter: setInvoices },
    ];

    const duration = 2000;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      targets.forEach(({ value, setter }) => {
        setter(Math.floor(value * progress));
      });
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [countsStarted]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-mercury-blue/20 via-transparent to-mercury-ghost/10" />
      <div className="container-page relative grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h1 className="mb-6 text-5xl font-light leading-tight tracking-tight md:text-6xl">
            GST Billing Made <span className="gradient-text">Simple</span>
          </h1>
          <p className="mb-8 max-w-xl text-lg text-silver">
            Create professional GST invoices in seconds. Works offline, syncs securely.
            The only billing app your business needs.
          </p>
          <div className="mb-10 flex flex-wrap gap-4">
            <a href="#download" className="btn-primary btn-lg rounded-btn-lg px-8 py-4">
              Download Now
            </a>
            <a href="#features" className="btn-secondary rounded-btn-lg px-8 py-4">
              Learn More
            </a>
          </div>
          <div className="flex flex-wrap gap-8">
            <div>
              <div className="text-2xl font-medium text-starlight">
                {formatNumber(businesses)}
              </div>
              <div className="text-sm text-silver">Businesses</div>
            </div>
            <div>
              <div className="text-2xl font-medium text-starlight">
                {formatNumber(invoices)}
              </div>
              <div className="text-sm text-silver">Invoices</div>
            </div>
            <div>
              <div className="text-2xl font-medium text-starlight">4.8★</div>
              <div className="text-sm text-silver">Rating</div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="rounded-[2rem] border border-lead/30 bg-midnight p-4 shadow-2xl shadow-black/40">
            <div className="rounded-[1.5rem] bg-graphite p-6">
              <div className="mb-4 rounded-lg border border-lead/20 bg-abyss p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-silver">#INV-001</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300">
                    Paid
                  </span>
                </div>
                <div className="text-3xl font-medium text-starlight">₹5,990.00</div>
                <div className="text-sm text-silver">Acme Corporation</div>
              </div>
              <div className="rounded-lg border border-lead/20 bg-abyss p-4">
                <div className="text-sm text-silver">Total Sales</div>
                <div className="text-2xl font-medium text-starlight">₹1,24,500</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
