import crypto from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSingleOrderDetails, saveOrderDetails } from "@/lib/order-details"
import { finalizePaidOrder, markOrderPaymentFailed, markOrderRefunded } from "@/lib/payment-orders"
import {
  claimPaymentWebhookEvent,
  completePaymentWebhookEvent,
  failPaymentWebhookEvent,
} from "@/lib/payment-webhook-events"
import { getSiteSettings } from "@/lib/site-settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type StripeEvent = {
  id: string
  type: string
  data?: {
    object?: Record<string, unknown>
  }
}

function getClientIp(req: NextRequest) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  )
}

function isAllowedIp(ip: string, allowedIpsRaw: string) {
  const allowedIps = allowedIpsRaw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean)

  if (allowedIps.length === 0) return true
  return Boolean(ip && allowedIps.includes(ip))
}

function parseStripeSignature(signatureHeader: string) {
  const parts = signatureHeader.split(",").map((part) => part.trim())
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2) || ""
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean)

  return {
    timestamp,
    signatures,
  }
}

function verifyStripeWebhookSignature(input: {
  payload: string
  signatureHeader: string
  secret: string
}) {
  const { timestamp, signatures } = parseStripeSignature(input.signatureHeader)
  if (!timestamp || signatures.length === 0) return false

  const timestampAgeSeconds = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(timestampAgeSeconds) || timestampAgeSeconds > 300) {
    return false
  }

  const signedPayload = `${timestamp}.${input.payload}`
  const expected = crypto.createHmac("sha256", input.secret).update(signedPayload).digest("hex")

  return signatures.some((signature) => {
    const expectedBuffer = Buffer.from(expected)
    const signatureBuffer = Buffer.from(signature)
    if (expectedBuffer.length !== signatureBuffer.length) return false
    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  })
}

