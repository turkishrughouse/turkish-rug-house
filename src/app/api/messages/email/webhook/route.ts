import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { messageEvents } from "@/lib/message-events"
import { logWebhookEvent, sanitizeMetadata } from "@/lib/webhook-logger"
import { isSenderBlocked } from "@/lib/message-blocklist"
import crypto from "crypto"

export const dynamic = "force-dynamic"

/**
 * Verify webhook signature (Mailgun example)
 * Adjust based on your email provider
 */
function verifyWebhookSignature(
    timestamp: string,
    token: string,
    signature: string
): boolean {
    const webhookSecret = process.env.WEBHOOK_SECRET_EMAIL
    if (!webhookSecret) {
        console.warn("[Email Webhook] WEBHOOK_SECRET_EMAIL not configured")
        return false
    }

    const encodedToken = crypto
        .createHmac("sha256", webhookSecret)
        .update(timestamp + token)
        .digest("hex")

    return encodedToken === signature
}

/**
 * GET /api/messages/email/webhook
 * Webhook verification endpoint (for providers that require it)
 */
export async function GET(req: NextRequest) {
    // Some providers send a verification challenge
    const { searchParams } = new URL(req.url)
    const challenge = searchParams.get("challenge")

    if (challenge) {
        return new Response(challenge, { status: 200 })
    }

    return NextResponse.json({ status: "ok" })
}

/**
 * POST /api/messages/email/webhook
 * Receive inbound emails from email provider
 */
export async function POST(req: NextRequest) {
    try {
        // Parse form data (most email webhooks send form-encoded data)
        const formData = await req.formData()

        // Verify signature (Mailgun format)
        const timestamp = formData.get("timestamp") as string
        const token = formData.get("token") as string
        const signature = formData.get("signature") as string

        if (!verifyWebhookSignature(timestamp, token, signature)) {
            logWebhookEvent({
                timestamp: new Date().toISOString(),
                source: "EMAIL",
                event: "signature_verification_failed",
                status: "error",
            })
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
        }

        // Extract email data (Mailgun format)
        const from = formData.get("from") as string
        const sender = formData.get("sender") as string
        const subject = formData.get("subject") as string
        const bodyPlain = formData.get("body-plain") as string
        const bodyHtml = formData.get("body-html") as string
        const messageId = formData.get("Message-Id") as string
        const recipientEmail = formData.get("recipient") as string

        // Extract sender name and email
        const senderMatch = from?.match(/^(.+?)\s*<(.+?)>$/)
        const senderName = senderMatch ? senderMatch[1].trim() : null
        const senderEmail = senderMatch ? senderMatch[2].trim() : sender || from
        if (await isSenderBlocked(senderEmail, null)) {
            return NextResponse.json({ status: "blocked" }, { status: 202 })
        }

        // Check for duplicate using messageId
        if (messageId) {
            const existing = await prisma.message.findFirst({
                where: {
                    source: "EMAIL",
                    metadata: {
                        contains: messageId,
                    },
                },
            })

            if (existing) {
                logWebhookEvent({
                    timestamp: new Date().toISOString(),
                    source: "EMAIL",
                    event: "duplicate_message",
                    status: "success",
                    metadata: sanitizeMetadata({ messageId }),
                })
                return NextResponse.json({ status: "duplicate", message: "Message already received" })
            }
        }

        // Prepare metadata
        const metadata = {
            messageId,
            recipientEmail,
            receivedAt: new Date().toISOString(),
        }

        // Handle attachments (simplified - you may need to download and store them)
        const attachmentCount = parseInt(formData.get("attachment-count") as string || "0")
        const attachments: Array<{
            type: string
            url: string
            filename: string
            size: number
        }> = []

        for (let i = 1; i <= attachmentCount; i++) {
            const attachmentUrl = formData.get(`attachment-${i}`) as string
            const attachmentName = formData.get(`attachment-name-${i}`) as string
            const attachmentType = formData.get(`attachment-content-type-${i}`) as string

            if (attachmentUrl) {
                attachments.push({
                    type: attachmentType || "application/octet-stream",
                    url: attachmentUrl,
                    filename: attachmentName || `attachment-${i}`,
                    size: 0, // Size not provided by Mailgun in webhook
                })
            }
        }

        // Create message in database
        const newMessage = await prisma.message.create({
            data: {
                source: "EMAIL",
                status: "NEW",
                name: senderName,
                email: senderEmail,
                subject: subject || "(No Subject)",
                content: bodyPlain || bodyHtml || "(Empty message)",
                metadata: JSON.stringify(metadata),
                attachments: JSON.stringify(attachments),
            },
        })

        // Broadcast to admin via SSE
        messageEvents.broadcastNewMessage(newMessage)

        // Log success
        logWebhookEvent({
            timestamp: new Date().toISOString(),
            source: "EMAIL",
            event: "message_created",
            status: "success",
            metadata: sanitizeMetadata({ messageId: newMessage.id, from: senderEmail }),
        })

        return NextResponse.json({ status: "ok", messageId: newMessage.id })
    } catch (error) {
        console.error("[Email Webhook] Error:", error)
        logWebhookEvent({
            timestamp: new Date().toISOString(),
            source: "EMAIL",
            event: "webhook_processing_failed",
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
        })
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
    }
}
