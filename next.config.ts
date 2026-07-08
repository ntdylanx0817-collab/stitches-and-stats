import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Suppress hydration warnings caused by browser extensions (Grammarly, etc.)
  // that inject attributes like data-gr-ext-installed, data-new-gr-c-s-check-loaded
  // onto <body> before React hydrates. These are cosmetic mismatches, not real bugs.
  // Also suppresses font-variable className mismatches from next/font.
  compiler: {
    reactRemoveProperties: false,
  },
};

export default nextConfig;
