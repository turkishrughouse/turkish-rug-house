import { createHmac, randomBytes } from "crypto"
import { NextRequest, NextResponse } from "next/server"

function authSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "rughouse-dev-auth-secret"
}

function signState(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("hex")
}

const COOKIE_NAME = "rughouse_oauth_state"

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider")
  const redirectQuery = req.nextUrl.searchParams.get("redirectTo") || "/account"
  const redirectTo = redirectQuery.startsWith("/") ? redirectQuery : "/account"
  const appleEnabled = process.env.ENABLE_APPLE_LOGIN === "true"

  if (provider !== "google" && provider !== "apple") {
    return NextResponse.redirect(new URL("/account/auth?error=unsupported_provider", req.nextUrl.origin))
  }
  if (provider === "apple" && !appleEnabled) {
    return NextResponse.redirect(new URL("/account/auth?error=apple_disabled", req.nextUrl.origin))
  }

  const nonce = randomBytes(12).toString("hex")
  const statePayload = `${provider}:${redirectTo}:${nonce}`
  const state = `${statePayload}.${signState(statePayload)}`

  let authUrl = ""
  if (provider === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.nextUrl.origin}/api/auth/social/callback/google`
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL("/account/auth?error=google_not_configured", req.nextUrl.origin))
    }
    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("openid email profile")}&state=${encodeURIComponent(state)}&access_type=offline&prompt=select_account`
  } else {
    const clientId = process.env.APPLE_CLIENT_ID
    const clientSecret = process.env.APPLE_CLIENT_SECRET
    const redirectUri = process.env.APPLE_REDIRECT_URI || `${req.nextUrl.origin}/api/auth/social/callback/apple`
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL("/account/auth?error=apple_not_configured", req.nextUrl.origin))
    }
    authUrl = `https://appleid.apple.com/auth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&response_mode=form_post&scope=${encodeURIComponent("name email")}&state=${encodeURIComponent(state)}`
  }

  const res = NextResponse.redirect(authUrl)
  res.cookies.set(COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  })
  return res
}
