import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUser } from "@/lib/auth-server"
import {
  createOrderMessage,
  getOrderThreadForCustomer,
  mirrorOrderCustomerMessageToAdminInbox,
} from "@/lib/order-messaging"

const postSchema = z.object({
  content: z.string().min(1).max(5000),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orderId } = await params
  const thread = await getOrderThreadForCustomer(orderId, user.id, user.email)
  if (!thread) return NextResponse.json({ error: "Order thread not found" }, { status: 404 })

  return NextResponse.json(thread)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orderId } = await params
  const thread = await getOrderThreadForCustomer(orderId, user.id, user.email)
  if (!thread) return NextResponse.json({ error: "Order thread not found" }, { status: 404 })
  if (!thread.messagingOpen) {
    return NextResponse.json({ error: "Messaging for this order is closed." }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const content = parsed.data.content.trim()
  const [message] = await Promise.all([
    createOrderMessage({
      orderId,
      userId: user.id,
      message: content,
      type: "customer",
    }),
    mirrorOrderCustomerMessageToAdminInbox({
      orderId,
      content,
      userId: user.id,
    }),
  ])

  return NextResponse.json({ success: true, message }, { status: 201 })
}
