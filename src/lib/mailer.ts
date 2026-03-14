import nodemailer from "nodemailer"
import { getSiteSettings } from "@/lib/site-settings"

type SendEmailInput = {
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
}

type SendEmailResult = {
  ok: boolean
  provider: "smtp" | "resend" | "none"
  error?: string
}

function envFirst(...values: Array<string | undefined | null>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim()
  }
  return ""
}

function parsePort(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 65535) return parsed
  return fallback
}

function parseBool(value: string | undefined, fallback: boolean) {
  if (!value) return fallback
  const normalized = value.trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(normalized)) return true
  if (["0", "false", "no", "off"].includes(normalized)) return false
  return fallback
}

function isEmailAddress(value: string | undefined) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
}

async function sendViaSmtp(input: {
  host: string
  port: number
  secure: boolean
  user?: string
  password?: string
  fromName: string
  fromEmail: string
  replyTo?: string
  to: string
  subject: string
  text: string
  html?: string
}) {
  const transporter = nodemailer.createTransport({
    host: input.host,
    port: input.port,
    secure: input.secure,
    auth: input.user && input.password ? { user: input.user, pass: input.password } : undefined,
    name: input.fromEmail.split("@")[1] || undefined,
  })

  await transporter.verify()

  await transporter.sendMail({
    from: `${input.fromName} <${input.fromEmail}>`,
    sender: isEmailAddress(input.user) ? `${input.fromName} <${input.user}>` : undefined,
    to: input.to,
    replyTo: input.replyTo || undefined,
    subject: input.subject,
    text: input.text,
    html: input.html,
    envelope: {
      from: input.user || input.fromEmail,
      to: input.to,
    },
  })
}

async function sendViaResend(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.NOTIFICATION_FROM_EMAIL || process.env.EMAIL_FROM || "Turkish Rug House <noreply@rughouse.com>"
  if (!apiKey) {
    return { ok: false, provider: "none" as const, error: "RESEND_API_KEY is missing" }
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html || `<p>${input.text}</p>`,
      text: input.text,
    }),
  }).catch((error) => {
    throw new Error(error instanceof Error ? error.message : "Resend request failed")
  })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Resend error ${response.status}${body ? `: ${body}` : ""}`)
  }
  return { ok: true, provider: "resend" as const }
}

export async function sendSiteEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const settings = await getSiteSettings()
  const host = envFirst(settings.outgoingMailHost, process.env.SMTP_HOST, process.env.MAIL_HOST)
  const port = parsePort(
    envFirst(String(settings.outgoingMailPort || ""), process.env.SMTP_PORT, process.env.MAIL_PORT),
    settings.outgoingMailPort
  )
  const secure =
    settings.outgoingMailSecure !== undefined
      ? Boolean(settings.outgoingMailSecure)
      : parseBool(process.env.SMTP_SECURE ?? process.env.MAIL_SECURE, true)
  const user = envFirst(settings.outgoingMailUser, process.env.SMTP_USER, process.env.MAIL_USER)
  const password = envFirst(
    settings.outgoingMailPassword,
    process.env.SMTP_PASSWORD,
    process.env.SMTP_PASS,
    process.env.MAIL_PASSWORD
  )
  const fromEmail = envFirst(
    settings.outgoingMailFromEmail,
    settings.supportEmail,
    process.env.SMTP_FROM_EMAIL,
    process.env.MAIL_FROM_EMAIL,
    process.env.NOTIFICATION_FROM_EMAIL,
    process.env.EMAIL_FROM,
    "info@turkishrughouse.com"
  )
  const fromName = envFirst(
    settings.outgoingMailFromName,
    process.env.SMTP_FROM_NAME,
    process.env.MAIL_FROM_NAME,
    "Turkish Rug House"
  )
  const replyTo = envFirst(input.replyTo, settings.outgoingMailReplyTo, process.env.SMTP_REPLY_TO, process.env.MAIL_REPLY_TO)

  if (host && port && fromEmail) {
    try {
      await sendViaSmtp({
        host,
        port,
        secure,
        user: user || undefined,
        password: password || undefined,
        fromName,
        fromEmail,
        replyTo: replyTo || undefined,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      })
      return { ok: true, provider: "smtp" }
    } catch (error) {
      const message = error instanceof Error ? error.message : "SMTP send failed"
      console.error("[mailer] SMTP send failed:", message)
      return { ok: false, provider: "smtp", error: message }
    }
  }

  try {
    return await sendViaResend(input)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resend send failed"
    console.error("[mailer] Resend send failed:", message)
    return { ok: false, provider: "resend", error: message }
  }
}

export async function hasOutgoingEmailDeliveryConfigured() {
  const settings = await getSiteSettings()
  const hasSmtp = Boolean(
    envFirst(settings.outgoingMailHost, process.env.SMTP_HOST, process.env.MAIL_HOST) &&
      envFirst(settings.outgoingMailFromEmail, process.env.SMTP_FROM_EMAIL, process.env.MAIL_FROM_EMAIL, process.env.NOTIFICATION_FROM_EMAIL, process.env.EMAIL_FROM)
  )
  const hasResend = Boolean(process.env.RESEND_API_KEY)
  return hasSmtp || hasResend
}
