import {
  HOME_DESCRIPTION,
  ORG_NAME,
  SITE_NAME,
  SITE_URL,
  SUPPORT_EMAIL,
} from "@/lib/seo";
import { HOME_FAQ } from "@/lib/faq";

export function HomeJsonLd() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: ORG_NAME,
        url: SITE_URL,
        email: SUPPORT_EMAIL,
        logo: `${SITE_URL}/logo.png`,
      },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Android",
        description: HOME_DESCRIPTION,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "INR",
        },
        publisher: {
          "@type": "Organization",
          name: ORG_NAME,
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: HOME_FAQ.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
