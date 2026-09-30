"use client";

import { Building2, Globe, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { Reveal, Stagger, StaggerItem } from "./Reveal";
import { AnimatedHeading } from "./AnimatedHeading";

export function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const subject = String(data.get("subject") || "").trim();
    const message = String(data.get("message") || "").trim();

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError("Please enter a valid email address");
      return;
    }

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Could not send message");
      }
      setSubmitted(true);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="contact" className="mb-24 border-y border-bone bg-mist py-24 md:mb-32 md:py-32">
      <div className="container-page">
        <Reveal>
          <div className="section-header">
            <span className="eyebrow">Contact</span>
            <AnimatedHeading text="Talk to a human" />
            <p>Questions about GST, pricing, or moving from another tool? We&apos;re here to help.</p>
          </div>
        </Reveal>
        <div className="grid gap-10 lg:grid-cols-2">
          <Stagger className="space-y-6" stagger={0.1}>
            {[
              {
                icon: Mail,
                title: "Email",
                value: "support@argusinvoicing.com",
                href: "mailto:support@argusinvoicing.com",
              },
              {
                icon: Globe,
                title: "Website",
                value: "argusinvoicing.com",
                href: "https://argusinvoicing.com",
              },
              {
                icon: Building2,
                title: "Company",
                value: "B&L Softwares and Logistics",
              },
            ].map(({ icon: Icon, title, value, href }: { icon: typeof Mail; title: string; value: string; href?: string }) => (
              <StaggerItem key={title} className="card flex items-center gap-4 p-5">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-violet/15 to-signal-blue/15 text-brand-violet">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">{title}</h3>
                  {href ? (
                    <a href={href} className="text-slate hover:text-brand-violet">{value}</a>
                  ) : (
                    <p className="text-slate">{value}</p>
                  )}
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal delay={0.2} y={50}>
            <form
              onSubmit={handleSubmit}
              className="space-y-4 rounded-card-lg border border-bone bg-white p-6 shadow-lift md:p-8"
            >
              <input
                name="name"
                type="text"
                placeholder="Your Name"
                aria-label="Your name"
                autoComplete="name"
                required
                className="input-field !py-3"
              />
              <input
                name="email"
                type="email"
                placeholder="Your Email"
                aria-label="Your email"
                autoComplete="email"
                required
                className="input-field !py-3"
              />
              <input
                name="subject"
                type="text"
                placeholder="Subject"
                aria-label="Subject"
                required
                className="input-field !py-3"
              />
              <textarea
                name="message"
                placeholder="Your Message"
                aria-label="Your message"
                rows={5}
                required
                className="input-field !py-3"
              />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {submitted ? (
                <p className="text-sm text-emerald-700">
                  Message sent — we&apos;ll reply to your email soon.
                </p>
              ) : null}
              <button type="submit" className="btn-primary w-full" disabled={sending}>
                {sending ? "Sending…" : submitted ? "Send another" : "Send Message"}
              </button>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
