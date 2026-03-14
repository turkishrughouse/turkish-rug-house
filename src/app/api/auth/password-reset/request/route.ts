import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { checkFixedWindowRateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { issuePasswordResetTokenForEmail, getPasswordResetTtlMinutes } from "@/lib/password-reset"
import { getPasswordResetUrl } from "@/lib/password-reset-routes"
import { buildPasswordResetEmail } from "@/lib/password-reset-email"
import { hasOutgoingEmailDeliveryConfigured, sendSiteEmail } from "@/lib/mailer"
import { toAbsoluteSiteUrl } from "@/lib/site-url"
import { getSiteSettings } from "@/lib/site-settings"

const requestSchema = z.object({
  email: z.string().email("Valid email is required"),
})

function getClientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
}

export async function POST(req: NextRequest) {
  try {
    const successMessage = "If an account with that email exists, a password reset link has been sent."
    const clientIp = getClientIp(req)
    const rateLimit = checkFixedWindowRateLimit({
      scope: "password-reset-request",
      key: clientIp,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    })

    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
    }

    const body = await req.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 })
    }

    const deliveryConfigured = await hasOutgoingEmailDeliveryConfigured()
    if (!deliveryConfigured) {
      logger.error("Password reset email delivery is not configured", {}, "password-reset")
      return NextResponse.json({ error: "Unable to send reset email. Please try again." }, { status: 503 })
    }

    const result = await issuePasswordResetTokenForEmail(parsed.data.email)
    if (!result.user || !result.token || !result.expiresAt) {
      return NextResponse.json({
        success: true,
        message: successMessage,
      })
    }

    const settings = await getSiteSettings()
    const resetLink = toAbsoluteSiteUrl(getPasswordResetUrl(result.token))
    const expiresInMinutes = getPasswordResetTtlMinutes()
    const recipientName = result.user.name?.trim() || "Customer"
    const emailContent = buildPasswordResetEmail({
      recipientName,
      resetLink,
      expiresInMinutes,
      supportEmail: settings.supportEmail,
      siteName: settings.siteName,
    })
    const mailResult = await sendSiteEmail({
      to: result.user.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    })

    if (!mailResult.ok) {
      logger.error(
        "Password reset email delivery failed",
        { email: result.user.email, provider: mailResult.provider, error: mailResult.error },
        "password-reset"
      )
      return NextResponse.json({ error: "Unable to send reset email. Please try again." }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      message: successMessage,
    })
  } catch (error) {
    logger.error(
      "Password reset request failed",
      { error: error instanceof Error ? error.message : String(error) },
      "password-reset"
    )
    return NextResponse.json({ error: "Unable to process password reset right now." }, { status: 500 })
  }
}
