import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.namu.la",
      },
      {
        protocol: "https",
        hostname: "img.eomisae.co.kr",
      },
      {
        protocol: "https",
        hostname: "**.coupangcdn.com",
      },
    ],
  },
};

export default nextConfig;
