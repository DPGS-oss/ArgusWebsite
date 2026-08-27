import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "User Guide | Argus GST Billing",
  description: "How to use Argus for GST invoicing, khata, inventory, and GSTR summaries.",
};

function parseGuide(raw: string) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks: { type: "h1" | "h2" | "h3" | "p" | "li" | "hr"; text: string }[] = [];

  for (const line of lines) {
    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
    } else if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
    } else if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
    } else if (line.trim() === "---") {
      blocks.push({ type: "hr", text: "" });
    } else if (line.startsWith("- ")) {
      blocks.push({ type: "li", text: line.slice(2).trim() });
    } else if (line.trim().length > 0) {
      blocks.push({ type: "p", text: line.trim() });
    }
  }
  return blocks;
}

// Read the guide content at build-time (module evaluation), not per-request,
// and resolve the path relative to this file (not `process.cwd()`).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const guidePath = path.join(__dirname, "../../content/USER_GUIDE.txt");
const guideRaw = fs.readFileSync(guidePath, "utf8");
const blocks = parseGuide(guideRaw);

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function GuidePage() {
  return (
    <>
      <main className="min-h-screen bg-white pt-24">
        <div className="container-page max-w-3xl pb-20">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <BrandLogo size={32} />
            <div className="flex gap-3 text-sm">
              <a
                href="/Argus_User_Guide.pdf"
                className="rounded-full border border-bone px-4 py-2 text-slate hover:border-brand-violet hover:text-ink"
              >
                Download PDF
              </a>
              <Link href="/app/" className="btn-primary !py-2">
                Launch Web App
              </Link>
            </div>
          </div>

          <article className="prose-argus space-y-4">
            {blocks.map((block, i) => {
              if (block.type === "h1") {
                return (
                  <h1 key={i} className="text-4xl font-bold tracking-tight text-ink">
                    {block.text}
                  </h1>
                );
              }
              if (block.type === "h2") {
                return (
                  <h2
                    key={i}
                    id={block.text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
                    className="mt-10 scroll-mt-24 text-2xl font-bold text-ink"
                  >
                    {block.text}
                  </h2>
                );
              }
              if (block.type === "h3") {
                return (
                  <h3 key={i} className="mt-6 text-lg font-semibold text-ink">
                    {block.text}
                  </h3>
                );
              }
              if (block.type === "hr") {
                return <hr key={i} className="my-8 border-bone" />;
              }
              if (block.type === "li") {
                return (
                  <li key={i} className="ml-5 list-disc text-slate">
                    {renderInline(block.text)}
                  </li>
                );
              }
              return (
                <p key={i} className="leading-relaxed text-slate">
                  {renderInline(block.text)}
                </p>
              );
            })}
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
