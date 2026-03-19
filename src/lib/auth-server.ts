import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import {
  ADMIN_AUTH_COOKIE_NAME,
  CUSTOMER_AUTH_COOKIE_NAME,
  LEGACY_AUTH_COOKIE_NAME,
  type SessionPortal,
  verifySessionToken,
} from "./auth"

type SessionUser = {
  id: string
  email: string
  name: string | null
  role: string
}

function getCookieNamesForPortal(portal: SessionPortal) {
  if (portal === "admin" || portal === "inventory" || portal === "dealer") {
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

