import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { createSessionToken, getAuthCookieName, getSessionMaxAge } from "@/lib/auth"
import { verifyPassword } from "@/lib/password"

const loginSchema = z.object({
  email: z.string().email(),
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

    const email = parsed.data.email.toLowerCase()
    const password = parsed.data.password

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: "Email or password is incorrect" }, { status: 401 })
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

    const valid = verifyPassword(user.password, password)
    if (!valid) {
      return NextResponse.json({ error: "Email or password is incorrect" }, { status: 401 })
    }

    const adminRoles = new Set(["SUPER_USER", "ADMIN", "EDITOR", "MANAGER", "STAFF"])
    if (portal === "admin") {
      if (!adminRoles.has(user.role)) {
        return NextResponse.json({ error: "This account has no admin access." }, { status: 403 })
      }
    } else if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Please use the admin login page for this account." }, { status: 403 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

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
      redirectTo: portal === "admin" ? "/dashboard" : "/account",
    })

    const targetPortal = portal === "admin" ? "admin" : "customer"
    res.cookies.set(getAuthCookieName(targetPortal), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getSessionMaxAge(),
    })

    return res
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Failed to login" }, { status: 500 })
  }
}
