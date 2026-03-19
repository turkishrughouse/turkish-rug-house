import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth-server"
import { isAdminRole } from "@/lib/rbac"
import { getOrder } from "@/lib/actions/order-actions"
import { buildInvoiceHtml, buildInvoicePdf } from "@/lib/order-invoice"

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser("admin")
  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const order = await getOrder(id)
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const format = req.nextUrl.searchParams.get("format")
  if (format === "html") {
    return new NextResponse(buildInvoiceHtml(order), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    })
  }

  const pdf = buildInvoicePdf(order)
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.orderNumber}-invoice.pdf"`,
    },
  })
}
