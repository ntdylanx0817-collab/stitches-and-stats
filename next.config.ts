import type { NextConfig } from "next";

const developmentScriptPolicy = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Use the standard Next.js output. Vercel packages it automatically and
  // `next start` can run the same build locally or on a Node host.
  reactStrictMode: true,
  // Allow the preview sandbox origin to access the dev server.
  allowedDevOrigins: ["*.space-z.ai"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              // React's development diagnostics reconstruct call stacks with
              // eval(). Keep that permission out of production while allowing
              // the local Next overlay to work instead of reporting a CSP error.
              `script-src 'self' 'unsafe-inline'${developmentScriptPolicy}`,
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https://midfield.mlb.com",
              "connect-src 'self' ws: wss:",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
