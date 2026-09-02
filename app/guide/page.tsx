import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { Footer } from "@/components/Footer";
import { Markdown } from "@/lib/render-markdown";

export const metadata: Metadata = {
  title: "User Guide | Argus GST Billing",
  description:
    "A plain-English guide to getting the most out of Argus, your GST billing and invoicing app.",
};

export default function GuidePage() {
  const source = readFileSync(join(process.cwd(), "content/user-guide.md"), "utf8");

  return (
    <>
      <main className="min-h-screen bg-white pt-24">
        <div className="container-page max-w-3xl pb-20">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <BrandLogo size={32} />
            <div className="flex gap-3 text-sm">
              <Link href="/app/" className="btn-primary !py-2">
                Launch Web App
              </Link>
            </div>
          </div>
          <article className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-ink">Argus User Guide</h1>
            <Markdown source={source} />
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
