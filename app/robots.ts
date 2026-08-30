import type { MetadataRoute } from "next";

const SITE_URL = "https://argusinvoicing.com";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/app/",
          "/scan/",
          "/api/",
          "/admin/",
          "/ca/portal/",
          "/ca/redeem/",
        ],
      },
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`],
    host: SITE_URL,
  };
}
