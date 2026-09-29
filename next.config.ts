import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

if (process.env.NODE_ENV === "development") {
  // Mirror Firebase Hosting's /api rewrites onto the Functions emulator, one route per
  // function, so `next dev` hits the same function names production does.
  const emulator = "http://127.0.0.1:5001/argus-invocing/us-central1";
  const firebase = JSON.parse(readFileSync("firebase.json", "utf8"));
  const site = (Array.isArray(firebase.hosting) ? firebase.hosting : [firebase.hosting]).find(
    (h: { site?: string }) => h.site === "argus-invocing"
  );
  const rewrites: { source: string; function?: string }[] = site?.rewrites ?? [];

  nextConfig.rewrites = async () =>
    rewrites
      .filter((r) => r.function && r.source.startsWith("/api/"))
      .map((r) => {
        const source = r.source.endsWith("/**") ? `${r.source.slice(0, -3)}/:path*` : r.source;
        return { source, destination: `${emulator}/${r.function}${source}` };
      });
}

export default nextConfig;
