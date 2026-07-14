import { ShieldCheck, Target, Zap } from "lucide-react";

export function About() {
  return (
    <section id="about" className="py-20 md:py-28">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 className="mb-6 text-4xl font-normal text-starlight md:text-5xl">
            About B&amp;L Softwares and Logistics
          </h2>
          <p className="mb-4 text-silver">
            We&apos;re a technology company focused on building simple, powerful tools for
            Indian businesses. Our mission is to make GST compliance easy and affordable
            for everyone.
          </p>
          <p className="mb-8 text-silver">
            Founded with the belief that business software should be accessible to all,
            we&apos;ve built Argus to address the real pain points of Indian shopkeepers,
            retailers, and small business owners.
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { icon: Target, title: "Simplicity First", text: "No accounting knowledge needed" },
              { icon: ShieldCheck, title: "Privacy Focused", text: "Your data stays yours" },
              { icon: Zap, title: "Reliable", text: "Works when you need it" },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <Icon className="mb-2 h-6 w-6 text-mercury-blue" />
                <h4 className="mb-1 text-starlight">{title}</h4>
                <p className="text-sm text-silver">{text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-lead/20 bg-midnight">
          <div className="text-center">
            <div className="mb-2 text-5xl">👥</div>
            <p className="text-silver">Our Team</p>
          </div>
        </div>
      </div>
    </section>
  );
}
