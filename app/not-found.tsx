import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Page not found",
  description: "This page does not exist on Argus GST Billing.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <main className="flex min-h-screen flex-col bg-white">
        <div className="container-page flex flex-1 flex-col items-center justify-center py-24 text-center">
          <div className="mb-10">
            <BrandLogo size={32} priority />
          </div>
          <p className="gradient-text text-7xl font-bold tracking-tightest md:text-8xl">
            404
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink md:text-4xl">
            Page not found
          </h1>
          <p className="mt-4 max-w-md text-lg text-slate">
            This link is missing or out of date. Head home, open the web app, or
            check the user guide.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className="btn-primary">
              Back to home
            </Link>
            <Link href="/app/" className="btn-secondary">
              Launch Web App
            </Link>
            <Link href="/guide/" className="btn-outline">
              User Guide
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
