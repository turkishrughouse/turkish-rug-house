import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createSessionToken, getAuthCookieName, getSessionMaxAge } from "@/lib/auth"
import { hashEmailVerificationToken } from "@/lib/email-verification"

export async function GET(req: NextRequest) {
  const token = String(req.nextUrl.searchParams.get("token") || "").trim()
  if (!token) {
    return NextResponse.redirect(new URL("/account/auth?error=verification_token_missing", req.nextUrl.origin))
  }

  const tokenHash = hashEmailVerificationToken(token)
  const now = new Date()

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { gt: now },
      role: "CUSTOMER",
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  })

  if (!user) {
    return NextResponse.redirect(new URL("/account/auth?error=verification_link_invalid", req.nextUrl.origin))
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: now,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
      lastLoginAt: now,
    },
  })

  const sessionToken = createSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })

  const res = NextResponse.redirect(new URL("/account?email_verified=1", req.nextUrl.origin))
  res.cookies.set(getAuthCookieName("customer"), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionMaxAge(),
  })
  return res
}
