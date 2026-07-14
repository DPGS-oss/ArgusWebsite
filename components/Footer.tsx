import Image from "next/image";
import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-lead/20 bg-midnight py-12">
      <div className="container-page">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Image src="/logo.svg" alt="Argus Logo" width={40} height={40} className="mb-4" />
            <p className="text-sm text-silver">
              GST billing made simple for Indian businesses.
            </p>
          </div>
          <div>
            <h4 className="mb-4 text-starlight">Product</h4>
            <div className="flex flex-col gap-2 text-sm text-silver">
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#download">Download</a>
            </div>
          </div>
          <div>
            <h4 className="mb-4 text-starlight">Company</h4>
            <div className="flex flex-col gap-2 text-sm text-silver">
              <a href="#about">About Us</a>
              <a href="#contact">Contact</a>
              <Link href="/privacy/">Privacy Policy</Link>
              <Link href="/terms/">Terms of Service</Link>
            </div>
          </div>
          <div>
            <h4 className="mb-4 text-starlight">Legal</h4>
            <div className="flex flex-col gap-2 text-sm text-silver">
              <Link href="/privacy/">Privacy Policy</Link>
              <Link href="/terms/">Terms of Service</Link>
              <Link href="/refund/">Refund Policy</Link>
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-lead/20 pt-6 text-center text-sm text-silver">
          © {year} B&amp;L Softwares and Logistics. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
