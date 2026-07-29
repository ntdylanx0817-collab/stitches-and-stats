import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel and most modern hosts handle output automatically.
  // Use "standalone" only for Docker/VPS deployments where you run `next start`
  // from a minimal Node server. Set to "standalone" if deploying to a container.
  output: "standalone",
  reactStrictMode: true,
  // Allow the preview sandbox origin to access the dev server.
  allowedDevOrigins: ["*.space-z.ai"],
};

export default nextConfig;
