"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { getInitials, useAuth } from "@/lib/auth-provider";

const navLinks = [
  { href: "/#features", label: "Features", hi: "सुविधाएँ" },
  { href: "/gstr/", label: "GST 2.0", hi: "GST 2.0" },
  { href: "/#pricing", label: "Pricing", hi: "क़ीमत" },
  { href: "/#faq", label: "FAQ", hi: "सवाल" },
  { href: "/#about", label: "Company", hi: "कंपनी" },
];

/**
 * Header for the home page. Transparent over the light hero, then a white
 * glass bar once the visitor scrolls.
 */
export function Navbar() {
  const { user, setShowAuthModal, setShowProfileModal } = useAuth();
  const hindi = (usePathname() || "").startsWith("/hi");
  const langLink = hindi ? { href: "/", label: "English", lang: "en" } : { href: "/hi/", label: "हिंदी", lang: "hi" };
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || mobileOpen;
  const light = true;
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
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl border px-3 py-2 transition-all duration-300 md:px-4 ${
          solid
            ? "border-bone/80 bg-white/85 shadow-lift backdrop-blur-xl"
            : "border-transparent bg-transparent"
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
              {hindi ? link.hi : link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href={langLink.href}
            lang={langLink.lang}
            className="rounded-full px-3 py-2 text-sm font-semibold text-slate hover:bg-mist hover:text-ink"
          >
            {langLink.label}
          </Link>
          {!user ? (
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                light ? "text-ink hover:bg-mist" : "text-white/85 hover:bg-white/10 hover:text-white"
              }`}
            >
              {hindi ? "लॉग इन" : "Log in"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              aria-label="Open profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-xs font-bold text-white"
            >
              {getInitials(user.name)}
            </button>
          )}
          <Link href="/app/" className="btn-primary group px-5 py-2.5">
            {hindi ? "मुफ़्त शुरू करें" : "Start free trial"}
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
                {hindi ? link.hi : link.label}
              </a>
            ))}
          </div>
          <Link
            href={langLink.href}
            lang={langLink.lang}
            onClick={() => setMobileOpen(false)}
            className="block rounded-xl px-3 py-3 text-sm font-semibold text-ink hover:bg-mist"
          >
            {langLink.label}
          </Link>
          <div className="mt-2 grid gap-2 border-t border-bone pt-3">
            <Link href="/app/" onClick={() => setMobileOpen(false)} className="btn-primary w-full">
              Start free trial
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
