import { NextRequest, NextResponse } from "next/server"
import { undoPendingDeletedOrders } from "@/lib/actions/order-actions"
import { getSiteUrl } from "@/lib/site-url"

function seeOther(url: URL) {
  return NextResponse.redirect(url, 303)
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    const params = new URLSearchParams(raw)
    const orderIds = params.getAll("orderIds").map((item) => String(item)).filter(Boolean)
    const returnTo = params.get("returnTo") || "/dashboard/orders"
    const safePath = returnTo.startsWith("/dashboard/orders") ? returnTo : "/dashboard/orders"
    const redirectUrl = new URL(safePath, getSiteUrl())

    const result = await undoPendingDeletedOrders(orderIds)
    if (!result.success) {
      redirectUrl.searchParams.set("bulkStatus", "undo_expired")
      return seeOther(redirectUrl)
    }

    redirectUrl.searchParams.set("bulkStatus", "undo_success")
    redirectUrl.searchParams.set("bulkAffected", String(result.affected || 0))
    return seeOther(redirectUrl)
  } catch {
    const fallback = new URL("/dashboard/orders?bulkStatus=error", getSiteUrl())
    return seeOther(fallback)
  }
}

