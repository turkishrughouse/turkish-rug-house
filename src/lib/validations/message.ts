import { z } from "zod"

// Message Source and Status constants
export const MessageSource = {
    WHATSAPP: "WHATSAPP",
    EMAIL: "EMAIL",
    CONTACT: "CONTACT",
    REVIEW: "REVIEW",
    CUSTOMER: "CUSTOMER",
} as const

export const MessageStatus = {
    NEW: "NEW",
    OPEN: "OPEN",
    RESOLVED: "RESOLVED",
    BLOCKED: "BLOCKED",
} as const

// Contact Form Validation Schema
export const contactFormSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
    message: z.string().min(10, "Message must be at least 10 characters"),
    subject: z.string().optional(),
})

export type ContactFormData = z.infer<typeof contactFormSchema>

// Message Update Schema (for admin)
export const messageUpdateSchema = z.object({
    status: z.enum(["NEW", "OPEN", "RESOLVED", "BLOCKED"]).optional(),
    notes: z.string().optional(),
})

export type MessageUpdateData = z.infer<typeof messageUpdateSchema>

// Email Webhook Payload Schema
export const emailWebhookSchema = z.object({
    from: z.string().email(),
    subject: z.string(),
    "body-plain": z.string().optional(),
    "body-html": z.string().optional(),
    "Message-Id": z.string(),
    timestamp: z.string().or(z.number()).optional(),
    // Attachments will be handled separately
})

export type EmailWebhookPayload = z.infer<typeof emailWebhookSchema>

// WhatsApp Webhook Payload Schema
export const whatsappWebhookSchema = z.object({
    object: z.literal("whatsapp_business_account"),
    entry: z.array(
        z.object({
            id: z.string(),
            changes: z.array(
                z.object({
                    value: z.object({
                        messaging_product: z.literal("whatsapp"),
                        metadata: z.object({
                            display_phone_number: z.string(),
                            phone_number_id: z.string(),
                        }),
                        contacts: z.array(
                            z.object({
                                profile: z.object({
                                    name: z.string(),
                                }),
                                wa_id: z.string(),
                            })
                        ).optional(),
                        messages: z.array(
                            z.object({
                                from: z.string(),
                                id: z.string(),
                                timestamp: z.string(),
                                type: z.enum(["text", "image", "video", "document", "audio"]),
                                text: z.object({
                                    body: z.string(),
                                }).optional(),
                                image: z.object({
                                    id: z.string(),
                                    mime_type: z.string(),
                                }).optional(),
                                video: z.object({
                                    id: z.string(),
                                    mime_type: z.string(),
                                }).optional(),
                                document: z.object({
                                    id: z.string(),
                                    mime_type: z.string(),
                                    filename: z.string().optional(),
                                }).optional(),
                            })
                        ).optional(),
                    }),
                    field: z.string(),
                })
            ),
        })
    ),
})

export type WhatsAppWebhookPayload = z.infer<typeof whatsappWebhookSchema>

// Message List Query Schema
export const messageListQuerySchema = z.object({
    source: z.enum(["WHATSAPP", "EMAIL", "CONTACT", "REVIEW", "CUSTOMER", "ALL"]).optional(),
    status: z.enum(["NEW", "OPEN", "RESOLVED", "BLOCKED", "ALL"]).optional(),
    q: z.string().optional(), // search query
    country: z.string().max(120).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    from: z.string().optional(), // date range start
    to: z.string().optional(), // date range end
})

export const messageBulkActionSchema = z.object({
    ids: z.array(z.string().min(1)).min(1).max(200),
    action: z.enum(["mark_read", "delete", "block", "unblock"]),
})

export type MessageListQuery = z.infer<typeof messageListQuerySchema>
