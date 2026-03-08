import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"

const postSchema = z.object({
  content: z.string().min(1).max(5000),
})

function parseMetadata(raw: string | null | undefined) {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const profile = await prisma.customerProfile.findUnique({
    where: { userId: user.id },
    select: { displayName: true, nickname: true },
  })
  const customerDisplayName =
    profile?.displayName?.trim() ||
    profile?.nickname?.trim() ||
    user.name ||
    user.email.split("@")[0] ||
    "Customer"
  const anchor = await prisma.customerMessage.findFirst({
    where: { id, userId: user.id },
    select: { id: true, title: true, kind: true, metadata: true },
  })
  if (!anchor) return NextResponse.json({ error: "Message not found" }, { status: 404 })

  const anchorMeta = parseMetadata(anchor.metadata)
  const conversationId =
    (typeof anchorMeta.conversationId === "string" && anchorMeta.conversationId) || anchor.id

  const rows = await prisma.customerMessage.findMany({
    where: {
      userId: user.id,
      ...(anchor.kind === "CHAT"
        ? { kind: "CHAT" }
        : {
            OR: [
              { id: conversationId },
              { metadata: { contains: `"conversationId":"${conversationId}"` } },
            ],
          }),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      content: true,
      isRead: true,
      createdAt: true,
      metadata: true,
    },
  })

  const messages = rows.map((row) => {
    const meta = parseMetadata(row.metadata)
    const sender = meta.sender === "ADMIN" ? "ADMIN" : "CUSTOMER"
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      isRead: row.isRead,
      createdAt: row.createdAt,
      sender,
      senderName: sender === "ADMIN" ? "Turkish Rug House" : customerDisplayName,
    }
  })

  await prisma.customerMessage.updateMany({
    where: {
      userId: user.id,
      isRead: false,
      ...(anchor.kind === "CHAT"
        ? { kind: "CHAT" }
        : {
            OR: [
              { id: conversationId },
              { metadata: { contains: `"conversationId":"${conversationId}"` } },
            ],
          }),
    },
    data: { isRead: true, readAt: new Date() },
  })

  return NextResponse.json({
    conversationId,
    title: anchor.title,
    messages,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const anchor = await prisma.customerMessage.findFirst({
    where: { id, userId: user.id },
    select: { id: true, title: true, metadata: true },
  })
  if (!anchor) return NextResponse.json({ error: "Message not found" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const anchorMeta = parseMetadata(anchor.metadata)
  const conversationId =
    (typeof anchorMeta.conversationId === "string" && anchorMeta.conversationId) || anchor.id
  const subject =
    (typeof anchorMeta.subject === "string" && anchorMeta.subject) || anchor.title || "Customer message"
  const content = parsed.data.content.trim()
  const profile = await prisma.customerProfile.findUnique({
    where: { userId: user.id },
    select: { country: true, city: true, state: true, displayName: true, nickname: true },
  })

  await Promise.all([
    prisma.customerMessage.create({
      data: {
        userId: user.id,
        kind: "CHAT",
        title: subject,
        content,
        isRead: true,
        readAt: new Date(),
        metadata: JSON.stringify({
          conversationId,
          sender: "CUSTOMER",
          subject,
          source: "ACCOUNT_PANEL",
        }),
      },
    }),
    prisma.message.create({
      data: {
        source: "CUSTOMER",
        status: "NEW",
        name:
          profile?.displayName?.trim() ||
          profile?.nickname?.trim() ||
          user.name ||
          user.email.split("@")[0] ||
          "Customer",
        email: user.email,
        subject,
        content,
        metadata: JSON.stringify({
          conversationId,
          userId: user.id,
          sender: "CUSTOMER",
          country: profile?.country || "",
          city: profile?.city || "",
          state: profile?.state || "",
          fromCustomerPanel: true,
        }),
      },
    }),
  ])

  return NextResponse.json({ success: true })
}
