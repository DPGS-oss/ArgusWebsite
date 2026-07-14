"use client";

import { Building2, Globe, Mail } from "lucide-react";
import { FormEvent, useState } from "react";

export function Contact() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") || "");

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      alert("Please enter a valid email address");
      return;
    }

    setSubmitted(true);
    form.reset();
    alert("Thank you for your message! We will get back to you soon.");
  }

  return (
    <section id="contact" className="py-20 md:py-28">
      <div className="container-page">
        <div className="section-header">
          <h2>Get in Touch</h2>
          <p>Have questions? We&apos;re here to help</p>
        </div>
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-6">
            {[
              {
                icon: Mail,
                title: "Email",
                value: "support@Argusinvoicing.com",
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
              <div key={title} className="flex gap-4">
                <div className="rounded-full bg-mercury-blue/15 p-3 text-mercury-blue">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-starlight">{title}</h4>
                  <p className="text-silver">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-lg border border-lead/20 bg-midnight p-6"
          >
            <input
              name="name"
              type="text"
              placeholder="Your Name"
              required
              className="w-full rounded-btn border border-lead/30 bg-graphite px-4 py-3 text-starlight outline-none focus:border-mercury-blue"
            />
            <input
              name="email"
              type="email"
              placeholder="Your Email"
              required
              className="w-full rounded-btn border border-lead/30 bg-graphite px-4 py-3 text-starlight outline-none focus:border-mercury-blue"
            />
            <input
              name="subject"
              type="text"
              placeholder="Subject"
              required
              className="w-full rounded-btn border border-lead/30 bg-graphite px-4 py-3 text-starlight outline-none focus:border-mercury-blue"
            />
            <textarea
              name="message"
              placeholder="Your Message"
              rows={5}
              required
              className="w-full rounded-2xl border border-lead/30 bg-graphite px-4 py-3 text-starlight outline-none focus:border-mercury-blue"
            />
            <button type="submit" className="btn-primary w-full">
              {submitted ? "Message Sent" : "Send Message"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
