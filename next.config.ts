import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // TODO: remove after route handler params are updated for Next.js 16
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    localPatterns: [{ pathname: "/branding/**" }, { pathname: "/uploads/**" }],
  },
};

export default nextConfig;
