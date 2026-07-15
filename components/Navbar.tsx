"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getInitials, useAuth } from "@/lib/auth-provider";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact" },
];

export function Navbar() {
  const { user, setShowAuthModal, setShowProfileModal } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 border-b transition ${
        scrolled
          ? "border-bone bg-white/95 shadow-subtle backdrop-blur"
          : "border-transparent bg-white/80 backdrop-blur"
      }`}
    >
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.svg" alt="Argus Logo" width={36} height={36} />
          <span className="text-lg font-bold text-ink">Argus</span>
        </Link>

        <div
          className={`absolute left-0 right-0 top-16 flex flex-col gap-4 border-b border-bone bg-white p-4 md:static md:flex md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0 ${
            mobileOpen ? "flex" : "hidden md:flex"
          }`}
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-slate transition hover:text-ink"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          {!user ? (
            <button className="btn-secondary !py-2" onClick={() => setShowAuthModal(true)}>
              Sign In
            </button>
          ) : (
            <button
              className="btn-primary !min-w-[3rem] !py-2"
              onClick={() => setShowProfileModal(true)}
            >
              {getInitials(user.name)}
            </button>
          )}
          <a href="#download" className="btn-secondary !py-2">
            Download App
          </a>
          <Link href="/app/" className="btn-primary !py-2">
            Open Web App
          </Link>
        </div>

        <button
          className="flex flex-col gap-1.5 md:hidden"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span className="block h-0.5 w-6 bg-ink" />
          <span className="block h-0.5 w-6 bg-ink" />
          <span className="block h-0.5 w-6 bg-ink" />
        </button>
      </div>
    </nav>
  );
}
