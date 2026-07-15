"use client";

import { ArrowRight, Menu } from "lucide-react";
import { ShinyText } from "./ShinyText";
import { getInitials, useAuth } from "@/lib/auth-provider";

const navLinks = [
  { label: "Home", href: "#" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "#about" },
  { label: "Download", href: "#download" },
  { label: "Contact", href: "#contact" },
];

export function Hero() {
  const { user, setShowAuthModal, setShowProfileModal } = useAuth();

  return (
    <section className="relative h-screen w-full overflow-hidden bg-black">
      {/* Video Background */}
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

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Navigation Bar */}
        <nav className="w-full px-4 py-4 md:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white">
                <div className="h-3 w-3 rounded-full bg-white" />
              </div>
              <span className="text-lg font-semibold text-white">Argus</span>
            </div>

            {/* Desktop Nav Links */}
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

            {/* Auth buttons */}
            <div className="hidden items-center gap-3 lg:flex">
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

            {/* Mobile Hamburger */}
            <button
              className="text-white/80 transition hover:text-white lg:hidden"
              aria-label="Toggle menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </nav>

        {/* Top Section - Two columns */}
        <div className="mx-auto w-full max-w-7xl px-4 pt-6 md:px-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <p className="text-sm text-white/80 md:text-base">
              GST billing made simple for Indian businesses. Create professional
              invoices, manage inventory, and file GSTR reports — all in one place.
            </p>
            <p className="text-sm text-white/80 lg:text-right md:text-base">
              10,000+ Businesses. 1M+ Invoices Generated.
            </p>
          </div>
        </div>

        {/* Hero Center Content */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <p className="mb-6 text-xs tracking-tight text-white/80 sm:text-sm">
            GST COMPLIANT BILLING FOR MODERN INDIA
          </p>

          <h1 className="text-5xl font-medium leading-[0.85] tracking-tighter text-white md:text-7xl xl:text-9xl">
            Billing
            <br />
            <ShinyText
              text="Made Simple."
              baseColor="#64CEFB"
              shineColor="#ffffff"
              duration={3}
              className="font-medium"
            />
          </h1>

          {/* CTA Button */}
          <a
            href="#pricing"
            className="group mt-10 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm text-white transition hover:bg-gray-900 md:px-8 md:py-4 md:text-base"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </section>
  );
}
