"use client";

import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { ShinyText } from "./ShinyText";
import { getInitials, useAuth } from "@/lib/auth-provider";

const navLinks = [
  { label: "Home", href: "#" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "#about" },
  { label: "Download", href: "#download" },
  { label: "Contact us", href: "#contact" },
];

export function Hero() {
  const { user, setShowAuthModal, setShowProfileModal } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <section className="relative h-screen w-full overflow-hidden bg-black">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_105406_16f4600d-7a92-4292-b96e-b19156c7830a.mp4"
          type="video/mp4"
        />
      </video>

      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 flex h-full flex-col">
        <nav className="w-full px-4 py-4 md:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <BrandLogo size={32} priority />

            <div className="hidden items-center gap-1 rounded-full border border-gray-700 px-2 py-1.5 lg:flex">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-white/80 transition hover:text-white"
                >
                  {link.label}
                  {link.label === "Contact us" && (
                    <ArrowRight className="h-3.5 w-3.5" />
                  )}
                </a>
              ))}
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <a
                href="/app/"
                className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Launch Web App
              </a>
              {!user ? (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="rounded-full border border-white/30 px-4 py-1.5 text-sm text-white/80 transition hover:border-white hover:text-white"
                >
                  Sign In
                </button>
              ) : (
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-black"
                >
                  {getInitials(user.name)}
                </button>
              )}
            </div>

            <button
              type="button"
              className="text-white/80 transition hover:text-white lg:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {mobileOpen ? (
            <div className="mt-3 rounded-card border border-white/15 bg-black/80 p-4 backdrop-blur lg:hidden">
              <div className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={closeMobile}
                    className="rounded-full px-3 py-2.5 text-sm text-white/90 hover:bg-white/10"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3">
                <a
                  href="/app/"
                  onClick={closeMobile}
                  className="rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-black"
                >
                  Launch Web App
                </a>
                {!user ? (
                  <button
                    type="button"
                    onClick={() => {
                      closeMobile();
                      setShowAuthModal(true);
                    }}
                    className="rounded-full border border-white/30 px-4 py-2.5 text-sm text-white"
                  >
                    Sign In
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      closeMobile();
                      setShowProfileModal(true);
                    }}
                    className="rounded-full border border-white/30 px-4 py-2.5 text-sm text-white"
                  >
                    Profile
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </nav>

        <div className="mx-auto w-full max-w-7xl px-4 pt-6 md:px-6">
          <p className="max-w-2xl text-sm text-white/80 md:text-base">
            Books, GST, inventory, and collections for Indian businesses —
            one login on phone and web.
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <p className="mb-6 text-xs tracking-tight text-white/80 sm:text-sm">
            COMPLETE ACCOUNTING FOR INDIAN SHOPS
          </p>

          <h1 className="text-5xl font-medium leading-[0.85] tracking-tighter text-white md:text-7xl xl:text-8xl">
            Accounting
            <br />
            <ShinyText
              text="Made Clear."
              baseColor="#64CEFB"
              shineColor="#ffffff"
              duration={3}
              className="font-medium"
            />
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-sm text-white/75 md:text-base">
            Bill customers, track stock and dues, prepare GST summaries, and share
            books with your CA — without juggling five tools. Web app works best
            in Chrome or Edge.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/app/"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90 md:px-8 md:py-4 md:text-base"
            >
              Start free trial
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </a>
            <a
              href="#download"
              className="group inline-flex items-center gap-2 rounded-full border border-white/40 bg-black/40 px-6 py-3 text-sm text-white transition hover:border-white hover:bg-black/60 md:px-8 md:py-4 md:text-base"
            >
              Download App
            </a>
          </div>
          <p className="mt-4 text-xs text-white/60">
            14-day Business trial on web · Free tier on Android (5 invoices/month)
          </p>
        </div>
      </div>
    </section>
  );
}
