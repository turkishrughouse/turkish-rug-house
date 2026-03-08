import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const query = (req.nextUrl.searchParams.get("q") || "").trim()
    if (!query) {
      return NextResponse.json({ products: [] })
    }

    const products = await prisma.product.findMany({
      where: {
        title: {
          startsWith: query,
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
      },
      orderBy: {
        title: "asc",
      },
      take: 8,
    })

    return NextResponse.json({ products })
  } catch (error) {
    console.error("GET /api/admin/products/search error:", error)
    return NextResponse.json({ error: "Failed to search products" }, { status: 500 })
  }
}
