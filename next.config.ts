import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // reactCompiler disabled: the Babel-based react-compiler loader under Turbopack
  // (Next 16) makes `next build` hang for many minutes in the compile phase, which
  // was the cause of the production build failures / crash loop. It is a build-time
  // auto-memoization optimization only; disabling it does not change app behavior.
  reactCompiler: false,
  distDir: process.env.PORT === "4000" ? ".next-api" : ".next",
  outputFileTracingRoot: process.cwd(),
  images: {
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // matching all API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" }, // In production, replace * with specific origins
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ]
  }
};

export default nextConfig;
