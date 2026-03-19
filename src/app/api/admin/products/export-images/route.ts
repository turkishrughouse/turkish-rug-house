import { NextRequest } from "next/server"
import { requireAdminApiUser } from "@/lib/admin-api-auth"
import { buildInventoryImagesZipResponse } from "@/lib/inventory-export"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireAdminApiUser("inventory")
  if (unauthorized) return unauthorized

  const supplier = req.nextUrl.searchParams.get("supplier")
  const status = req.nextUrl.searchParams.get("status")
  return buildInventoryImagesZipResponse({ supplier, status })
}
