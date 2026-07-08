import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // Static export needs trailingSlash for file-based routing
  trailingSlash: true,
};

export default nextConfig;
