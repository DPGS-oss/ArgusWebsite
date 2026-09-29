import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { CapabilityProof } from "@/components/CapabilityProof";
import { ProductShowcase } from "@/components/ProductShowcase";
import { WhatsAppInvoice } from "@/components/WhatsAppInvoice";
import { Features } from "@/components/Features";
import { Pricing } from "@/components/Pricing";
import { About } from "@/components/About";
import { Download } from "@/components/Download";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { CardSpotlight } from "@/components/CardSpotlight";
import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { AuthModal } from "@/components/AuthModal";
import { ProfileModal } from "@/components/ProfileModal";
import { HomeJsonLd } from "@/components/HomeJsonLd";
import { HOME_DESCRIPTION, HOME_TITLE, HINDI_LINE, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    path: "/",
  }),
  other: {
    "description:hi": HINDI_LINE,
  },
};

export default function HomePage() {
  return (
    <>
      <HomeJsonLd />
      <Navbar />
      <CardSpotlight />
      <main>
        <Hero />
        <CapabilityProof />
        <ProductShowcase />
        <WhatsAppInvoice />
        <Features />
        <Pricing />
        <Faq />
        <About />
        <Download />
        <Contact />
        <FinalCta />
      </main>
      <Footer />
      <AuthModal />
      <ProfileModal />
    </>
  );
}
