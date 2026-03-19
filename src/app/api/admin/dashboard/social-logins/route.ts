import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"
import { isAdminRole } from "@/lib/rbac"

async function requireAdminUser() {
  const user = await getSessionUser("admin")
  if (!user || !isAdminRole(user.role)) return null
  return user
}

export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const users = await prisma.user.findMany({
    where: {
      provider: { in: ["GOOGLE", "APPLE", "FACEBOOK", "INSTAGRAM", "X", "TIKTOK", "LINKEDIN"] },
    },
    orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
    take: 24,
    select: {
      id: true,
      name: true,
      email: true,
      provider: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    total: users.length,
    items: users.map((user) => ({
      id: user.id,
      name: user.name?.trim() || user.email.split("@")[0] || "Unknown user",
      email: user.email,
      provider: user.provider || "UNKNOWN",
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
    })),
  })
}
