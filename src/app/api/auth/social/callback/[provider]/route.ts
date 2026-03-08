import { createHmac } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createSessionToken, getAuthCookieName, getSessionMaxAge } from "@/lib/auth"
import { createCustomerMessage } from "@/lib/customer-messaging"

const OAUTH_STATE_COOKIE = "rughouse_oauth_state"

function authSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "rughouse-dev-auth-secret"
}

function signState(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("hex")
}

function verifyState(rawState: string | undefined, cookieState: string | undefined) {
  if (!rawState || !cookieState || rawState !== cookieState) return null
  const [payload, signature] = rawState.split(".")
  if (!payload || !signature) return null
  const expected = signState(payload)
  if (signature !== expected) return null
  const [provider, redirectTo] = payload.split(":")
  if (!provider || !redirectTo) return null
  return { provider, redirectTo: redirectTo.startsWith("/") ? redirectTo : "/account" }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".")
  if (parts.length < 2) return null
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>
  } catch {
    return null
  }
}

async function upsertSocialUser(input: {
  provider: "GOOGLE" | "APPLE"
  providerAccountId: string
  email: string
  name?: string | null
}) {
  const email = input.email.toLowerCase()

  const byProvider = await prisma.user.findFirst({
    where: { provider: input.provider, providerAccountId: input.providerAccountId },
  })
  if (byProvider) {
    if (byProvider.role !== "CUSTOMER") {
      throw new Error("This social account is linked to admin. Use admin login.")
    }
    return byProvider
  }

  const byEmail = await prisma.user.findUnique({ where: { email } })
  if (byEmail) {
    if (byEmail.role !== "CUSTOMER") {
      throw new Error("This email belongs to admin. Use admin login.")
    }
    return prisma.user.update({
      where: { id: byEmail.id },
      data: {
        provider: byEmail.provider || input.provider,
        providerAccountId: byEmail.providerAccountId || input.providerAccountId,
        name: byEmail.name || input.name || null,
        lastLoginAt: new Date(),
      },
    })
  }

  const created = await prisma.user.create({
    data: {
      email,
      name: input.name || null,
      role: "CUSTOMER",
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      lastLoginAt: new Date(),
    },
  })

  await createCustomerMessage(created.id, {
    kind: "SYSTEM",
    title: "Welcome to Turkish Rug House",
    content: "Your social login is connected. You can track orders and messages from your account.",
    ctaLabel: "Open account",
    ctaUrl: "/account",
  })

  return created
}

function sessionResponse(
  user: { id: string; email: string; name: string | null; role: string },
  redirectTo: string,
  origin: string
) {
  const token = createSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
  const res = NextResponse.redirect(new URL(redirectTo || "/account", origin))
  res.cookies.set(getAuthCookieName("customer"), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionMaxAge(),
  })
  res.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
  return res
}

async function handleGoogle(code: string, req: NextRequest, redirectTo: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.nextUrl.origin}/api/auth/social/callback/google`
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/account/auth?error=google_not_configured", req.nextUrl.origin))
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/account/auth?error=google_token_failed", req.nextUrl.origin))
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string; id_token?: string }
  let email = ""
  let name: string | null = null
  let sub = ""

  if (tokenJson.id_token) {
    const payload = decodeJwtPayload(tokenJson.id_token)
    email = String(payload?.email || "")
    name = payload?.name ? String(payload.name) : null
    sub = String(payload?.sub || "")
  }

  if ((!email || !sub) && tokenJson.access_token) {
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      cache: "no-store",
    })
    if (userRes.ok) {
      const userJson = (await userRes.json()) as { sub?: string; email?: string; name?: string }
      email = email || String(userJson.email || "")
      name = name || (userJson.name ? String(userJson.name) : null)
      sub = sub || String(userJson.sub || "")
    }
  }

  if (!email || !sub) {
    return NextResponse.redirect(new URL("/account/auth?error=google_profile_failed", req.nextUrl.origin))
  }

  const user = await upsertSocialUser({
    provider: "GOOGLE",
    providerAccountId: sub,
    email,
    name,
  })

  return sessionResponse(user, redirectTo, req.nextUrl.origin)
}

async function handleApple(code: string, req: NextRequest, redirectTo: string) {
  const appleEnabled = process.env.ENABLE_APPLE_LOGIN === "true"
  if (!appleEnabled) {
    return NextResponse.redirect(new URL("/account/auth?error=apple_disabled", req.nextUrl.origin))
  }
  const clientId = process.env.APPLE_CLIENT_ID
  const redirectUri = process.env.APPLE_REDIRECT_URI || `${req.nextUrl.origin}/api/auth/social/callback/apple`
  const clientSecret = process.env.APPLE_CLIENT_SECRET || null
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/account/auth?error=apple_not_configured", req.nextUrl.origin))
  }

  const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/account/auth?error=apple_token_failed", req.nextUrl.origin))
  }

  const tokenJson = (await tokenRes.json()) as { id_token?: string }
  const payload = tokenJson.id_token ? decodeJwtPayload(tokenJson.id_token) : null
  const email = String(payload?.email || "")
  const sub = String(payload?.sub || "")
  if (!email || !sub) {
    return NextResponse.redirect(new URL("/account/auth?error=apple_profile_failed", req.nextUrl.origin))
  }

  const user = await upsertSocialUser({
    provider: "APPLE",
    providerAccountId: sub,
    email,
    name: null,
  })

  return sessionResponse(user, redirectTo, req.nextUrl.origin)
}

async function callback(provider: string, req: NextRequest, code: string | null, state: string | null) {
  try {
    if (!code || !state) {
      return NextResponse.redirect(new URL("/account/auth?error=missing_code", req.nextUrl.origin))
    }
    const cookieState = req.cookies.get(OAUTH_STATE_COOKIE)?.value
    const stateInfo = verifyState(state, cookieState)
    if (!stateInfo || stateInfo.provider !== provider) {
      return NextResponse.redirect(new URL("/account/auth?error=invalid_state", req.nextUrl.origin))
    }

    if (provider === "google") return handleGoogle(code, req, stateInfo.redirectTo)
    if (provider === "apple") return handleApple(code, req, stateInfo.redirectTo)
    return NextResponse.redirect(new URL("/account/auth?error=unsupported_provider", req.nextUrl.origin))
  } catch (error) {
    console.error("Social callback error:", error)
    return NextResponse.redirect(new URL("/account/auth?error=social_login_failed", req.nextUrl.origin))
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const resolved = await params
  const provider = resolved.provider
  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")
  return callback(provider, req, code, state)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const resolved = await params
  const provider = resolved.provider
  const raw = await req.text()
  const form = new URLSearchParams(raw)
  const code = form.get("code")
  const state = form.get("state")
  return callback(provider, req, code, state)
}
