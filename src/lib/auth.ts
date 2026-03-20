import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"

export const LEGACY_AUTH_COOKIE_NAME = "rughouse_admin_session"
export const ADMIN_AUTH_COOKIE_NAME = "rughouse_admin_session_admin"
export const CUSTOMER_AUTH_COOKIE_NAME = "rughouse_customer_session"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365

type SessionPayload = {
  id: string
  email: string
  name: string | null
  role: string
  exp: number
}

type SessionUser = {
  id: string
  email: string
  name: string | null
  role: string
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (typeof secret === "string" && secret.trim().length > 0) {
    return secret.trim()
  }
  if (process.env.NODE_ENV !== "production") {
    return "rughouse-dev-auth-secret"
  }
  throw new Error("AUTH_SECRET or NEXTAUTH_SECRET is required in production")
}

export function shouldUseSecureCookies(hostname?: string | null) {
  const normalizedHost = (hostname || "").trim().toLowerCase()
  if (normalizedHost === "localhost" || normalizedHost === "127.0.0.1" || normalizedHost === "::1") {
    return false
  }
  return process.env.NODE_ENV === "production"
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url")
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function signValue(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url")
}

export function createSessionToken(user: SessionUser) {
  const payload: SessionPayload = {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }

  const encoded = base64UrlEncode(JSON.stringify(payload))
  const signature = signValue(encoded)
  return `${encoded}.${signature}`
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.includes(".")) return null
  const [encoded, signature] = token.split(".")
  if (!encoded || !signature) return null

  const expected = signValue(encoded)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as SessionPayload
    if (!payload?.id || !payload?.email || !payload?.role || !payload?.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export type SessionPortal = "admin" | "customer"

function getCookieNamesForPortal(portal: SessionPortal) {
  if (portal === "admin") {
    return [ADMIN_AUTH_COOKIE_NAME, LEGACY_AUTH_COOKIE_NAME]
  }
  return [CUSTOMER_AUTH_COOKIE_NAME]
}

export async function getSessionUser(portal: SessionPortal = "customer"): Promise<SessionUser | null> {
  const store = await cookies()

  for (const cookieName of getCookieNamesForPortal(portal)) {
    const raw = store.get(cookieName)?.value
    if (!raw) continue

    const payload = verifySessionToken(raw)
    if (!payload) continue

    let user: { id: string; email: string; name: string | null; role: string } | null = null
    try {
      user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, name: true, role: true },
      })
    } catch (error) {
      console.error("[auth] failed to resolve session user", error)
      continue
    }

    if (user) return user
  }

  return null
}

export function getAuthCookieName(portal: SessionPortal = "customer") {
  return portal === "admin" ? ADMIN_AUTH_COOKIE_NAME : CUSTOMER_AUTH_COOKIE_NAME
}

export function getLegacyAuthCookieName() {
  return LEGACY_AUTH_COOKIE_NAME
}

export function getSessionMaxAge() {
  return SESSION_TTL_SECONDS
}
