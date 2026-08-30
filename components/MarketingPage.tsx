import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import { Footer } from "./Footer";

type MarketingPageProps = {
  children: React.ReactNode;
};

export function MarketingPage({ children }: MarketingPageProps) {
  return (
    <>
      <main className="min-h-screen bg-white pt-8 md:pt-12">
        <div className="container-page max-w-3xl pb-16">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <BrandLogo size={32} showWordmark />
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/app/" className="btn-primary !py-2">
                Start 14-day trial
              </Link>
            </div>
          </div>
          <article className="space-y-5 text-base leading-relaxed text-slate [&_a]:text-brand-violet [&_a]:underline [&_h1]:text-ink [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-ink [&_p]:text-slate">
            {children}
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}

export function PageCtas() {
  return (
    <p className="mt-8 flex flex-wrap gap-3">
      <Link href="/app/" className="btn-primary no-underline">
        Start 14-day trial
      </Link>
      <Link href="/#pricing" className="btn-secondary no-underline">
        See pricing
      </Link>
    </p>
  );
}
