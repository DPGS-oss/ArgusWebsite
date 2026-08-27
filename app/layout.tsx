import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-provider";
import { CanonicalHostRedirect } from "@/components/CanonicalHostRedirect";
import { LegalConsentGate } from "@/components/LegalConsentGate";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

const SITE_URL = "https://argusinvoicing.com";
const GOOGLE_SITE_VERIFICATION =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() || undefined;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Argus — Accounting & GST for Indian Shops",
    template: "%s | Argus",
  },
  description:
    "Books, billing, inventory, khata, and GST summaries for Indian SMEs. Start free on Android; unlock the full web suite from ₹500/month.",
  applicationName: "Argus",
  authors: [{ name: "B&L Softwares and Logistics" }],
  manifest: "/manifest.webmanifest",
  keywords: [
    "GST billing software India",
    "accounting app for shops",
    "GSTR-1 filing tool",
    "khata app",
    "inventory billing GST",
    "Argus invoicing",
  ],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/logo.png" }],
    shortcut: ["/logo.png"],
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: "Argus",
    title: "Argus — Accounting & GST for Indian Shops",
    description:
      "Books, billing, inventory, khata, and GST summaries for Indian SMEs. Free on Android; Business from ₹500/month.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Argus accounting and GST for Indian shops",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Argus — Accounting & GST for Indian Shops",
    description:
      "Books, billing, inventory, khata, and GST summaries for Indian SMEs. Free on Android; Business from ₹500/month.",
    images: ["/opengraph-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: GOOGLE_SITE_VERIFICATION
    ? { google: GOOGLE_SITE_VERIFICATION }
    : undefined,
  category: "business",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <CanonicalHostRedirect />
          <LegalConsentGate />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
