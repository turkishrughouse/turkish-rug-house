import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-server"
import { isAdminRole } from "@/lib/rbac"
import { getOrder } from "@/lib/actions/order-actions"

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "")
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser("admin")
  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const order = await getOrder(id)
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const rows = [
    ["orderNumber", order.orderNumber],
    ["status", order.status],
    ["paymentStatus", order.details.paymentStatus || ""],
    ["paymentMethod", order.details.paymentMethod || ""],
    ["customerName", order.customerName || ""],
    ["customerEmail", order.customerEmail],
    ["customerPhone", order.details.customerPhone || ""],
    ["shippingMethod", order.details.shippingMethod || ""],
    ["shippingCarrier", order.trackingCarrier || ""],
    ["trackingNumber", order.trackingNumber || ""],
    ["total", order.total],
    [],
    ["itemTitle", "sku", "quantity", "price", "subtotal"],
    ...order.items.map((item) => [
      item.title,
      item.productId || "",
      item.quantity,
      item.price,
      item.quantity * item.price,
    ]),
  ]
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${order.orderNumber}.csv"`,
    },
  })
}
