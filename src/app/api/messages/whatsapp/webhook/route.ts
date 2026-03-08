import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { messageEvents } from "@/lib/message-events"
import { logWebhookEvent, sanitizeMetadata } from "@/lib/webhook-logger"
import { isSenderBlocked } from "@/lib/message-blocklist"
import crypto from "crypto"

export const dynamic = "force-dynamic"

/**
 * Verify WhatsApp webhook signature
 */
function verifyWhatsAppSignature(body: string, signature: string | null): boolean {
    if (!signature) return false

    const appSecret = process.env.WHATSAPP_APP_SECRET
    if (!appSecret) {
        console.warn("[WhatsApp Webhook] WHATSAPP_APP_SECRET not configured")
        return false
    }

    const expectedSignature = crypto
        .createHmac("sha256", appSecret)
        .update(body)
        .digest("hex")

    return `sha256=${expectedSignature}` === signature
}

/**
 * GET /api/messages/whatsapp/webhook
 * Verify webhook challenge token
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get("hub.mode")
    const token = searchParams.get("hub.verify_token")
    const challenge = searchParams.get("hub.challenge")

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

    if (mode === "subscribe" && token === verifyToken) {
        console.log("[WhatsApp Webhook] Verification successful")
        return new Response(challenge, { status: 200 })
    }

    console.warn("[WhatsApp Webhook] Verification failed")
    return NextResponse.json({ error: "Verification failed" }, { status: 403 })
}

/**
 * POST /api/messages/whatsapp/webhook
 * Receive inbound WhatsApp messages
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.text()
        const signature = req.headers.get("x-hub-signature-256")

        // Verify signature
        if (!verifyWhatsAppSignature(body, signature)) {
            logWebhookEvent({
                timestamp: new Date().toISOString(),
                source: "WHATSAPP",
                event: "signature_verification_failed",
                status: "error",
            })
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
        }

        const payload = JSON.parse(body)

        // Validate payload structure
        if (payload.object !== "whatsapp_business_account") {
            return NextResponse.json({ status: "ok" }) // Not a message event
        }

        // Process each entry
        for (const entry of payload.entry || []) {
            for (const change of entry.changes || []) {
                const value = change.value

                // Only process messages
                if (!value.messages || value.messages.length === 0) {
                    continue
                }

                for (const message of value.messages) {
                    const messageId = message.id
                    const from = message.from
                    const timestamp = message.timestamp
                    const messageType = message.type
                    if (await isSenderBlocked(null, from)) {
                        continue
                    }

                    // Check for duplicate
                    const existing = await prisma.message.findFirst({
                        where: {
                            source: "WHATSAPP",
                            metadata: {
                                contains: messageId,
                            },
                        },
                    })

                    if (existing) {
                        logWebhookEvent({
                            timestamp: new Date().toISOString(),
                            source: "WHATSAPP",
                            event: "duplicate_message",
                            status: "success",
                            metadata: sanitizeMetadata({ messageId }),
                        })
                        continue
                    }

                    // Extract message content based on type
                    let content = ""
                    const attachments: Array<{
                        type: string
                        url: string
                        filename: string
                        mediaId: string
                    }> = []

                    if (messageType === "text" && message.text) {
                        content = message.text.body
                    } else if (messageType === "image" && message.image) {
                        content = "[Image message]"
                        attachments.push({
                            type: "image",
                            url: "", // You would need to download this using WhatsApp Media API
                            filename: `whatsapp-image-${messageId}.jpg`,
                            mediaId: message.image.id,
                        })
                    } else if (messageType === "video" && message.video) {
                        content = "[Video message]"
                        attachments.push({
                            type: "video",
                            url: "",
                            filename: `whatsapp-video-${messageId}.mp4`,
                            mediaId: message.video.id,
                        })
                    } else if (messageType === "document" && message.document) {
                        content = "[Document message]"
                        attachments.push({
                            type: "document",
                            url: "",
                            filename: message.document.filename || `document-${messageId}`,
                            mediaId: message.document.id,
                        })
                    } else if (messageType === "audio" && message.audio) {
                        content = "[Audio message]"
                        attachments.push({
                            type: "audio",
                            url: "",
                            filename: `whatsapp-audio-${messageId}.ogg`,
                            mediaId: message.audio.id,
                        })
                    } else {
                        content = `[${messageType} message]`
                    }

                    // Get contact name if available
                    const contactName = value.contacts?.[0]?.profile?.name || null

                    // Prepare metadata
                    const metadata = {
                        messageId,
                        phoneNumberId: value.metadata.phone_number_id,
                        displayPhoneNumber: value.metadata.display_phone_number,
                        timestamp,
                        messageType,
                    }

                    // Create message in database
                    const newMessage = await prisma.message.create({
                        data: {
                            source: "WHATSAPP",
                            status: "NEW",
                            name: contactName,
                            phone: from,
                            content,
                            metadata: JSON.stringify(metadata),
                            attachments: JSON.stringify(attachments),
                        },
                    })

                    // Broadcast to admin via SSE
                    messageEvents.broadcastNewMessage(newMessage)

                    // Log success
                    logWebhookEvent({
                        timestamp: new Date().toISOString(),
                        source: "WHATSAPP",
                        event: "message_created",
                        status: "success",
                        metadata: sanitizeMetadata({ messageId: newMessage.id, from }),
                    })
                }
            }
        }

        return NextResponse.json({ status: "ok" })
    } catch (error) {
        console.error("[WhatsApp Webhook] Error:", error)
        logWebhookEvent({
            timestamp: new Date().toISOString(),
            source: "WHATSAPP",
            event: "webhook_processing_failed",
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
        })
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
    }
}
