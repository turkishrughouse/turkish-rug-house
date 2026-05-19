import { NextRequest, NextResponse } from "next/server"
import { applyBulkOrderAction } from "@/lib/actions/order-actions"
import { getSiteUrl } from "@/lib/site-url"

const ALLOWED_ACTIONS = new Set([
  "MARK_PAID",
  "MARK_FULFILLED",
  "MARK_CANCELLED",
  "MARK_REFUNDED",
  "MARK_SHIPPED",
  "MARK_IN_TRANSIT",
  "MARK_DELIVERED",
  "DELETE",
] as const)

function buildRedirectUrl(req: NextRequest, returnTo: string, patch: Record<string, string>) {
  const safePath = returnTo.startsWith("/dashboard/orders") ? returnTo : "/dashboard/orders"
  const url = new URL(safePath, getSiteUrl())
  Object.entries(patch).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  return url
}

function seeOther(url: URL) {
  return NextResponse.redirect(url, 303)
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    const params = new URLSearchParams(raw)
    const explicitDelete = params.get("dangerDelete") === "1"
    const selectedAction = params.get("bulkAction") || ""
    const action = explicitDelete ? "DELETE" : selectedAction
    const orderIds = params.getAll("orderIds").map((item) => String(item)).filter(Boolean)
    const returnTo = params.get("returnTo") || "/dashboard/orders"

    if (!ALLOWED_ACTIONS.has(action as (typeof ALLOWED_ACTIONS extends Set<infer T> ? T : never))) {
      return seeOther(buildRedirectUrl(req, returnTo, { bulkStatus: "invalid_action" }))
    }

    if (!explicitDelete && action === "DELETE") {
      return seeOther(buildRedirectUrl(req, returnTo, { bulkStatus: "invalid_action" }))
    }

    if (orderIds.length === 0) {
      return seeOther(buildRedirectUrl(req, returnTo, { bulkStatus: "none_selected" }))
    }

    const result = await applyBulkOrderAction(orderIds, action as Parameters<typeof applyBulkOrderAction>[1])
    if (!result?.success) {
      return seeOther(buildRedirectUrl(req, returnTo, { bulkStatus: "error" }))
    }

    if (action === "DELETE") {
      return seeOther(
        buildRedirectUrl(req, returnTo, {
          bulkStatus: "delete_pending",
          bulkAffected: String(result.affected || orderIds.length),
          undoIds: Array.isArray((result as { undoIds?: string[] }).undoIds) ? (result as { undoIds?: string[] }).undoIds!.join(",") : "",
        })
      )
    }

    return seeOther(
      buildRedirectUrl(req, returnTo, {
        bulkStatus: "success",
        bulkAffected: String(result.affected || orderIds.length),
      })
    )
  } catch {
    const fallback = new URL("/dashboard/orders?bulkStatus=error", getSiteUrl())
    return seeOther(fallback)
  }
}
