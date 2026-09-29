import Image from "next/image";
import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "./Reveal";
import { AnimatedHeading } from "./AnimatedHeading";

export function Download() {
  return (
    <section id="download" className="bg-white py-24 md:py-32">
      <div className="container-page text-center">
        <Reveal>
          <span className="eyebrow">Get Argus</span>
          <AnimatedHeading className="mb-4 text-4xl font-bold tracking-tightest text-ink md:text-5xl" text="Start on the web today" />
          <p className="mx-auto mb-10 max-w-2xl text-lg text-slate">
            The web app is live now and works best in Chrome or Edge on desktop. The Android app
            (free, unlimited invoices) and iOS are coming soon — same login everywhere.
          </p>
        </Reveal>
        <Stagger className="flex flex-wrap items-center justify-center gap-4" stagger={0.12}>
          <StaggerItem>
            <div
              className="flex cursor-not-allowed items-center gap-4 rounded-card-lg border border-dashed border-cloud bg-white/60 px-6 py-4 opacity-70"
              aria-disabled="true"
            >
              <Image src="/play-store.svg" alt="Google Play" width={40} height={40} />
              <div className="text-left">
                <span className="block text-xs text-slate">Coming soon to</span>
                <strong className="text-ink">Google Play</strong>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <Link
              href="/app/"
              className="flex items-center gap-4 rounded-card-lg border border-brand-violet/30 bg-white px-6 py-4 shadow-lift transition hover:-translate-y-0.5 hover:border-brand-violet"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-card bg-brand-violet/10">
                <svg className="h-5 w-5 text-brand-violet" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                </svg>
              </div>
              <div className="text-left">
                <span className="block text-xs text-slate">Best on Chrome / Edge</span>
                <strong className="text-ink">Web App</strong>
              </div>
            </Link>
          </StaggerItem>
          <StaggerItem>
            <div className="flex cursor-not-allowed items-center gap-4 rounded-card-lg border border-dashed border-cloud bg-white/60 px-6 py-4 opacity-70">
              <Image src="/app-store.svg" alt="App Store" width={40} height={40} />
              <div className="text-left">
                <span className="block text-xs text-slate">Coming soon to</span>
                <strong className="text-ink">App Store</strong>
              </div>
            </div>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  );
}
