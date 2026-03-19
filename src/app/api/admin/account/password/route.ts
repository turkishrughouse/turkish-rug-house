import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"
import { isAdminRole } from "@/lib/rbac"
import { hashPassword, verifyPassword } from "@/lib/password"

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10).max(128),
})

function isStrongPassword(value: string) {
  const hasLower = /[a-z]/.test(value)
  const hasUpper = /[A-Z]/.test(value)
  const hasNumber = /\d/.test(value)
  return hasLower && hasUpper && hasNumber
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser("admin")
  if (!user || !isAdminRole(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  if (!isStrongPassword(parsed.data.newPassword)) {
    return NextResponse.json({ error: "Password must include uppercase, lowercase, and a number." }, { status: 400 })
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  })
  if (!verifyPassword(account?.password, parsed.data.currentPassword)) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashPassword(parsed.data.newPassword) },
  })

  return NextResponse.json({ ok: true })
}

