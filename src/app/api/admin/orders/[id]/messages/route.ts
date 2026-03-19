import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUser } from "@/lib/auth-server"
import { createOrderMessage, getOrderThreadForAdmin } from "@/lib/order-messaging"

const postSchema = z.object({
  content: z.string().min(1).max(5000),
  type: z.enum(["system", "tracking"]).default("system"),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionUser("admin")
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const thread = await getOrderThreadForAdmin(id)
  if (!thread) return NextResponse.json({ error: "Order thread not found" }, { status: 404 })

  return NextResponse.json(thread)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionUser("admin")
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const thread = await getOrderThreadForAdmin(id)
  if (!thread) return NextResponse.json({ error: "Order thread not found" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const message = await createOrderMessage({
    orderId: id,
    message: parsed.data.content.trim(),
    type: parsed.data.type,
    enforceOpen: false,
  })

  return NextResponse.json({ success: true, message }, { status: 201 })
}
