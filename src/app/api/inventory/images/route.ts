import { NextRequest } from "next/server"
import { buildInventoryImagesZipResponse } from "@/lib/inventory-export"
import { requireInventoryApiUser } from "@/lib/inventory-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = await requireInventoryApiUser(req)
  if (auth.unauthorized) return auth.unauthorized
  const supplier = req.nextUrl.searchParams.get("supplier")
  const status = req.nextUrl.searchParams.get("status")
  const ids = (req.nextUrl.searchParams.get("ids") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  return buildInventoryImagesZipResponse({ supplier, status, productIds: ids })
}
