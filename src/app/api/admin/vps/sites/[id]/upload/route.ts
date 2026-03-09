import { NextRequest, NextResponse } from "next/server"
import { requireAdminRoles } from "@/lib/admin-guard"
import { getVpsSite } from "@/lib/vps/registry"
import { processUploadedImageForSite } from "@/lib/vps/actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await requireAdminRoles(["SUPER_USER", "ADMIN"])
  const { id } = await context.params
  const site = await getVpsSite(id)
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })

  const contentType = req.headers.get("content-type") || ""
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Use multipart/form-data" }, { status: 400 })
  }

  const form = await req.formData()
  const file = form.get("file")
  const folder = String(form.get("folder") || "manual")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const payload = Buffer.from(bytes)
  const result = await processUploadedImageForSite(site, file.name || "image", payload, folder)

  return NextResponse.json({ success: true, result })
}
