import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large file uploads (20 MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
