import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { requireInventoryApiUser } from "@/lib/inventory-auth"
import { hashPassword, verifyPassword } from "@/lib/password"

const updateSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export async function PATCH(req: NextRequest) {
  const auth = await requireInventoryApiUser(req)
  if (auth.unauthorized || !auth.user) {
    return auth.unauthorized ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid password payload" }, { status: 400 })
    }

    const current = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { password: true },
    })

    if (!verifyPassword(current?.password, parsed.data.currentPassword)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        password: hashPassword(parsed.data.newPassword),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Inventory password update failed:", error)
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 })
  }
}
