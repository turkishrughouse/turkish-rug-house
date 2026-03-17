import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { requireInventoryApiUser } from "@/lib/inventory-auth"

const updateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

export async function GET(req: NextRequest) {
  const auth = await requireInventoryApiUser(req)
  if (auth.unauthorized || !auth.user) {
    return auth.unauthorized ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    id: auth.user.id,
    name: auth.user.name || "",
    email: auth.user.email,
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireInventoryApiUser(req)
  if (auth.unauthorized || !auth.user) {
    return auth.unauthorized ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid account data" }, { status: 400 })
    }

    const email = parsed.data.email.toLowerCase()
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing && existing.id !== auth.user.id) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 })
    }

    const user = await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        name: parsed.data.name.trim(),
        email,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("Inventory account update failed:", error)
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 })
  }
}
