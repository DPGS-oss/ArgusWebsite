import Image from "next/image";

export function Download() {
  return (
    <section id="download" className="py-20 md:py-28">
      <div className="container-page text-center">
        <h2 className="mb-4 text-4xl font-normal text-starlight md:text-5xl">
          Download Argus Today
        </h2>
        <p className="mb-10 text-lg text-silver">
          Available on Android. Coming soon to iOS and Web.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href="https://play.google.com/store/apps/details?id=com.getargus.billing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-lg border border-lead/20 bg-midnight px-6 py-4 transition hover:border-mercury-blue/40"
          >
            <Image src="/play-store.svg" alt="Google Play" width={40} height={40} />
            <div className="text-left">
              <span className="block text-xs text-silver">Get it on</span>
              <strong className="text-starlight">Google Play</strong>
            </div>
          </a>
          <div className="flex cursor-not-allowed items-center gap-4 rounded-lg border border-lead/10 bg-graphite/50 px-6 py-4 opacity-60">
            <Image src="/app-store.svg" alt="App Store" width={40} height={40} />
            <div className="text-left">
              <span className="block text-xs text-silver">Coming soon to</span>
              <strong className="text-starlight">App Store</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
