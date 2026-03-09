import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminRoles } from "@/lib/admin-guard"
import { createVpsSite, listVpsSites } from "@/lib/vps/registry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const createSchema = z.object({
  name: z.string().min(2),
  domain: z.string().min(3),
  rootPath: z.string().min(2),
  uploadsPath: z.string().min(2),
  dbPath: z.string().optional(),
  processName: z.string().optional(),
  sslEnabled: z.boolean().default(false),
  stagingBranch: z.string().default("develop"),
  liveBranch: z.string().default("main"),
  notes: z.string().optional(),
})

export async function GET() {
  await requireAdminRoles(["SUPER_USER", "ADMIN"])
  const sites = await listVpsSites()
  return NextResponse.json({ sites })
}

export async function POST(req: NextRequest) {
  await requireAdminRoles(["SUPER_USER"])
  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 })
  }

  const site = await createVpsSite({
    ...parsed.data,
    dbPath: parsed.data.dbPath || undefined,
    processName: parsed.data.processName || undefined,
    notes: parsed.data.notes || undefined,
  })

  return NextResponse.json({ site }, { status: 201 })
}
