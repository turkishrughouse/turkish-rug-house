import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminApiAuth } from "@/lib/admin-guard"

function parseMetadata(raw: string | null | undefined) {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function normalizeEmailSubject(value: string | null | undefined) {
  const raw = (value || "").trim().toLowerCase()
  if (!raw) return "(no-subject)"
  return raw.replace(/^(re|fwd|fw)\s*:\s*/gi, "").trim() || "(no-subject)"
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth()
  if (auth instanceof NextResponse) return auth
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
  if (!anchor || (anchor.source !== "CUSTOMER" && anchor.source !== "EMAIL")) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
  }

  if (anchor.source === "EMAIL") {
    const senderEmail = (anchor.email || "").trim().toLowerCase()
    const subjectKey = normalizeEmailSubject(anchor.subject)
    const candidateRows = await prisma.message.findMany({
      where: {
        source: "EMAIL",
        deletedAt: null,
        ...(senderEmail ? { email: senderEmail } : {}),
      },
      orderBy: { receivedAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        content: true,
        receivedAt: true,
        subject: true,
      },
    })

    const rows = candidateRows.filter((row) => normalizeEmailSubject(row.subject) === subjectKey)
    const messages = rows.map((row) => ({
      id: row.id,
      sender: "CUSTOMER" as const,
      senderName: row.name || row.email || "Customer",
      name: row.name,
      email: row.email,
      content: row.content,
      createdAt: row.receivedAt,
    }))

    return NextResponse.json({
      conversationId: `email-${senderEmail || anchor.id}-${subjectKey}`,
      subject: anchor.subject || "Email conversation",
      customerName: anchor.name || anchor.email,
      customerEmail: anchor.email,
      messages,
    })
  }

  const meta = parseMetadata(anchor.metadata)
  const metaConversationId =
    (typeof meta.conversationId === "string" && meta.conversationId) || anchor.id
  let userId = typeof meta.userId === "string" ? meta.userId : ""

  if (!userId && anchor.email) {
    const owner = await prisma.user.findUnique({
      where: { email: anchor.email.toLowerCase() },
      select: { id: true },
    })
    userId = owner?.id || ""
  }

  const conversationId = userId ? `customer-${userId}` : metaConversationId

  const rows = await prisma.message.findMany({
    where: {
      source: "CUSTOMER",
      deletedAt: null,
      ...(userId
        ? { metadata: { contains: `"userId":"${userId}"` } }
        : {
            OR: [
              { id: conversationId },
              { metadata: { contains: `"conversationId":"${conversationId}"` } },
            ],
          }),
    },
    orderBy: { receivedAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      content: true,
      receivedAt: true,
      metadata: true,
    },
  })

  const messages = rows.map((row) => {
    const rowMeta = parseMetadata(row.metadata)
    const sender = rowMeta.sender === "ADMIN" ? "ADMIN" : "CUSTOMER"
    const senderName = sender === "ADMIN" ? "Turkish Rug House" : row.name || row.email || "Customer"
    return {
      id: row.id,
      sender,
      senderName,
      name: row.name,
      email: row.email,
      content: row.content,
      createdAt: row.receivedAt,
    }
  })

  return NextResponse.json({
    conversationId,
    subject: anchor.subject || "Customer message",
    customerName: anchor.name,
    customerEmail: anchor.email,
    messages,
  })
}
