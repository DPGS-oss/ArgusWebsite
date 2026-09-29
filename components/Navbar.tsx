"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { getInitials, useAuth } from "@/lib/auth-provider";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
  { href: "/guide/", label: "Guide" },
  { href: "#contact", label: "Contact" },
];

/**
 * Floating header for the home page. Sits transparent over the dark hero and
 * turns into a light glass pill once the visitor scrolls past it.
 */
export function Navbar() {
  const { user, setShowAuthModal, setShowProfileModal } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const light = scrolled || mobileOpen;
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 md:px-6">
      <motion.div
        aria-hidden
        style={{ scaleX: progress }}
        className="fixed inset-x-0 top-0 h-[3px] origin-left bg-gradient-to-r from-brand-violet via-signal-blue to-mint"
      />
      <nav
        aria-label="Main"
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-full border px-3 py-2 transition-all duration-300 md:px-4 ${
          light
            ? "border-bone/80 bg-white/80 shadow-lift backdrop-blur-xl"
            : "border-white/10 bg-white/[0.04] backdrop-blur-md"
        }`}
      >
        <Link href="/" className="flex items-center gap-2 pl-1" aria-label="Argus home">
          <BrandLogo href={null} size={28} priority />
          <span className={`font-display text-base font-bold ${light ? "text-ink" : "text-white"}`}>
            Argus
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                light ? "text-slate hover:bg-mist hover:text-ink" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {!user ? (
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                light ? "text-ink hover:bg-mist" : "text-white/85 hover:bg-white/10 hover:text-white"
              }`}
            >
              Sign in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              aria-label="Open profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-violet to-signal-blue text-xs font-bold text-white"
            >
              {getInitials(user.name)}
            </button>
          )}
          <Link
            href="/app/"
            className={`group inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ${
              light ? "bg-ink text-white hover:bg-onyx" : "bg-white text-ink hover:bg-white/90"
            }`}
          >
            Launch web app
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </Link>
        </div>

        <button
          type="button"
          className={`rounded-full p-2 lg:hidden ${light ? "text-ink hover:bg-mist" : "text-white hover:bg-white/10"}`}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {mobileOpen ? (
        <div className="mx-auto mt-2 max-w-6xl rounded-card-lg border border-bone bg-white/95 p-3 shadow-lift backdrop-blur-xl lg:hidden">
          <div className="flex flex-col">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-medium text-ink hover:bg-mist"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="mt-2 grid gap-2 border-t border-bone pt-3">
            <Link href="/app/" onClick={() => setMobileOpen(false)} className="btn-primary w-full">
              Launch web app
            </Link>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                if (user) setShowProfileModal(true);
                else setShowAuthModal(true);
              }}
              className="btn-secondary w-full"
            >
              {user ? "Profile" : "Sign in"}
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
