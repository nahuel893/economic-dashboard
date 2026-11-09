import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server be opened from other devices (LAN and Tailscale).
  allowedDevOrigins: ["192.168.1.4", "100.96.147.87"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
