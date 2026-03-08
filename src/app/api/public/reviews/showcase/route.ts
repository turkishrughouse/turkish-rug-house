import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { parseProductImages } from "@/lib/product-images"

function parseMainImage(images: string | null | undefined) {
  if (!images) return null
  return parseProductImages(images)[0] || null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.max(1, Math.min(12, Number(searchParams.get("limit") || 6)))

    const rows = await prisma.productReview.findMany({
      where: {
        NOT: { email: null },
      },
      orderBy: { createdAt: "desc" },
      take: Math.max(limit * 2, 10),
      include: {
        product: {
          select: {
            title: true,
            slug: true,
            images: true,
          },
        },
      },
    })

    const withPhotoFirst = rows
      .sort((a, b) => {
        const aHasPhoto = Boolean(a.photoUrl)
        const bHasPhoto = Boolean(b.photoUrl)
        if (aHasPhoto === bHasPhoto) return 0
        return aHasPhoto ? -1 : 1
      })
      .slice(0, limit)

    return NextResponse.json({
      items: withPhotoFirst.map((item) => ({
        id: item.id,
        customerName: item.name,
        quote: item.comment,
        rating: item.rating,
        photoUrl: item.photoUrl || parseMainImage(item.product.images) || "/placeholder.jpg",
        productTitle: item.product.title,
        productSlug: item.product.slug,
      })),
    })
  } catch (error) {
    console.error("GET /api/public/reviews/showcase error:", error)
    return NextResponse.json({ error: "Failed to load review showcase" }, { status: 500 })
  }
}
