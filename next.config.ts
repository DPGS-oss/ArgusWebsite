import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

if (process.env.NODE_ENV === "development") {
  nextConfig.rewrites = async () => [
    {
      source: "/api/:path*",
      destination: "http://127.0.0.1:5001/argus-invocing/us-central1/api:path",
    },
  ];
}

export default nextConfig;
