import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/db"
import { hashPassword } from "@/lib/password"

const PASSWORD_RESET_TTL_MINUTES = 45

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function createPasswordResetToken() {
  return randomBytes(32).toString("hex")
}

export async function issuePasswordResetTokenForEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return { user: null as null, token: null as null, expiresAt: null as Date | null }

  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      role: "CUSTOMER",
    },
    select: {
      id: true,
      email: true,
      name: true,
      isBlocked: true,
    },
  })

  if (!user || user.isBlocked) {
    return { user: null as null, token: null as null, expiresAt: null as Date | null }
  }

  const token = createPasswordResetToken()
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: hashToken(token),
      passwordResetExpiresAt: expiresAt,
    },
  })

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    token,
    expiresAt,
  }
}

export async function validatePasswordResetToken(token: string) {
  const normalized = token.trim()
  if (!normalized) return null

  const now = new Date()
  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: hashToken(normalized),
      passwordResetExpiresAt: { gt: now },
      role: "CUSTOMER",
    },
    select: {
      id: true,
      email: true,
      name: true,
      passwordResetExpiresAt: true,
    },
  })

  if (!user) return null
  return user
}

export async function consumePasswordResetToken(token: string, nextPassword: string) {
  const user = await validatePasswordResetToken(token)
  if (!user) return { success: false as const, reason: "invalid_or_expired" as const }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(nextPassword),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  })

  return {
    success: true as const,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  }
}

export function getPasswordResetTtlMinutes() {
  return PASSWORD_RESET_TTL_MINUTES
}
