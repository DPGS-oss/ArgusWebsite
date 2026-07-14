import Link from "next/link";

type LegalLayoutProps = {
  title: string;
  children: React.ReactNode;
};

export function LegalLayout({ title, children }: LegalLayoutProps) {
  return (
    <main className="container-page py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-4xl font-normal text-starlight">{title}</h1>
        <div className="space-y-4 text-silver [&_a]:text-mercury-blue [&_a]:underline">
          {children}
        </div>
        <p className="mt-10">
          <Link href="/" className="text-mercury-blue hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
