import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
import { z } from "zod"

const patchSchema = z.object({
  ids: z.array(z.string()).default([]),
  all: z.boolean().optional(),
})
const postSchema = z.object({
  title: z.string().min(2).max(140),
  content: z.string().min(5).max(5000),
})
const deleteSchema = z.object({
  ids: z.array(z.string()).default([]),
  all: z.boolean().optional(),
})

function parseMetadata(raw: string | null | undefined) {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function getConversationId(message: { id: string; metadata: string | null | undefined }, userId: string) {
  const meta = parseMetadata(message.metadata)
  return (typeof meta.conversationId === "string" && meta.conversationId) || `customer-${userId}` || message.id
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const limit = Math.min(120, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || "30")))
  const rows = await prisma.customerMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit * 4,
  })

  type SummaryMessage = {
    id: string
    kind: string
    title: string
    content: string
    ctaLabel: string | null
    ctaUrl: string | null
    isRead: boolean
    createdAt: Date
  }

  const chatMap = new Map<string, SummaryMessage>()
  const otherMessages: SummaryMessage[] = []

  for (const row of rows) {
    if (row.kind !== "CHAT") {
      otherMessages.push({
        id: row.id,
        kind: row.kind,
        title: row.title,
        content: row.content,
        ctaLabel: row.ctaLabel,
        ctaUrl: row.ctaUrl,
        isRead: row.isRead,
        createdAt: row.createdAt,
      })
      continue
    }

    const conversationId = getConversationId(row, user.id)
    const existing = chatMap.get(conversationId)
    if (!existing) {
      chatMap.set(conversationId, {
        id: row.id,
        kind: "CHAT",
        title: "Turkish Rug House",
        content: row.content,
        ctaLabel: row.ctaLabel,
        ctaUrl: row.ctaUrl,
        isRead: row.isRead,
        createdAt: row.createdAt,
      })
      continue
    }

    if (row.createdAt > existing.createdAt) {
      existing.id = row.id
      existing.content = row.content
      existing.createdAt = row.createdAt
      existing.ctaLabel = row.ctaLabel
      existing.ctaUrl = row.ctaUrl
    }
    if (!row.isRead) {
      existing.isRead = false
    }
  }

  const merged = [...otherMessages, ...Array.from(chatMap.values())]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)

  const unreadCount = merged.reduce((sum, item) => sum + (item.isRead ? 0 : 1), 0)

  return NextResponse.json({ messages: merged, unreadCount })
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  if (parsed.data.all) {
    await prisma.customerMessage.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
  } else {
    const selected = await prisma.customerMessage.findMany({
      where: { userId: user.id, id: { in: parsed.data.ids } },
      select: { id: true, kind: true, metadata: true },
    })

    const targetIds = new Set<string>()
    for (const row of selected) {
      if (row.kind !== "CHAT") {
        targetIds.add(row.id)
        continue
      }
      const conversationId = getConversationId(row, user.id)
      const chatRows = await prisma.customerMessage.findMany({
        where: {
          userId: user.id,
          kind: "CHAT",
          OR: [{ metadata: { contains: `"conversationId":"${conversationId}"` } }, { id: row.id }],
        },
        select: { id: true },
      })
      chatRows.forEach((item) => targetIds.add(item.id))
    }

    if (targetIds.size > 0) {
      await prisma.customerMessage.updateMany({
        where: { userId: user.id, id: { in: Array.from(targetIds) }, isRead: false },
        data: { isRead: true, readAt: new Date() },
      })
    }
  }

  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const profile = await prisma.customerProfile.findUnique({
    where: { userId: user.id },
    select: { country: true, city: true, state: true, displayName: true, nickname: true },
  })
  const country = (profile?.country || "").trim()
  const city = (profile?.city || "").trim()
  const state = (profile?.state || "").trim()

  const conversationId = `customer-${user.id}`
  const trimmedTitle = parsed.data.title.trim()
  const trimmedContent = parsed.data.content.trim()
  const customerName =
    profile?.displayName?.trim() ||
    profile?.nickname?.trim() ||
    user.name ||
    user.email.split("@")[0] ||
    "Customer"

  const [customerMessage] = await Promise.all([
    prisma.customerMessage.create({
      data: {
        userId: user.id,
        kind: "CHAT",
        title: trimmedTitle,
        content: trimmedContent,
        isRead: false,
        metadata: JSON.stringify({
          conversationId,
          sender: "CUSTOMER",
          source: "ACCOUNT_PANEL",
        }),
      },
    }),
    prisma.message.create({
      data: {
        source: "CUSTOMER",
        status: "NEW",
        name: customerName,
        email: user.email,
        subject: trimmedTitle,
        content: trimmedContent,
        metadata: JSON.stringify({
          conversationId,
          userId: user.id,
          sender: "CUSTOMER",
          country,
          city,
          state,
          fromCustomerPanel: true,
        }),
      },
    }),
  ])

  return NextResponse.json({ success: true, data: customerMessage }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  let result
  if (parsed.data.all) {
    result = await prisma.customerMessage.deleteMany({ where: { userId: user.id } })
  } else {
    const selected = await prisma.customerMessage.findMany({
      where: { userId: user.id, id: { in: parsed.data.ids } },
      select: { id: true, kind: true, metadata: true },
    })

    const targetIds = new Set<string>()
    for (const row of selected) {
      if (row.kind !== "CHAT") {
        targetIds.add(row.id)
        continue
      }
      const conversationId = getConversationId(row, user.id)
      const chatRows = await prisma.customerMessage.findMany({
        where: {
          userId: user.id,
          kind: "CHAT",
          OR: [{ metadata: { contains: `"conversationId":"${conversationId}"` } }, { id: row.id }],
        },
        select: { id: true },
      })
      chatRows.forEach((item) => targetIds.add(item.id))
    }

    result = await prisma.customerMessage.deleteMany({
      where: { userId: user.id, id: { in: Array.from(targetIds) } },
    })
  }

  return NextResponse.json({ success: true, deleted: result.count })
}
