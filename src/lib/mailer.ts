import net from "node:net"
import tls from "node:tls"
import { getSiteSettings } from "@/lib/site-settings"

type SendEmailInput = {
  to: string
  subject: string
  text: string
  html?: string
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

function encodeBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64")
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]/g, " ").trim()
}

function buildMimeMessage(input: {
  fromName: string
  fromEmail: string
  replyTo?: string
  to: string
  subject: string
  text: string
  html?: string
}) {
  const fromName = sanitizeHeader(input.fromName || "Turkish Rug House")
  const fromEmail = sanitizeHeader(input.fromEmail)
  const to = sanitizeHeader(input.to)
  const subject = sanitizeHeader(input.subject)
  const replyTo = sanitizeHeader(input.replyTo || "")

  if (input.html) {
    const boundary = `rughouse_${Date.now()}_${Math.random().toString(16).slice(2)}`
    return [
      `From: ${fromName} <${fromEmail}>`,
      `To: <${to}>`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      input.text,
      "",
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      input.html,
      "",
      `--${boundary}--`,
      "",
    ].join("\r\n")
  }

  return [
    `From: ${fromName} <${fromEmail}>`,
    `To: <${to}>`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    "",
  ].join("\r\n")
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
  const socket = (input.secure
    ? tls.connect({ host: input.host, port: input.port, servername: input.host })
    : net.connect({ host: input.host, port: input.port })) as net.Socket

  socket.setEncoding("utf8")
  socket.setTimeout(20000)

  let buffer = ""
  const queue: Array<(line: string) => void> = []

  const nextLine = () =>
    new Promise<string>((resolve) => {
      queue.push(resolve)
    })

  const flushBuffer = () => {
    let idx = buffer.indexOf("\n")
    while (idx >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, "")
      buffer = buffer.slice(idx + 1)
      const resolve = queue.shift()
      if (resolve) resolve(line)
      idx = buffer.indexOf("\n")
    }
  }

  socket.on("data", (chunk: string) => {
    buffer += chunk
    flushBuffer()
  })

  await new Promise<void>((resolve, reject) => {
    socket.once("error", reject)
    socket.once("timeout", () => reject(new Error("SMTP connection timeout")))
    socket.once("connect", () => resolve())
  })

  const readResponse = async (acceptedStarts: string[]) => {
    let last = ""
    for (;;) {
      const line = await nextLine()
      last = line
      const code = line.slice(0, 3)
      const separator = line[3]
      if (separator === "-") continue
      if (!acceptedStarts.includes(code)) {
        throw new Error(`SMTP error: ${line}`)
      }
      return last
    }
  }

  const command = async (value: string, accepted: string[]) => {
    socket.write(`${value}\r\n`)
    await readResponse(accepted)
  }

  try {
    await readResponse(["220"])
    await command("EHLO rughouse.local", ["250"])

    if (input.user && input.password) {
      await command("AUTH LOGIN", ["334"])
      await command(encodeBase64(input.user), ["334"])
      await command(encodeBase64(input.password), ["235"])
    }

    await command(`MAIL FROM:<${sanitizeHeader(input.fromEmail)}>`, ["250"])
    await command(`RCPT TO:<${sanitizeHeader(input.to)}>`, ["250", "251"])
    await command("DATA", ["354"])

    const mime = buildMimeMessage(input)
    socket.write(`${mime}\r\n.\r\n`)
    await readResponse(["250"])
    await command("QUIT", ["221"])
  } finally {
    socket.destroy()
  }
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
  const port = parsePort(envFirst(process.env.SMTP_PORT, process.env.MAIL_PORT), settings.outgoingMailPort)
  const secure = parseBool(process.env.SMTP_SECURE ?? process.env.MAIL_SECURE, settings.outgoingMailSecure)
  const user = envFirst(settings.outgoingMailUser, process.env.SMTP_USER, process.env.MAIL_USER)
  const password = envFirst(settings.outgoingMailPassword, process.env.SMTP_PASSWORD, process.env.SMTP_PASS, process.env.MAIL_PASSWORD)
  const fromEmail = envFirst(settings.outgoingMailFromEmail, process.env.SMTP_FROM_EMAIL, process.env.MAIL_FROM_EMAIL, process.env.NOTIFICATION_FROM_EMAIL, process.env.EMAIL_FROM)
  const fromName = envFirst(settings.outgoingMailFromName, process.env.SMTP_FROM_NAME, process.env.MAIL_FROM_NAME, "Turkish Rug House")
  const replyTo = envFirst(settings.outgoingMailReplyTo, process.env.SMTP_REPLY_TO, process.env.MAIL_REPLY_TO)

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
