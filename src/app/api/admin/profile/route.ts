import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
import { isAdminRole } from "@/lib/rbac"
import { hashPassword } from "@/lib/password"

const normalizeText = (max = 255) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value
      const trimmed = value.trim()
      return trimmed === "" ? undefined : trimmed
    },
    z.string().max(max).optional()
  )

const profilePatchSchema = z.object({
  disableSyntaxHighlighting: z.boolean().optional(),
  enableKeyboardShortcuts: z.boolean().optional(),
  showToolbar: z.boolean().optional(),
  adminColorScheme: z.enum(["default", "light", "modern", "blue", "coffee", "ectoplasm", "midnight", "ocean", "sunrise"]).optional(),
  locale: z.string().min(2).max(20).optional(),
  firstName: normalizeText(120),
  lastName: normalizeText(120),
  nickname: normalizeText(120),
  displayName: normalizeText(160),
  name: normalizeText(160),
  email: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.string().email().optional()
  ),
  website: normalizeText(500),
  bioEn: normalizeText(3000),
  bioTr: normalizeText(3000),
  avatarUrl: normalizeText(1000),
  newPassword: z.string().min(8).max(128).optional(),
})

async function requireAdminUser() {
  const user = await getSessionUser("admin")
  if (!user || !isAdminRole(user.role)) return null
  return user
}

function splitNamePieces(input: string | null | undefined) {
  const safe = (input || "").trim()
  if (!safe) return { firstName: "", lastName: "" }
  const parts = safe.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: safe, lastName: "" }
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  }
}

export async function GET() {
  const user = await requireAdminUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [account, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true },
    }),
    prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: {
        avatarUrl: true,
        firstName: true,
        lastName: true,
        nickname: true,
        displayName: true,
        website: true,
        bioEn: true,
        bioTr: true,
        locale: true,
        disableSyntaxHighlighting: true,
        enableKeyboardShortcuts: true,
        showToolbar: true,
        adminColorScheme: true,
      },
    }),
  ])

  const accountName = account?.name?.trim() || ""
  const emailPrefix = (account?.email || user.email).split("@")[0] || "Admin"
  const fallbackName = accountName || emailPrefix
  const fallbackNames = splitNamePieces(accountName || fallbackName)
  const ensuredProfile = profile
    ? profile
    : await prisma.customerProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          firstName: fallbackNames.firstName || undefined,
          lastName: fallbackNames.lastName || undefined,
          nickname: fallbackName,
          displayName: fallbackName,
          locale: "en_US",
          disableSyntaxHighlighting: false,
          enableKeyboardShortcuts: false,
          showToolbar: true,
          adminColorScheme: "default",
        },
        update: {},
        select: {
          avatarUrl: true,
          firstName: true,
          lastName: true,
          nickname: true,
          displayName: true,
          website: true,
          bioEn: true,
          bioTr: true,
          locale: true,
          disableSyntaxHighlighting: true,
          enableKeyboardShortcuts: true,
          showToolbar: true,
          adminColorScheme: true,
        },
      })

  const defaultName = fallbackName
  const fallbackParts = splitNamePieces(account?.name || defaultName)
  const nickname = ensuredProfile?.nickname || defaultName
  const displayName = ensuredProfile?.displayName || account?.name || nickname

  return NextResponse.json({
    id: account?.id || user.id,
    username: defaultName,
    name: account?.name || defaultName,
    email: account?.email || user.email,
    firstName: ensuredProfile?.firstName || fallbackParts.firstName || "",
    lastName: ensuredProfile?.lastName || fallbackParts.lastName || "",
    nickname,
    displayName,
    website: ensuredProfile?.website || "",
    bioEn: ensuredProfile?.bioEn || "",
    bioTr: ensuredProfile?.bioTr || "",
    avatarUrl: ensuredProfile?.avatarUrl || "",
    locale: ensuredProfile?.locale || "en_US",
    disableSyntaxHighlighting: ensuredProfile?.disableSyntaxHighlighting ?? false,
    enableKeyboardShortcuts: ensuredProfile?.enableKeyboardShortcuts ?? false,
    showToolbar: ensuredProfile?.showToolbar ?? true,
    adminColorScheme: ensuredProfile?.adminColorScheme || "default",
  })
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAdminUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const parsed = profilePatchSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json({ error: issue?.message || "Invalid profile payload" }, { status: 400 })
    }

    const data = parsed.data
    if (data.email) {
      const existing = await prisma.user.findFirst({
        where: { email: data.email, NOT: { id: user.id } },
        select: { id: true },
      })
      if (existing) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 })
      }
    }

    const nextFirstName = data.firstName
    const nextLastName = data.lastName
    const combinedName = [nextFirstName, nextLastName]
      .filter((piece): piece is string => Boolean(piece))
      .join(" ")
      .trim()
    const nextName = data.name ?? (combinedName || undefined)

    const userData: {
      name?: string
      email?: string
      password?: string
    } = {}
    if (nextName !== undefined) userData.name = nextName
    if (data.email !== undefined) userData.email = data.email
    if (data.newPassword) userData.password = hashPassword(data.newPassword)

    const profileData: {
      avatarUrl?: string
      firstName?: string
      lastName?: string
      nickname?: string
      displayName?: string
      website?: string
      bioEn?: string
      bioTr?: string
      locale?: string
      disableSyntaxHighlighting?: boolean
      enableKeyboardShortcuts?: boolean
      showToolbar?: boolean
      adminColorScheme?: string
    } = {}
    if (data.avatarUrl !== undefined) profileData.avatarUrl = data.avatarUrl
    if (data.firstName !== undefined) profileData.firstName = data.firstName
    if (data.lastName !== undefined) profileData.lastName = data.lastName
    if (data.nickname !== undefined) profileData.nickname = data.nickname
    if (data.displayName !== undefined) profileData.displayName = data.displayName
    if (data.website !== undefined) profileData.website = data.website
    if (data.bioEn !== undefined) profileData.bioEn = data.bioEn
    if (data.bioTr !== undefined) profileData.bioTr = data.bioTr
    if (data.locale !== undefined) profileData.locale = data.locale
    if (data.disableSyntaxHighlighting !== undefined) profileData.disableSyntaxHighlighting = data.disableSyntaxHighlighting
    if (data.enableKeyboardShortcuts !== undefined) profileData.enableKeyboardShortcuts = data.enableKeyboardShortcuts
    if (data.showToolbar !== undefined) profileData.showToolbar = data.showToolbar
    if (data.adminColorScheme !== undefined) profileData.adminColorScheme = data.adminColorScheme

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
    })

    return GET()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save profile"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
