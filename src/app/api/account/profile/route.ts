import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"

const normalizeOptionalText = (min = 0, max = 255) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value
      const trimmed = value.trim()
      return trimmed === "" ? undefined : trimmed
    },
    min > 0 ? z.string().min(min).max(max).optional() : z.string().max(max).optional()
  )

const profilePatchSchema = z.object({
  name: normalizeOptionalText(2, 120),
  displayName: normalizeOptionalText(2, 160),
  locale: z.string().min(2).max(20).optional(),
  email: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value
      const trimmed = value.trim()
      return trimmed === "" ? undefined : trimmed.toLowerCase()
    },
    z.string().email().optional()
  ),
  phone: normalizeOptionalText(6, 40),
  avatarUrl: normalizeOptionalText(0, 1000),
  addressLine1: normalizeOptionalText(0, 255),
  addressLine2: normalizeOptionalText(0, 255),
  city: normalizeOptionalText(0, 120),
  state: normalizeOptionalText(0, 120),
  postalCode: normalizeOptionalText(0, 40),
  country: normalizeOptionalText(0, 120),
  accentColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
})

export async function GET() {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [account, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true, phone: true },
    }),
    prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: {
        displayName: true,
        locale: true,
        avatarUrl: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        accentColor: true,
      },
    }),
  ])

  return NextResponse.json({
    name: account?.name || "",
    displayName: profile?.displayName || account?.name || "",
    locale: profile?.locale || "en_US",
    email: account?.email || "",
    phone: account?.phone || "",
    avatarUrl: profile?.avatarUrl || "",
    addressLine1: profile?.addressLine1 || "",
    addressLine2: profile?.addressLine2 || "",
    city: profile?.city || "",
    state: profile?.state || "",
    postalCode: profile?.postalCode || "",
    country: profile?.country || "",
    accentColor: profile?.accentColor || "#0f766e",
  })
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser("customer")
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true },
    })
    if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const parsed = profilePatchSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json({ error: issue?.message || "Invalid profile payload" }, { status: 400 })
    }

    const email = parsed.data.email

    const userData: { name?: string; email?: string; phone?: string } = {}
    if (parsed.data.name !== undefined) userData.name = parsed.data.name
    if (email !== undefined) userData.email = email
    if (parsed.data.phone !== undefined) userData.phone = parsed.data.phone

    const profileData: {
      displayName?: string
      locale?: string
      avatarUrl?: string
      addressLine1?: string
      addressLine2?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
      accentColor?: string
    } = {}
    if (parsed.data.displayName !== undefined) profileData.displayName = parsed.data.displayName
    if (parsed.data.locale !== undefined) profileData.locale = parsed.data.locale
    if (parsed.data.avatarUrl !== undefined) profileData.avatarUrl = parsed.data.avatarUrl
    if (parsed.data.addressLine1 !== undefined) profileData.addressLine1 = parsed.data.addressLine1
    if (parsed.data.addressLine2 !== undefined) profileData.addressLine2 = parsed.data.addressLine2
    if (parsed.data.city !== undefined) profileData.city = parsed.data.city
    if (parsed.data.state !== undefined) profileData.state = parsed.data.state
    if (parsed.data.postalCode !== undefined) profileData.postalCode = parsed.data.postalCode
    if (parsed.data.country !== undefined) profileData.country = parsed.data.country
    if (parsed.data.accentColor !== undefined) profileData.accentColor = parsed.data.accentColor

    await prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { id: user.id }, data: userData })
      }

      if (Object.keys(profileData).length > 0) {
        await tx.customerProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id, ...profileData },
          update: profileData,
        })
      }

      await tx.customerMessage.create({
        data: {
          userId: user.id,
          kind: "SYSTEM",
          title: "Profile updated",
          content: "Your profile details and settings were updated successfully.",
          ctaLabel: "Open profile",
          ctaUrl: "/account?tab=settings",
        },
      })
    })

    const [account, profile] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true, email: true, phone: true },
      }),
      prisma.customerProfile.findUnique({
        where: { userId: user.id },
        select: {
          displayName: true,
          locale: true,
          avatarUrl: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          accentColor: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      profile: {
        name: account?.name || "",
        displayName: profile?.displayName || account?.name || "",
        locale: profile?.locale || "en_US",
        email: account?.email || "",
        phone: account?.phone || "",
        avatarUrl: profile?.avatarUrl || "",
        addressLine1: profile?.addressLine1 || "",
        addressLine2: profile?.addressLine2 || "",
        city: profile?.city || "",
        state: profile?.state || "",
        postalCode: profile?.postalCode || "",
        country: profile?.country || "",
        accentColor: profile?.accentColor || "#0f766e",
      },
    })
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : "Failed to save profile"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
