import type { BlogPostPublic } from "@/lib/blog-model"

export const MOCK_BLOG_POSTS: BlogPostPublic[] = [
  {
    id: "mock-oushak-care",
    slug: "how-to-care-for-an-oushak-rug",
    title: "How to Care for an Oushak Rug (Without Over-Cleaning It)",
    excerpt:
      "A calm, practical guide to routine care—so your Oushak ages beautifully without losing its character.",
    coverImage: {
      url: "/placeholder.svg",
      alt: "Handmade Oushak rug detail on a quiet floor",
    },
    author: { name: "Turkish Rug House Editorial" },
    publishDate: new Date("2026-02-20T10:00:00.000Z"),
    readTimeMinutes: 6,
    category: { slug: "care-guides", title: "Care Guides" },
    tags: ["Oushak", "Care", "Cleaning"],
    isFeatured: true,
    seo: {
      metaTitle: "How to Care for an Oushak Rug | Turkish Rug House",
      metaDescription:
        "Learn the essentials of caring for an Oushak rug: vacuuming, rotation, spill response, and what to avoid for long-term beauty.",
    },
    blocks: [
      { id: "h1", type: "heading", level: 2, text: "The goal: preserve patina, not chase perfection" },
      {
        id: "rt1",
        type: "richText",
        html:
          "<p>Oushak rugs are meant to live with you. The best care is light, consistent, and respectful of the weave—so the rug softens over time without thinning or fading unevenly.</p>",
      },
      { id: "h2", type: "heading", level: 2, text: "Weekly routine" },
      {
        id: "rt2",
        type: "richText",
        html:
          "<ul><li>Vacuum gently in the direction of the pile.</li><li>Avoid aggressive beater bars on delicate edges.</li><li>Rotate every 8–12 weeks for even wear.</li></ul>",
      },
      {
        id: "q1",
        type: "quote",
        quote: "The most luxurious rugs are the ones that look quietly lived-in—not freshly processed.",
        attribution: "TRH Atelier Notes",
      },
      { id: "cta1", type: "cta", cta: { title: "Browse Oushak Rugs", text: "See softly toned, hand-knotted Oushaks selected for collectors.", buttonLabel: "Shop Oushak Rugs", buttonUrl: "/collections/oushak-rugs", variant: "primary" } },
      { id: "fp1", type: "featuredProducts", config: { title: "Oushaks featured in this guide", productIds: [] } },
      { id: "faq1", type: "faq", title: "Quick answers", items: [
        { question: "Can I steam clean an Oushak rug?", answer: "We don’t recommend it. Excess moisture and heat can stress natural fibers and dyes. Use a specialist when deep cleaning is needed." },
        { question: "How often should I professionally clean it?", answer: "Typically every 2–4 years depending on traffic. Light maintenance is more important than frequent deep cleaning." }
      ]},
    ],
    updatedAt: new Date("2026-02-20T10:00:00.000Z"),
  },
  {
    id: "mock-vintage-styling",
    slug: "styling-vintage-rugs-in-modern-interiors",
    title: "Styling Vintage Rugs in Modern Interiors",
    excerpt:
      "A minimalist approach to color, scale, and restraint—so a vintage rug anchors the room without overwhelming it.",
    coverImage: {
      url: "/placeholder.svg",
      alt: "Vintage rug palette against modern furniture",
    },
    author: { name: "Turkish Rug House Editorial" },
    publishDate: new Date("2026-01-14T10:00:00.000Z"),
    readTimeMinutes: 7,
    category: { slug: "styling", title: "Styling" },
    tags: ["Vintage", "Interiors", "Design"],
    isFeatured: false,
    seo: {
      metaTitle: "Styling Vintage Rugs in Modern Interiors | Turkish Rug House",
      metaDescription:
        "Learn how to place and style vintage Turkish rugs in modern rooms with refined color pairing, scale, and negative space.",
    },
    blocks: [
      { id: "h1", type: "heading", level: 2, text: "Start with scale, then let the palette whisper" },
      {
        id: "rt1",
        type: "richText",
        html:
          "<p>In a modern interior, a vintage rug works best when it feels inevitable—like it has always belonged. Choose scale first, then keep the surrounding palette calm.</p>",
      },
      { id: "img1", type: "image", url: "/placeholder.svg", alt: "Vintage rug styling example", caption: "Tone-on-tone rooms make vintage color feel intentional." },
      { id: "h2", type: "heading", level: 2, text: "Three reliable placement rules" },
      {
        id: "rt2",
        type: "richText",
        html:
          "<ol><li>Anchor at least the front legs of key furniture.</li><li>Leave consistent negative space at edges.</li><li>Repeat one rug tone elsewhere—wood, ceramics, or textiles.</li></ol>",
      },
      {
        id: "rc1",
        type: "relatedCategories",
        title: "Explore by style",
        links: [
          { title: "Vintage Rugs", url: "/collections/vintage-rugs", description: "One-of-a-kind pieces with softened palettes." },
          { title: "Turkish Rugs", url: "/collections/turkish-rugs", description: "Handmade classics across regions and weaves." },
        ],
      },
      { id: "cta1", type: "cta", cta: { title: "Shop Vintage Rugs", text: "Find a rug with a palette that feels calm, collected, and timeless.", buttonLabel: "Explore Vintage", buttonUrl: "/collections/vintage-rugs", variant: "secondary" } },
    ],
    updatedAt: new Date("2026-01-14T10:00:00.000Z"),
  },
]

