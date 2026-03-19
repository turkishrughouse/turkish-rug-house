import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { createSessionToken, getAuthCookieName, getSessionMaxAge, shouldUseSecureCookies } from "@/lib/auth"
import { verifyPassword } from "@/lib/password"

const loginSchema = z.object({
  identifier: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const portal = req.nextUrl.searchParams.get("portal") || "customer"
    const body = await req.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 400 }
      )
    }

    const rawIdentifier = String(parsed.data.identifier || parsed.data.email || "").trim()
    if (!rawIdentifier) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 400 }
      )
    }
    const identifier = rawIdentifier.toLowerCase()
    const password = parsed.data.password

    const candidates = await prisma.user.findMany({
      where: {
        OR: [
          { email: identifier },
          { email: { startsWith: `${identifier}@` } },
          { name: rawIdentifier },
        ],
      },
      take: 10,
    })
    const user =
      candidates.find((item) => item.email.toLowerCase() === identifier) ||
      candidates.find((item) => (item.name || "").trim().toLowerCase() === identifier) ||
      candidates.find((item) => item.email.toLowerCase().startsWith(`${identifier}@`)) ||
      null
    if (!user) {
      return NextResponse.json({ error: `User not found for: ${identifier}` }, { status: 401 })
    }
    if (user.isBlocked) {
      return NextResponse.json({ error: "This account is blocked. Please contact support." }, { status: 403 })
    }

    if (
      portal !== "admin" &&
      user.role === "CUSTOMER" &&
      (user.provider === "GOOGLE" || user.provider === "APPLE")
    ) {
      const provider = user.provider.toLowerCase()
      return NextResponse.json(
        {
          error: `This email is registered with ${user.provider}. Please continue with ${user.provider}.`,
          code: "SOCIAL_LOGIN_REQUIRED",
          provider,
          redirectTo: `/api/auth/social/start?provider=${provider}&redirectTo=%2Faccount`,
        },
        { status: 409 }
      )
    }

    const normalizedStoredPassword = String(user.password || "").trim()
    const normalizedPassword = password.trim()
    const valid = verifyPassword(normalizedStoredPassword, normalizedPassword)
    if (!valid) {
      return NextResponse.json({ error: "Username/email or password is incorrect" }, { status: 401 })
    }

    const adminRoles = new Set(["SUPER_USER", "ADMIN", "EDITOR", "MANAGER", "STAFF"])
    const isAdminPortal = portal === "admin" || portal === "inventory" || portal === "dealer"
    if (isAdminPortal) {
      if (!adminRoles.has(user.role)) {
        const errorMessage =
          portal === "inventory"
            ? "This account has no inventory access."
            : portal === "dealer"
              ? "This account has no dealer access."
              : "This account has no admin access."
        return NextResponse.json({ error: errorMessage }, { status: 403 })
      }
    } else if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Please use the admin login page for this account." }, { status: 403 })
    }

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })
    } catch (error) {
      console.warn("Login lastLoginAt update skipped:", error)
    }

    const token = createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      redirectTo:
        portal === "admin"
          ? (user.role === "SUPER_USER" ? "/superuser" : "/admin")
          : portal === "inventory"
            ? "/inventory"
            : portal === "dealer"
              ? "/dealer"
              : "/account",
    })

    const targetPortal =
      portal === "admin" || portal === "inventory" || portal === "dealer"
        ? portal
        : "customer"
    res.cookies.set(getAuthCookieName(targetPortal), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookies(req.nextUrl.hostname),
      path: "/",
      maxAge: getSessionMaxAge(),
    })

    return res
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Failed to login" }, { status: 500 })
  }
}
