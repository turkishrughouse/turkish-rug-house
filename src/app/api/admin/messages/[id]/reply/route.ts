import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"

const replySchema = z.object({
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionUser("admin")
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const anchor = await prisma.message.findUnique({
    where: { id },
    select: {
      id: true,
      source: true,
      subject: true,
      name: true,
      email: true,
      metadata: true,
    },
  })
  if (!anchor || anchor.source !== "CUSTOMER") {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = replySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const anchorMeta = parseMetadata(anchor.metadata)
  let userId = typeof anchorMeta.userId === "string" ? anchorMeta.userId : ""
  if (!userId && anchor.email) {
    const owner = await prisma.user.findUnique({
      where: { email: anchor.email.toLowerCase() },
      select: { id: true },
    })
    userId = owner?.id || ""
  }
  const conversationId = userId ? `customer-${userId}` : ((typeof anchorMeta.conversationId === "string" && anchorMeta.conversationId) || anchor.id)
  if (!userId) {
    return NextResponse.json({ error: "Customer reference missing for this conversation" }, { status: 400 })
  }

  const content = parsed.data.content.trim()
  const subject = anchor.subject || "Customer message"
  const adminLabel = admin.name?.trim() || admin.email

  await prisma.$transaction(async (tx) => {
    await tx.message.create({
      data: {
        source: "CUSTOMER",
        status: "OPEN",
        name: adminLabel,
        email: admin.email,
        subject,
        content,
        metadata: JSON.stringify({
          conversationId,
          userId,
          sender: "ADMIN",
          fromAdminPanel: true,
          replyTo: id,
        }),
      },
    })

    await tx.customerMessage.create({
      data: {
        userId,
        kind: "CHAT",
        title: subject,
        content,
        isRead: false,
        metadata: JSON.stringify({
          conversationId,
          sender: "ADMIN",
          subject,
          fromAdminPanel: true,
        }),
      },
    })

    await tx.message.updateMany({
      where: {
        source: "CUSTOMER",
        metadata: { contains: `"userId":"${userId}"` },
      },
      data: { status: "OPEN" },
    })
  })

  return NextResponse.json({ success: true })
}
