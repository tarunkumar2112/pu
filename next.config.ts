import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.prod.website-files.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    turbopackUseSystemTlsCerts: true,
    serverComponentsExternalPackages: ['node-cron'],
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), 'node-cron'];
    return config;
  },
};

export default nextConfig;
