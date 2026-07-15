import { Hero } from "@/components/Hero";
import { ProductShowcase } from "@/components/ProductShowcase";
import { Features } from "@/components/Features";
import { Pricing } from "@/components/Pricing";
import { About } from "@/components/About";
import { Download } from "@/components/Download";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";
import { AuthModal } from "@/components/AuthModal";
import { ProfileModal } from "@/components/ProfileModal";

export default function HomePage() {
  return (
    <>
      <main>
        <Hero />
        <ProductShowcase />
        <Features />
        <Pricing />
        <About />
        <Download />
        <Contact />
      </main>
      <Footer />
      <AuthModal />
      <ProfileModal />
    </>
  );
}
