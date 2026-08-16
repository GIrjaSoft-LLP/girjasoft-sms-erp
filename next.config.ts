import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [{ pathname: "/branding/**" }, { pathname: "/uploads/**" }],
  },
};

export default nextConfig;
