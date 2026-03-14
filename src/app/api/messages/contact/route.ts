import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { contactFormSchema } from "@/lib/validations/message"
import { messageEvents } from "@/lib/message-events"
import { logWebhookEvent } from "@/lib/webhook-logger"
import { isSenderBlocked } from "@/lib/message-blocklist"
import { logger } from "@/lib/logger"
import { checkFixedWindowRateLimit } from "@/lib/rate-limit"
import { getSiteSettings } from "@/lib/site-settings"
import { sendSiteEmail } from "@/lib/mailer"

export const dynamic = "force-dynamic"

/**
 * POST /api/messages/contact
 * Public endpoint for contact form submissions
 */
export async function POST(req: NextRequest) {
    try {
        // Get client IP for rate limiting
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"

        // Check rate limit
        const rateLimit = checkFixedWindowRateLimit({
            scope: "contact-form",
            key: ip,
            limit: 5,
            windowMs: 15 * 60 * 1000,
        })
        if (!rateLimit.allowed) {
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

        const settings = await getSiteSettings()
        const submittedAt = metadata.submittedAt
        const recipient = (settings.supportEmail || "info@turkishrughouse.com").trim() || "info@turkishrughouse.com"
        const timestamp = new Date(submittedAt).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Europe/Istanbul",
        })
        const isProductQuestion = typeof subject === "string" && subject.trim().toLowerCase().startsWith("product question -")
        const introLine = isProductQuestion ? "New product question submission" : "New contact form submission"
        const textLines = [
            introLine,
            "",
            `Name: ${name}`,
            `Email: ${email}`,
            `Phone: ${phone || "-"}`,
            `Timestamp: ${timestamp}`,
            "",
            "Message:",
            message,
        ]

        const mailResult = await sendSiteEmail({
            to: recipient,
            subject: subject?.trim() || `Contact form message from ${name}`,
            text: textLines.join("\n"),
            replyTo: email,
            html: [
                `<p><strong>${introLine}</strong></p>`,
                `<p><strong>Name:</strong> ${name}</p>`,
                `<p><strong>Email:</strong> ${email}</p>`,
                `<p><strong>Phone:</strong> ${phone || "-"}</p>`,
                `<p><strong>Timestamp:</strong> ${timestamp}</p>`,
                `<p><strong>Message:</strong></p>`,
                `<p>${message.replace(/\n/g, "<br/>")}</p>`,
            ].join(""),
        })

        if (!mailResult.ok) {
            logger.error(
                "Contact email delivery failed",
                { messageId: newMessage.id, provider: mailResult.provider, error: mailResult.error },
                "contact-api"
            )
            logWebhookEvent({
                timestamp: new Date().toISOString(),
                source: "CONTACT",
                event: "message_email_failed",
                status: "error",
                error: mailResult.error || "Unknown email delivery failure",
                metadata: { messageId: newMessage.id, provider: mailResult.provider },
            })
            return NextResponse.json(
                { error: "Message saved but email delivery failed. Please verify SMTP settings." },
                { status: 502 }
            )
        }

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
