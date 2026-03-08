import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
import {
  getSupportCategoryLabel,
  supportTicketPostSchema,
  validateSupportTicketByCategory,
} from "@/lib/support"

function pickFirstText(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

function summarizePayload(payload: Record<string, unknown>) {
  const message = pickFirstText(payload, ["message", "errorDescription", "newAddress", "notes"])
  if (message) return message
  const fallback = Object.entries(payload)
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" | ")
  return fallback || "Support request submitted."
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  const body = await req.json().catch(() => null)
  const parsed = supportTicketPostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 })
  }

  const payload = parsed.data.payload
  const resolvedEmail = (parsed.data.email || user?.email || "").trim().toLowerCase()
  const resolvedName = (parsed.data.name || user?.name || "").trim() || null
  const normalized = {
    ...parsed.data,
    email: resolvedEmail,
    name: resolvedName,
  }

  if (!resolvedEmail) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 })
  }

  if (normalized.category === "ORDER_SHIPPING" && !user && !(parsed.data.email || "").trim()) {
    return NextResponse.json({ error: "Email is required for guests." }, { status: 400 })
  }

  const categoryErrors = validateSupportTicketByCategory(normalized)
  if (categoryErrors.length > 0) {
    return NextResponse.json({ error: "Validation failed", details: categoryErrors }, { status: 400 })
  }

  const categoryLabel = getSupportCategoryLabel(normalized.category)
  const subtypeLabel = (normalized.subType || "").trim()
  const payloadRecord = payload as Record<string, unknown>
  const subject = pickFirstText(payloadRecord, ["subject"]) || `${categoryLabel}${subtypeLabel ? ` - ${subtypeLabel}` : ""}`

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: user?.id || null,
      category: normalized.category,
      subType: subtypeLabel || null,
      orderNumber: (normalized.orderNumber || "").trim() || null,
      email: resolvedEmail,
      name: resolvedName,
      payload: JSON.stringify(payloadRecord),
      attachments: JSON.stringify(normalized.attachments),
      faqViewed: JSON.stringify(normalized.faqViewed),
      status: "NEW",
    },
  })

  const conversationId = user?.id ? `customer-${user.id}` : `support-${ticket.id}`
  const content = summarizePayload(payloadRecord)

  await prisma.message.create({
    data: {
      source: "CUSTOMER",
      status: "NEW",
      name: resolvedName || "Customer",
      email: resolvedEmail,
      subject,
      content,
      metadata: JSON.stringify({
        userId: user?.id || null,
        conversationId,
        sender: "CUSTOMER",
        source: "SUPPORT_FORM",
        supportTicketId: ticket.id,
        category: normalized.category,
        subType: subtypeLabel || null,
        orderNumber: (normalized.orderNumber || "").trim() || null,
      }),
      attachments: JSON.stringify(
        normalized.attachments.map((url) => ({
          type: "file",
          url,
        }))
      ),
    },
  })

  if (user?.id) {
    await prisma.customerMessage.create({
      data: {
        userId: user.id,
        kind: "CHAT",
        title: "Support request received",
        content: `We received your request${subtypeLabel ? ` about ${subtypeLabel}` : ""}. Ticket ID: ${ticket.id}`,
        isRead: false,
        metadata: JSON.stringify({
          conversationId,
          sender: "ADMIN",
          source: "SUPPORT_FORM",
          supportTicketId: ticket.id,
          category: normalized.category,
        }),
      },
    })
  }

  return NextResponse.json(
    {
      success: true,
      ticket: {
        id: ticket.id,
        status: ticket.status,
        category: ticket.category,
        createdAt: ticket.createdAt,
      },
    },
    { status: 201 }
  )
}
