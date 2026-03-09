import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminRoles } from "@/lib/admin-guard"
import { deleteVpsSite, getVpsSite, updateVpsSite } from "@/lib/vps/registry"
import { assertSitePaths } from "@/lib/vps/actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  domain: z.string().min(3).optional(),
  rootPath: z.string().min(2).optional(),
  uploadsPath: z.string().min(2).optional(),
  dbPath: z.string().optional(),
  processName: z.string().optional(),
  sslEnabled: z.boolean().optional(),
  stagingBranch: z.string().optional(),
  liveBranch: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  await requireAdminRoles(["SUPER_USER", "ADMIN"])
  const { id } = await context.params
  const site = await getVpsSite(id)
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })
  const pathState = await assertSitePaths(site)
  return NextResponse.json({ site, pathState })
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await requireAdminRoles(["SUPER_USER"])
  const { id } = await context.params
  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 })
  }
  const site = await updateVpsSite(id, parsed.data)
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })
  return NextResponse.json({ site })
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  await requireAdminRoles(["SUPER_USER"])
  const { id } = await context.params
  const deleted = await deleteVpsSite(id)
  if (!deleted) return NextResponse.json({ error: "Site not found" }, { status: 404 })
  return NextResponse.json({ success: true })
}
