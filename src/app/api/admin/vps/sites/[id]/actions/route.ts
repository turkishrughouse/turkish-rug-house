import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminRoles } from "@/lib/admin-guard"
import { getVpsSite, updateVpsSite } from "@/lib/vps/registry"
import { runVpsAction } from "@/lib/vps/actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const actionSchema = z.object({
  action: z.enum([
    "enable_ssl",
    "delete_site",
    "backup_site",
    "optimize_media",
    "deploy_staging",
    "promote_live",
    "scan_media",
  ]),
})

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await requireAdminRoles(["SUPER_USER", "ADMIN"])
  const { id } = await context.params
  const body = await req.json().catch(() => null)
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const site = await getVpsSite(id)
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })

  const result = await runVpsAction(site, parsed.data.action)
  if (parsed.data.action === "enable_ssl" && result.ok) {
    await updateVpsSite(id, { sslEnabled: true })
  }

  return NextResponse.json({ result }, { status: result.ok ? 200 : 500 })
}
