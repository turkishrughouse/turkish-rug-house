import { createHash, randomBytes } from "node:crypto"
import { sendSiteEmail } from "@/lib/mailer"

const VERIFY_TTL_MS = 1000 * 60 * 60 * 24 // 24h

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex")
}

export function createEmailVerificationToken() {
  const rawToken = randomBytes(32).toString("hex")
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + VERIFY_TTL_MS)
  return { rawToken, tokenHash, expiresAt }
}

export function hashEmailVerificationToken(rawToken: string) {
  return hashToken(rawToken)
}

export async function sendEmailVerificationMessage(input: {
  to: string
  name?: string | null
  verifyUrl: string
}) {
  const safeName = input.name?.trim() || "there"
  const subject = "Confirm your email - Turkish Rug House"
  const text = [
    `Hello ${safeName},`,
    "",
    "Please confirm your email address to activate your customer account.",
    `Verification link: ${input.verifyUrl}`,
    "",
    "This link expires in 24 hours.",
    "",
    "Turkish Rug House",
  ].join("\n")
  const html = [
    `<p>Hello ${safeName},</p>`,
    `<p>Please confirm your email address to activate your customer account.</p>`,
    `<p><a href="${input.verifyUrl}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#0f766e;color:#fff;text-decoration:none;font-weight:600;">Confirm Email</a></p>`,
    `<p>If the button does not work, use this link:<br/><a href="${input.verifyUrl}">${input.verifyUrl}</a></p>`,
    `<p style="color:#64748b;">This link expires in 24 hours.</p>`,
    `<p>Turkish Rug House</p>`,
  ].join("")

  const result = await sendSiteEmail({
    to: input.to,
    subject,
    text,
    html,
  })
  if (!result.ok) {
    throw new Error(result.error || "Email delivery is not configured")
  }
}
