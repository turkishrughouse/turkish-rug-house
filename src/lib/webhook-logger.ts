/**
 * Webhook Logger Utility
 * Logs webhook events with PII masking for security
 */

interface WebhookLogEntry {
    timestamp: string
    source: "EMAIL" | "WHATSAPP" | "CONTACT"
    event: string
    status: "success" | "error"
    error?: string
    metadata?: Record<string, any>
}

/**
 * Mask email addresses for logging
 * Example: john.doe@example.com -> j***@example.com
 */
export function maskEmail(email: string): string {
    if (!email || !email.includes("@")) return "***"
    const [local, domain] = email.split("@")
    const maskedLocal = local.length > 2 ? local[0] + "***" : "***"
    return `${maskedLocal}@${domain}`
}

/**
 * Mask phone numbers for logging
 * Example: +1234567890 -> +***7890
 */
export function maskPhone(phone: string): string {
    if (!phone || phone.length < 4) return "***"
    return phone.slice(0, 1) + "***" + phone.slice(-4)
}

/**
 * Log webhook event to console (in production, this could write to a file or external service)
 */
export function logWebhookEvent(entry: WebhookLogEntry): void {
    const logEntry = {
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString(),
    }

    // In development, log to console
    if (process.env.NODE_ENV === "development") {
        if (entry.status === "error") {
            console.error("[Webhook Error]", logEntry)
        } else {
            console.log("[Webhook Success]", logEntry)
        }
    }

    // In production, you might want to:
    // - Write to a log file
    // - Send to a logging service (e.g., Sentry, LogRocket)
    // - Store in a separate database table
}

/**
 * Sanitize metadata object by masking PII
 */
export function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata }

    // Mask email fields
    if (sanitized.email) {
        sanitized.email = maskEmail(sanitized.email)
    }
    if (sanitized.from) {
        sanitized.from = maskEmail(sanitized.from)
    }

    // Mask phone fields
    if (sanitized.phone) {
        sanitized.phone = maskPhone(sanitized.phone)
    }
    if (sanitized.wa_id) {
        sanitized.wa_id = maskPhone(sanitized.wa_id)
    }

    // Remove sensitive fields
    delete sanitized.ip
    delete sanitized.userAgent

    return sanitized
}
