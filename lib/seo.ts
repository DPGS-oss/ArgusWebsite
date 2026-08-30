import type { Metadata } from "next";

export const SITE_URL = "https://argusinvoicing.com";
export const SITE_NAME = "Argus GST Billing";
export const ORG_NAME = "B&L Softwares and Logistics";
export const SUPPORT_EMAIL = "support@argusinvoicing.com";
export const HINDI_LINE = "फोन पर बिल. CA के लिए किताबें.";

export const HOME_TITLE = "Argus | GST billing and books your CA can open";
export const HOME_DESCRIPTION =
  "GST invoices, khata, stock, and GSTR-1 / 2B / 3B summaries. Invite your CA for free. Start on Android, same login on web.";

type PageMetaOpts = {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
};

export function canonicalUrl(path: string): string {
  if (path === "/") return `${SITE_URL}/`;
  const normalized = path.endsWith("/") ? path : `${path}/`;
  return `${SITE_URL}${normalized}`;
}

export function pageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: PageMetaOpts): Metadata {
  const url = canonicalUrl(path);
  return {
    title,
    description,
    alternates: { canonical: path === "/" ? "/" : path.endsWith("/") ? path : `${path}/` },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "en_IN",
      type: "website",
      images: [
        {
          url: "/opengraph-image.png",
          width: 1200,
          height: 630,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image.png"],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}
