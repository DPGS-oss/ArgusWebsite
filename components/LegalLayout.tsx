import Link from "next/link";
import { BrandLogo } from "./BrandLogo";

type LegalLayoutProps = {
  title: string;
  children: React.ReactNode;
};

export function LegalLayout({ title, children }: LegalLayoutProps) {
  return (
    <main className="container-page py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <BrandLogo size={32} />
        </div>
        <h1 className="mb-8 text-4xl font-bold tracking-tight text-ink">{title}</h1>
        <div className="space-y-4 text-slate [&_a]:text-brand-violet [&_a]:underline [&_h2]:text-ink">
          {children}
        </div>
        <p className="mt-10">
          <Link href="/" className="text-brand-violet hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
