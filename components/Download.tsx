import Image from "next/image";
import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

export function Download() {
  return (
    <section id="download" className="py-20 md:py-28">
      <div className="container-page text-center">
        <Reveal>
          <h2 className="mb-4 text-4xl font-bold tracking-tightest text-ink md:text-5xl">
            Download Argus Today
          </h2>
          <p className="mb-10 text-lg text-slate">
            Available on Android and Web. Coming soon to iOS.
          </p>
        </Reveal>
        <Stagger className="flex flex-wrap items-center justify-center gap-4" stagger={0.12}>
          <StaggerItem>
            <a
              href="https://play.google.com/store/apps/details?id=com.getargus.billing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-card border border-bone bg-mist px-6 py-4 transition hover:border-brand-violet/30"
            >
              <Image src="/play-store.svg" alt="Google Play" width={40} height={40} />
              <div className="text-left">
                <span className="block text-xs text-slate">Get it on</span>
                <strong className="text-ink">Google Play</strong>
              </div>
            </a>
          </StaggerItem>
          <StaggerItem>
            <Link
              href="/app/"
              className="flex items-center gap-4 rounded-card border border-brand-violet/30 bg-mist px-6 py-4 transition hover:border-brand-violet"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-card bg-brand-violet/10">
                <svg className="h-5 w-5 text-brand-violet" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                </svg>
              </div>
              <div className="text-left">
                <span className="block text-xs text-slate">Launch the</span>
                <strong className="text-ink">Web App</strong>
              </div>
            </Link>
          </StaggerItem>
          <StaggerItem>
            <div className="flex cursor-not-allowed items-center gap-4 rounded-card border border-bone bg-plaster/50 px-6 py-4 opacity-60">
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
