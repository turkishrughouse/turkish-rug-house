import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { trackLiveVisitorActivity } from "@/lib/live-visitor-activity"

const VISITOR_COOKIE = "rughouse_vid"

function normalizeCountryCode(input: unknown): string | null {
  if (typeof input !== "string") return null
  const value = input.trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(value)) return value
  return null
}

function parseCountryFromHeaders(req: NextRequest): string | null {
  const headerCountry =
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-country-code")
  return normalizeCountryCode(headerCountry)
}

function parseCountryFromAcceptLanguage(header: string | null): string | null {
  if (!header) return null
  const lower = header.toLowerCase()
  if (lower.includes("tr")) return "TR"
  if (lower.includes("en-us")) return "US"
  return null
}

function normalizePath(input: unknown): string | null {
  if (typeof input !== "string") return null
  const value = input.trim()
  if (!value || value.toLowerCase() === "unknown") return null

  if (value.startsWith("/")) {
    return value.split(/[?#]/)[0] || null
  }

  try {
    const url = new URL(value)
    return url.pathname || null
  } catch {
    return null
  }
}

function createVisitorId() {
  return `v_${crypto.randomUUID().replace(/-/g, "")}`
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser("customer")
    let payload: {
      country?: string
      path?: string
      pathname?: string
      href?: string
      action?: string
      pageTitle?: string
      hoverLabel?: string
      hoverType?: string
    } = {}
    try {
      payload = (await req.json()) as { country?: string; path?: string; pathname?: string; href?: string; action?: string }
    } catch {
      // payload optional
    }

    const countryCode =
      normalizeCountryCode(payload.country) ||
      parseCountryFromHeaders(req) ||
      parseCountryFromAcceptLanguage(req.headers.get("accept-language"))

    const requestPath =
      normalizePath(payload.path) ||
      normalizePath(payload.pathname) ||
      normalizePath(payload.href) ||
      normalizePath(req.headers.get("referer"))

    const existingVisitorId = req.cookies.get(VISITOR_COOKIE)?.value || ""
    const visitorId = existingVisitorId || createVisitorId()
    const actorKey = user?.role === "CUSTOMER" ? user.id : `guest:${visitorId}`

    trackLiveVisitorActivity({
      actorKey,
      countryCode,
      customerName: user?.name || (user?.email ? user.email.split("@")[0] : "Guest"),
      path: requestPath,
      userAgent: req.headers.get("user-agent"),
      pageTitle: typeof payload.pageTitle === "string" ? payload.pageTitle : undefined,
      hoverLabel: typeof payload.hoverLabel === "string" ? payload.hoverLabel : undefined,
      hoverType: typeof payload.hoverType === "string" ? payload.hoverType : undefined,
      action:
        typeof payload.action === "string" && payload.action.trim()
          ? payload.action.trim()
          : user?.role === "CUSTOMER"
            ? "Customer online"
            : "Guest visit",
    })

    if (user?.role === "CUSTOMER") {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
        select: { id: true },
      })

      if (countryCode) {
        await prisma.customerProfile.upsert({
          where: { userId: user.id },
          update: {
            country: countryCode,
            updatedAt: new Date(),
          },
          create: {
            userId: user.id,
            country: countryCode,
          },
        })
      }
    }

    const response = NextResponse.json({ ok: true })
    if (!existingVisitorId) {
      response.cookies.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      })
    }
    return response
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
