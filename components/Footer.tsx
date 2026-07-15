import Image from "next/image";
import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-bone bg-mist py-12">
      <div className="container-page">
        <Stagger className="grid gap-10 md:grid-cols-2 lg:grid-cols-4" stagger={0.1}>
          <StaggerItem>
            <Image src="/logo.svg" alt="Argus Logo" width={40} height={40} className="mb-4" />
            <p className="text-sm text-slate">
              GST billing made simple for Indian businesses.
            </p>
          </StaggerItem>
          <StaggerItem>
            <h4 className="mb-4 font-bold text-ink">Product</h4>
            <div className="flex flex-col gap-2 text-sm text-slate">
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#download">Download</a>
            </div>
          </StaggerItem>
          <StaggerItem>
            <h4 className="mb-4 font-bold text-ink">Company</h4>
            <div className="flex flex-col gap-2 text-sm text-slate">
              <a href="#about">About Us</a>
              <a href="#contact">Contact</a>
              <Link href="/privacy/">Privacy Policy</Link>
              <Link href="/terms/">Terms of Service</Link>
            </div>
          </StaggerItem>
          <StaggerItem>
            <h4 className="mb-4 font-bold text-ink">Legal</h4>
            <div className="flex flex-col gap-2 text-sm text-slate">
              <Link href="/privacy/">Privacy Policy</Link>
              <Link href="/terms/">Terms of Service</Link>
              <Link href="/refund/">Refund Policy</Link>
              <Link href="/delete-account">Request Data Deletion</Link>
            </div>
          </StaggerItem>
        </Stagger>
        <Reveal delay={0.3}>
          <div className="mt-10 border-t border-bone pt-6 text-center text-sm text-slate">
            © {year} B&amp;L Softwares and Logistics. All rights reserved.
          </div>
        </Reveal>
      </div>
    </footer>
  );
}
