import { prisma } from "@/lib/db"

let ensurePaymentWebhookEventsTablePromise: Promise<void> | null = null

export async function ensurePaymentWebhookEventsTable() {
  if (!ensurePaymentWebhookEventsTablePromise) {
    ensurePaymentWebhookEventsTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PaymentWebhookEvent" (
          "id" TEXT PRIMARY KEY,
          "eventId" TEXT NOT NULL UNIQUE,
          "provider" TEXT NOT NULL,
          "orderId" TEXT,
          "eventType" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'PROCESSING',
          "error" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "processedAt" DATETIME
        )
      `)
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "idx_payment_webhook_event_order" ON "PaymentWebhookEvent" ("orderId", "createdAt" DESC)`
      )
    })().catch((error) => {
      ensurePaymentWebhookEventsTablePromise = null
      throw error
    })
  }

  await ensurePaymentWebhookEventsTablePromise
}

export async function claimPaymentWebhookEvent(input: {
  eventId: string
  provider: string
  eventType: string
  orderId?: string | null
}) {
  await ensurePaymentWebhookEventsTable()
  const existing = await prisma.$queryRawUnsafe<Array<{ status: string }>>(
    `
      SELECT "status"
      FROM "PaymentWebhookEvent"
      WHERE "eventId" = ? AND "provider" = ?
      LIMIT 1
    `,
    input.eventId,
    input.provider
  )

  if (existing[0]?.status === "PROCESSED" || existing[0]?.status === "PROCESSING") {
    return false
  }

  if (existing[0]?.status === "FAILED") {
    await prisma.$executeRawUnsafe(
      `
        UPDATE "PaymentWebhookEvent"
        SET "orderId" = COALESCE(?, "orderId"),
            "eventType" = ?,
            "status" = 'PROCESSING',
            "error" = NULL,
            "processedAt" = NULL
        WHERE "eventId" = ? AND "provider" = ?
      `,
      input.orderId || null,
      input.eventType,
      input.eventId,
      input.provider
    )
    return true
  }

  const id = `${input.provider}-${input.eventId}`
  const result = await prisma.$executeRawUnsafe(
    `
      INSERT OR IGNORE INTO "PaymentWebhookEvent" ("id", "eventId", "provider", "orderId", "eventType", "status")
      VALUES (?, ?, ?, ?, ?, 'PROCESSING')
    `,
    id,
    input.eventId,
    input.provider,
    input.orderId || null,
    input.eventType
  )

  return result > 0
}

export async function completePaymentWebhookEvent(input: {
  eventId: string
  provider: string
  orderId?: string | null
}) {
  await ensurePaymentWebhookEventsTable()
  await prisma.$executeRawUnsafe(
    `
      UPDATE "PaymentWebhookEvent"
      SET "orderId" = COALESCE(?, "orderId"),
          "status" = 'PROCESSED',
          "error" = NULL,
          "processedAt" = CURRENT_TIMESTAMP
      WHERE "eventId" = ? AND "provider" = ?
    `,
    input.orderId || null,
    input.eventId,
    input.provider
  )
}

export async function failPaymentWebhookEvent(input: {
  eventId: string
  provider: string
  orderId?: string | null
  error: string
}) {
  await ensurePaymentWebhookEventsTable()
  await prisma.$executeRawUnsafe(
    `
      UPDATE "PaymentWebhookEvent"
      SET "orderId" = COALESCE(?, "orderId"),
          "status" = 'FAILED',
          "error" = ?,
          "processedAt" = CURRENT_TIMESTAMP
      WHERE "eventId" = ? AND "provider" = ?
    `,
    input.orderId || null,
    input.error.slice(0, 1000),
    input.eventId,
    input.provider
  )
}

export async function listRecentPaymentWebhookEvents(orderId: string, limit = 10) {
  await ensurePaymentWebhookEventsTable()
  return prisma.$queryRawUnsafe<Array<{
    eventId: string
    eventType: string
    status: string
    error: string | null
    createdAt: string
    processedAt: string | null
  }>>(
    `
      SELECT "eventId", "eventType", "status", "error", "createdAt", "processedAt"
      FROM "PaymentWebhookEvent"
      WHERE "orderId" = ?
      ORDER BY "createdAt" DESC
      LIMIT ?
    `,
    orderId,
    limit
  )
}
