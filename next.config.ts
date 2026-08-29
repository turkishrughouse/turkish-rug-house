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
  // The editorial content for these topics now lives as BlogPost articles under
  // /blog/*. The old Page records are unpublished, so without these the historical
  // URLs would 404. 301 preserves any link equity and keeps one canonical URL per topic.
  async redirects() {
    return [
      { source: "/how-to-choose-the-right-rug-size-for-your-space", destination: "/blog/how-to-choose-rug-size", statusCode: 301 },
      { source: "/info/how-to-choose-the-right-rug-size-for-your-space", destination: "/blog/how-to-choose-rug-size", statusCode: 301 },
      { source: "/how-to-style-a-vintage-rug-in-modern-interiors", destination: "/blog/how-to-style-a-vintage-rug", statusCode: 301 },
      { source: "/info/how-to-style-a-vintage-rug-in-modern-interiors", destination: "/blog/how-to-style-a-vintage-rug", statusCode: 301 },
      { source: "/how-to-identify-a-hand-knotted-rug", destination: "/blog/how-to-identify-a-hand-knotted-rug", statusCode: 301 },
      { source: "/info/how-to-identify-a-hand-knotted-rug", destination: "/blog/how-to-identify-a-hand-knotted-rug", statusCode: 301 },
      { source: "/how-to-tell-if-a-rug-is-truly-handmade", destination: "/blog/how-to-identify-a-hand-knotted-rug", statusCode: 301 },
      { source: "/info/how-to-tell-if-a-rug-is-truly-handmade", destination: "/blog/how-to-identify-a-hand-knotted-rug", statusCode: 301 },
      { source: "/how-to-care-for-a-handmade-wool-rug", destination: "/info/rug-care", statusCode: 301 },
      { source: "/info/how-to-care-for-a-handmade-wool-rug", destination: "/info/rug-care", statusCode: 301 },
      { source: "/using-rugs-to-define-open-living-spaces", destination: "/blog/rugs-open-living-spaces", statusCode: 301 },
      { source: "/info/using-rugs-to-define-open-living-spaces", destination: "/blog/rugs-open-living-spaces", statusCode: 301 },
      { source: "/using-vintage-rugs-in-minimalist-homes", destination: "/blog/vintage-rugs-minimalist-interiors", statusCode: 301 },
      { source: "/info/using-vintage-rugs-in-minimalist-homes", destination: "/blog/vintage-rugs-minimalist-interiors", statusCode: 301 },
      { source: "/using-colorful-rugs-without-overwhelming-a-room", destination: "/blog/colorful-rugs-interior-design", statusCode: 301 },
      { source: "/info/using-colorful-rugs-without-overwhelming-a-room", destination: "/blog/colorful-rugs-interior-design", statusCode: 301 },
      { source: "/using-small-rugs-for-layered-interiors", destination: "/blog/layering-rugs-small-spaces", statusCode: 301 },
      { source: "/info/using-small-rugs-for-layered-interiors", destination: "/blog/layering-rugs-small-spaces", statusCode: 301 },
      { source: "/using-antique-rugs-as-statement-pieces", destination: "/blog/statement-rugs", statusCode: 301 },
      { source: "/info/using-antique-rugs-as-statement-pieces", destination: "/blog/statement-rugs", statusCode: 301 },
      { source: "/what-is-an-oushak-rug", destination: "/blog/what-is-an-oushak-rug", statusCode: 301 },
      { source: "/info/what-is-an-oushak-rug", destination: "/blog/what-is-an-oushak-rug", statusCode: 301 },
      { source: "/what-is-the-difference-between-kilim-and-carpet", destination: "/blog/kilim-vs-carpet", statusCode: 301 },
      { source: "/info/what-is-the-difference-between-kilim-and-carpet", destination: "/blog/kilim-vs-carpet", statusCode: 301 },
      { source: "/what-is-hand-knotted-vs-machine-made-rug", destination: "/blog/hand-knotted-vs-machine-made-rugs", statusCode: 301 },
      { source: "/info/what-is-hand-knotted-vs-machine-made-rug", destination: "/blog/hand-knotted-vs-machine-made-rugs", statusCode: 301 },
      { source: "/what-is-vegetable-dye-in-rugs", destination: "/blog/what-is-vegetable-dye", statusCode: 301 },
      { source: "/info/what-is-vegetable-dye-in-rugs", destination: "/blog/what-is-vegetable-dye", statusCode: 301 },
      { source: "/what-makes-anatolian-rugs-unique", destination: "/blog/what-makes-anatolian-rugs-unique", statusCode: 301 },
      { source: "/info/what-makes-anatolian-rugs-unique", destination: "/blog/what-makes-anatolian-rugs-unique", statusCode: 301 },
      { source: "/how", destination: "/blog", statusCode: 301 },
      { source: "/info/how", destination: "/blog", statusCode: 301 },
      { source: "/using", destination: "/blog", statusCode: 301 },
      { source: "/info/using", destination: "/blog", statusCode: 301 },
      { source: "/what-is", destination: "/blog", statusCode: 301 },
      { source: "/info/what-is", destination: "/blog", statusCode: 301 },
    ]
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
