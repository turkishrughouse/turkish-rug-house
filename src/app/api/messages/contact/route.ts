import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { contactFormSchema } from "@/lib/validations/message"
import { messageEvents } from "@/lib/message-events"
import { logWebhookEvent } from "@/lib/webhook-logger"
import { isSenderBlocked } from "@/lib/message-blocklist"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

// Simple in-memory rate limiting (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
    const now = Date.now()
    const limit = rateLimitMap.get(ip)

    if (!limit || now > limit.resetAt) {
        // Reset or create new limit
        rateLimitMap.set(ip, {
            count: 1,
            resetAt: now + 15 * 60 * 1000, // 15 minutes
        })
        return true
    }

    if (limit.count >= 5) {
        // Max 5 requests per 15 minutes
        return false
    }

    limit.count++
    return true
}

/**
 * POST /api/messages/contact
 * Public endpoint for contact form submissions
 */
export async function POST(req: NextRequest) {
    try {
        // Get client IP for rate limiting
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"

        // Check rate limit
        if (!checkRateLimit(ip)) {
            logger.warn("Contact rate limit exceeded", { ip }, "contact-api")
            logWebhookEvent({
                timestamp: new Date().toISOString(),
                source: "CONTACT",
                event: "rate_limit_exceeded",
                status: "error",
                error: `IP: ${ip}`,
            })
            return NextResponse.json(
                { error: "Too many requests. Please try again later." },
                { status: 429 }
            )
        }

        // Parse and validate request body
        const body = await req.json()
        const validationResult = contactFormSchema.safeParse(body)

        if (!validationResult.success) {
            logger.warn("Contact validation failed", { issues: validationResult.error.issues }, "contact-api")
            return NextResponse.json(
                { error: "Invalid form data", details: validationResult.error.issues },
                { status: 400 }
            )
        }

        const { name, email, phone, message, subject } = validationResult.data
        const blocked = await isSenderBlocked(email, phone)
        if (blocked) {
            logger.info("Blocked sender ignored", { email, phone }, "contact-api")
            return NextResponse.json(
                { success: true, message: "Message received" },
                { status: 202 }
            )
        }

        // Capture metadata
        const metadata = {
            pageUrl: req.headers.get("referer") || "unknown",
            userAgent: req.headers.get("user-agent") || "unknown",
            ip,
            submittedAt: new Date().toISOString(),
        }

        // Create message in database
        const newMessage = await prisma.message.create({
            data: {
                source: "CONTACT",
                status: "NEW",
                name,
                email,
                phone: phone || null,
                subject: subject || null,
                content: message,
                metadata: JSON.stringify(metadata),
                attachments: "[]",
            },
        })

        // Broadcast to admin via SSE
        messageEvents.broadcastNewMessage(newMessage)

        // Log success
        logger.info("Contact message created", { messageId: newMessage.id }, "contact-api")
        logWebhookEvent({
            timestamp: new Date().toISOString(),
            source: "CONTACT",
            event: "message_created",
            status: "success",
            metadata: { messageId: newMessage.id },
        })

        return NextResponse.json(
            { success: true, message: "Your message has been sent successfully!" },
            { status: 201 }
        )
    } catch (error) {
        logger.error(
            "Contact form API error",
            { error: error instanceof Error ? error.message : String(error) },
            "contact-api"
        )
        logWebhookEvent({
            timestamp: new Date().toISOString(),
            source: "CONTACT",
            event: "message_creation_failed",
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
        })
        return NextResponse.json(
            { error: "Failed to send message. Please try again later." },
            { status: 500 }
        )
    }
}
