import { prisma } from "@/lib/db"
import { OrderReportsDashboard } from "@/components/admin/orders/order-reports-dashboard"

export const dynamic = "force-dynamic"

export default async function OrderReportsPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        select: {
          productId: true,
          title: true,
          quantity: true,
          price: true,
        },
      },
    },
  })

  const products = await prisma.product.findMany({
    select: {
      id: true,
      categories: {
        select: {
          title: true,
        },
      },
    },
  })

  const productCategoryMap = Object.fromEntries(
    products.map((product) => [
      product.id,
      product.categories.map((category) => category.title),
    ])
  )

  const rows = orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    total: Number(order.total || 0),
    status: order.status,
    itemsPurchased: order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    items: order.items.map((item) => ({
      productId: item.productId,
      title: item.title,
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
    })),
  }))

  return <OrderReportsDashboard orders={rows} productCategoryMap={productCategoryMap} />
}
