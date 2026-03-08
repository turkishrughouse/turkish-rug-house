import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { hashPassword } from "@/lib/password"
import { createCustomerMessage } from "@/lib/customer-messaging"
import { getSiteSettings } from "@/lib/site-settings"

const registerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  phone: z.string().min(6, "Phone is required").optional(),
  marketingOptIn: z.boolean().optional(),
  source: z.enum(["account", "checkout"]).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid registration data" }, { status: 400 })
    }

    const settings = await getSiteSettings()
    const source = parsed.data.source || "account"
    if (source === "checkout") {
      if (!settings.accountCreationDuringCheckout) {
        return NextResponse.json({ error: "Account creation during checkout is disabled" }, { status: 403 })
      }
    }

    const email = parsed.data.email.toLowerCase()
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 })
    }

    const password =
      parsed.data.password && parsed.data.password.trim().length >= 6
        ? parsed.data.password
        : settings.sendPasswordSetupLink
          ? Math.random().toString(36).slice(2, 14)
          : ""
    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 })
    }

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        email,
        password: hashPassword(password),
        role: "CUSTOMER",
        provider: "LOCAL",
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
        phone: parsed.data.phone?.trim() || null,
        marketingOptIn: parsed.data.marketingOptIn ?? true,
      },
      select: { id: true, email: true, name: true, role: true },
    })

    await createCustomerMessage(user.id, {
      kind: "SYSTEM",
      title: "Welcome to Turkish Rug House",
      content: "Your account is ready. Keep your email, phone, and shipping address updated for order and tracking notifications.",
      ctaLabel: "Open account",
      ctaUrl: "/account",
    })

    if (parsed.data.marketingOptIn ?? true) {
      await prisma.message
        .create({
          data: {
            source: "CONTACT",
            status: "NEW",
            name: user.name || user.email.split("@")[0],
            email: user.email,
            subject: "Newsletter subscription",
            content: `Newsletter subscription approved during registration (${source}).`,
            metadata: JSON.stringify({
              type: "NEWSLETTER_SUBSCRIBE",
              userId: user.id,
              source,
            }),
          },
        })
        .catch(() => null)
    }

    await prisma.message.create({
      data: {
        source: "CONTACT",
        status: "NEW",
        name: user.name || user.email.split("@")[0],
        email: user.email,
        subject: "New customer registration",
        content: `New customer account created: ${user.name || "Customer"} (${user.email}).`,
        metadata: JSON.stringify({
          type: "ACCOUNT_REGISTER",
          userId: user.id,
          role: user.role,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      requiresEmailVerification: false,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      redirectTo: "/account",
    })
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json({ error: "Failed to register" }, { status: 500 })
  }
}
