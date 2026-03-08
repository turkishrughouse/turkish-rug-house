import { createHash } from "crypto"

export function hashPassword(password: string) {
  return createHash("sha256").update(password).digest("hex")
}

export function verifyPassword(storedPassword: string | null | undefined, plainPassword: string) {
  if (!storedPassword) return false
  const hashed = hashPassword(plainPassword)
  return storedPassword === hashed || storedPassword === plainPassword
}
