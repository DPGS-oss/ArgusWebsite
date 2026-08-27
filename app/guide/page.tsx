import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Markdown } from "@/lib/render-markdown";

export const metadata: Metadata = {
  title: "User Guide | Argus GST Billing",
  description:
    "A plain-English guide to getting the most out of Argus, your GST billing and invoicing app.",
};

export default function GuidePage() {
  const source = readFileSync(join(process.cwd(), "content/user-guide.md"), "utf8");

  return (
    <main className="min-h-screen bg-white pt-24">
      <div className="container-page max-w-3xl pb-20">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2" aria-label="Argus home">
            <Image src="/logo.svg" alt="Argus" width={32} height={32} />
            <span className="font-bold text-ink">Argus</span>
          </Link>
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
  );
}
