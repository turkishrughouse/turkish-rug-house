import { createHash } from "crypto"
import bcrypt from "bcrypt"

const BCRYPT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex")
}

function isBcryptHash(stored: string) {
  return stored.startsWith("$2b$") || stored.startsWith("$2a$")
}

function isSha256Hash(stored: string) {
  return /^[0-9a-f]{64}$/i.test(stored)
}

export async function verifyPassword(
  storedPassword: string | null | undefined,
  plainPassword: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!storedPassword) return { valid: false, needsRehash: false }

  if (isBcryptHash(storedPassword)) {
    const valid = await bcrypt.compare(plainPassword, storedPassword)
    return { valid, needsRehash: false }
  }

  if (isSha256Hash(storedPassword)) {
    const valid = storedPassword === sha256Hex(plainPassword)
    return { valid, needsRehash: valid }
  }

  // Legacy plaintext fallback — treat as invalid to force reset
  return { valid: false, needsRehash: false }
}