function getObjectString(object: Record<string, unknown>, key: string) {
  const value = object[key]
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function getOrderIdFromStripeObject(object: Record<string, unknown>) {
  const metadata =
    object.metadata && typeof object.metadata === "object"
      ? (object.metadata as Record<string, unknown>)
      : {}

  return (
    getObjectString(metadata, "orderId") ||
    getObjectString(object, "client_reference_id")
  )
}

function getPaymentIntentId(object: Record<string, unknown>) {
  const paymentIntent = object.payment_intent
  if (typeof paymentIntent === "string" && paymentIntent.trim()) return paymentIntent.trim()
  if (paymentIntent && typeof paymentIntent === "object") {
    return getObjectString(paymentIntent as Record<string, unknown>, "id")
  }
  return ""
}

async function findOrderIdByStoredPaymentReference(input: {
  sessionId?: string
  paymentIntentId?: string
}) {
  const candidates = [input.sessionId, input.paymentIntentId].filter(Boolean) as string[]
  for (const candidate of candidates) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "Order" WHERE "detailsJson" LIKE ? LIMIT 1`,
      `%${candidate}%`
    )
    if (rows[0]?.id) return rows[0].id
  }
  return ""
}

async function rememberProcessedEvent(orderId: string, eventId: string) {
  const details = await getSingleOrderDetails(orderId)
  const nextProcessedEvents = Array.from(new Set([...details.processedWebhookEvents, eventId])).slice(-10)
  await saveOrderDetails(orderId, {
    processedWebhookEvents: nextProcessedEvents,
    paymentLastEventId: eventId,
  })
}

async function handleCheckoutSessionCompleted(event: StripeEvent, object: Record<string, unknown>) {
  const sessionId = getObjectString(object, "id")
  const paymentIntentId = getPaymentIntentId(object)
  const orderId = getOrderIdFromStripeObject(object) || await findOrderIdByStoredPaymentReference({
    sessionId,
    paymentIntentId,
  })
  if (!orderId) return

  const paymentStatus = getObjectString(object, "payment_status").toLowerCase()
  const status = getObjectString(object, "status").toLowerCase()

  if (paymentStatus === "paid" || status === "complete") {
    await finalizePaidOrder({
      orderId,
      paymentMethod: "STRIPE",
      paymentReference: sessionId || paymentIntentId || orderId,
      paymentSessionId: sessionId || null,
      paymentIntentId: paymentIntentId || null,
      webhookEventId: event.id,
      eventDescription: "Stripe checkout.session.completed webhook confirmed payment",
    })
    await rememberProcessedEvent(orderId, event.id)
    return
  }

  await saveOrderDetails(orderId, {
    paymentProvider: "STRIPE",
    paymentMethod: "STRIPE",
    paymentSessionId: sessionId || null,
    paymentIntentId: paymentIntentId || null,
    paymentLastEventId: event.id,
  })
  await rememberProcessedEvent(orderId, event.id)
}

async function handlePaymentIntentSucceeded(event: StripeEvent, object: Record<string, unknown>) {
  const paymentIntentId = getObjectString(object, "id")
  const orderId = getOrderIdFromStripeObject(object) || await findOrderIdByStoredPaymentReference({
    paymentIntentId,
  })
  if (!orderId) return

  const latestCharge = getObjectString(object, "latest_charge")

  await finalizePaidOrder({
    orderId,
    paymentMethod: "STRIPE",
    paymentReference: latestCharge || paymentIntentId || orderId,
    paymentSessionId: null,
    paymentIntentId: paymentIntentId || null,
    webhookEventId: event.id,
    eventDescription: "Stripe payment_intent.succeeded webhook confirmed payment",
  })
  await rememberProcessedEvent(orderId, event.id)
}

async function handlePaymentIntentFailed(event: StripeEvent, object: Record<string, unknown>) {
  const paymentIntentId = getObjectString(object, "id")
  const orderId = getOrderIdFromStripeObject(object) || await findOrderIdByStoredPaymentReference({
    paymentIntentId,
  })
  if (!orderId) return

  const latestCharge = getObjectString(object, "latest_charge")
  const lastPaymentError =
    object.last_payment_error && typeof object.last_payment_error === "object"
      ? (object.last_payment_error as Record<string, unknown>)
      : {}
  const failureMessage =
    getObjectString(lastPaymentError, "message") ||
    getObjectString(object, "last_payment_error")

  await markOrderPaymentFailed({
    orderId,
    paymentMethod: "STRIPE",
    paymentReference: latestCharge || paymentIntentId || null,
    paymentIntentId: paymentIntentId || null,
    webhookEventId: event.id,
    eventDescription: failureMessage
      ? `Stripe payment failed: ${failureMessage}`
      : "Stripe payment_intent.payment_failed webhook reported a failed payment",
  })
  await rememberProcessedEvent(orderId, event.id)
}

async function handleChargeRefunded(event: StripeEvent, object: Record<string, unknown>) {
  const metadata =
    object.metadata && typeof object.metadata === "object"
      ? (object.metadata as Record<string, unknown>)
      : {}
  const chargeId = getObjectString(object, "id")
  const paymentIntentId = getObjectString(object, "payment_intent")
  const orderId = getObjectString(metadata, "orderId") || await findOrderIdByStoredPaymentReference({
    paymentIntentId,
    sessionId: chargeId,
  })
  if (!orderId) return

  const amount = Number(object.amount || 0)
  const amountRefunded = Number(object.amount_refunded || 0)
  const refundedAmount = Math.max(0, amountRefunded) / 100
  const isFullRefund = amount > 0 && amountRefunded >= amount

  await markOrderRefunded({
    orderId,
    paymentMethod: "STRIPE",
    paymentReference: chargeId || null,
    paymentIntentId: paymentIntentId || null,
    webhookEventId: event.id,
    refundedAmount,
    isFullRefund,
    eventDescription: isFullRefund
      ? "Stripe charge.refunded webhook marked this order as refunded"
      : "Stripe charge.refunded webhook marked this order as partially refunded",
  })
  await rememberProcessedEvent(orderId, event.id)
}

async function handleChargeDisputeCreated(event: StripeEvent, object: Record<string, unknown>) {
  const metadata =
    object.metadata && typeof object.metadata === "object"
      ? (object.metadata as Record<string, unknown>)
      : {}
  const chargeId = getObjectString(object, "charge") || getObjectString(object, "id")
  const paymentIntentId = getObjectString(object, "payment_intent")
  const orderId = getObjectString(metadata, "orderId") || await findOrderIdByStoredPaymentReference({
    paymentIntentId,
    sessionId: chargeId,
  })
  if (!orderId) return

  const reason = getObjectString(object, "reason")
  const amount = Number(object.amount || 0)
  const amountText = amount > 0 ? `${(amount / 100).toFixed(2)} ${(getObjectString(object, "currency") || "usd").toUpperCase()}` : ""

  await prisma.orderEvent.create({
    data: {
      orderId,
      type: "PAYMENT",
      title: "Payment dispute created",
      description: [
        "Stripe charge.dispute.created webhook reported a dispute.",
        reason ? `Reason: ${reason}` : "",
        amountText ? `Amount: ${amountText}` : "",
      ].filter(Boolean).join(" "),
      actorType: "SYSTEM",
      isAdmin: false,
    },
  })
  await saveOrderDetails(orderId, {
    paymentProvider: "STRIPE",
    paymentMethod: "STRIPE",
    paymentReference: chargeId || null,
    paymentIntentId: paymentIntentId || null,
    paymentLastEventId: event.id,
  })
  await rememberProcessedEvent(orderId, event.id)
}

export async function POST(req: NextRequest) {
  try {
    const settings = await getSiteSettings()
    if (!settings.stripeWebhookSecret) {
      return NextResponse.json({ error: "Stripe webhook secret is not configured" }, { status: 400 })
    }

    const clientIp = getClientIp(req)
    if (!isAllowedIp(clientIp, settings.stripeAllowedIps || "")) {
      return NextResponse.json({ error: "Webhook IP is not allowed" }, { status: 403 })
    }

    const signatureHeader = req.headers.get("stripe-signature") || ""
    const payload = await req.text()
    if (!signatureHeader || !verifyStripeWebhookSignature({
      payload,
      signatureHeader,
      secret: settings.stripeWebhookSecret,
    })) {
      return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 })
    }

    const event = JSON.parse(payload) as StripeEvent
    const object =
      event.data?.object && typeof event.data.object === "object"
        ? (event.data.object as Record<string, unknown>)
        : null

    if (!event.id || !event.type || !object) {
      return NextResponse.json({ received: true, ignored: true })
    }

    const orderIdForClaim =
      getOrderIdFromStripeObject(object) ||
      await findOrderIdByStoredPaymentReference({
        sessionId: getObjectString(object, "id"),
        paymentIntentId: getPaymentIntentId(object) || getObjectString(object, "id"),
      }) ||
      null

    const claimed = await claimPaymentWebhookEvent({
      eventId: event.id,
      provider: "STRIPE",
      eventType: event.type,
      orderId: orderIdForClaim,
    })

    if (!claimed) {
      return NextResponse.json({ received: true, duplicate: true })
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(event, object)
          break
        case "payment_intent.succeeded":
          await handlePaymentIntentSucceeded(event, object)
          break
        case "payment_intent.payment_failed":
          await handlePaymentIntentFailed(event, object)
          break
        case "charge.refunded":
          await handleChargeRefunded(event, object)
          break
        case "charge.dispute.created":
          await handleChargeDisputeCreated(event, object)
          break
        default:
          break
      }
      await completePaymentWebhookEvent({
        eventId: event.id,
        provider: "STRIPE",
        orderId: orderIdForClaim,
      })
    } catch (error) {
      await failPaymentWebhookEvent({
        eventId: event.id,
        provider: "STRIPE",
        orderId: orderIdForClaim,
        error: error instanceof Error ? error.message : "Webhook processing failed",
      })
      throw error
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stripe webhook processing failed" },
      { status: 500 }
    )
  }
}
