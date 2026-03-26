import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
import { isAdminRole } from "@/lib/rbac"

export async function GET() {
  try {
    const user = await getSessionUser("admin")
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const topSellingRows = await prisma.$queryRaw<Array<{ productId: string; soldCount: number | string }>>`
      SELECT
        oi."productId" as "productId",
        SUM(CAST(oi."quantity" as REAL)) as "soldCount"
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      WHERE oi."productId" IS NOT NULL
        AND o."status" != 'CANCELLED'
      GROUP BY oi."productId"
      ORDER BY "soldCount" DESC
      LIMIT 10
    `

    if (topSellingRows.length === 0) {
      return NextResponse.json({ products: [] })
    }

    const productIds = topSellingRows.map((row) => row.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        sku: true,
        price: true,
        stockCount: true,
        images: true,
        categories: {
          select: {
            id: true,
            title: true,
          },
          take: 1,
        },
      },
    })

    const productMap = new Map(products.map((product) => [product.id, product]))

    return NextResponse.json({
      products: topSellingRows
        .map((row) => {
          const product = productMap.get(row.productId)
          if (!product) return null
          return {
            id: product.id,
            title: product.title,
            slug: product.slug,
            sku: product.sku,
            price: Number(product.price || 0),
            stockCount: Number(product.stockCount || 0),
            images: product.images,
            categories: product.categories,
            soldCount: Number(row.soldCount || 0),
          }
        })
        .filter(Boolean),
    })
  } catch (error) {
    console.error("Dashboard top products error:", error)
    return NextResponse.json({ error: "Failed to fetch top products" }, { status: 500 })
  }
}
