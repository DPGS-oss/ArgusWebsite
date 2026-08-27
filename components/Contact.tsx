"use client";

import { Building2, Globe, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { BrandLogo } from "./BrandLogo";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

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
    <section id="contact" className="py-20 md:py-28">
      <div className="container-page">
        <Reveal>
          <div className="section-header">
            <div className="mb-4 flex items-center justify-center gap-3">
              <BrandLogo href={null} size={32} />
              <h2 className="!mb-0">Contact us</h2>
            </div>
            <p>Have questions? We&apos;re here to help</p>
          </div>
        </Reveal>
        <div className="grid gap-10 lg:grid-cols-2">
          <Stagger className="space-y-6" stagger={0.1}>
            {[
              {
                icon: Mail,
                title: "Email",
                value: "support@argusinvoicing.com",
              },
              {
                icon: Globe,
                title: "Website",
                value: "https://argusinvoicing.com",
              },
              {
                icon: Building2,
                title: "Company",
                value: "B&L Softwares and Logistics",
              },
            ].map(({ icon: Icon, title, value }) => (
              <StaggerItem key={title} className="flex gap-4">
                <div className="rounded-full bg-brand-violet/10 p-3 text-brand-violet">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-ink">{title}</h4>
                  <p className="text-slate">{value}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal delay={0.2} y={50}>
            <form
              onSubmit={handleSubmit}
              className="space-y-4 rounded-card border border-bone bg-mist p-6"
            >
              <input
                name="name"
                type="text"
                placeholder="Your Name"
                required
                className="w-full rounded-input border border-bone bg-white px-4 py-3 text-ink outline-none focus:border-signal-blue"
              />
              <input
                name="email"
                type="email"
                placeholder="Your Email"
                required
                className="w-full rounded-input border border-bone bg-white px-4 py-3 text-ink outline-none focus:border-signal-blue"
              />
              <input
                name="subject"
                type="text"
                placeholder="Subject"
                required
                className="w-full rounded-input border border-bone bg-white px-4 py-3 text-ink outline-none focus:border-signal-blue"
              />
              <textarea
                name="message"
                placeholder="Your Message"
                rows={5}
                required
                className="w-full rounded-input border border-bone bg-white px-4 py-3 text-ink outline-none focus:border-signal-blue"
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
