import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { hashPassword } from "@/lib/password"
import { getSessionUser } from "@/lib/auth"

const roleSchema = z.enum(["SUPER_USER", "ADMIN", "EDITOR"])

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: roleSchema.optional(),
  password: z.string().min(6).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser("admin")
    if (!sessionUser || sessionUser.role !== "SUPER_USER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const parsed = updateUserSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    if (parsed.data.email) {
      const exists = await prisma.user.findUnique({
        where: { email: parsed.data.email.toLowerCase() },
      })
      if (exists && exists.id !== id) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 })
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email ? parsed.data.email.toLowerCase() : undefined,
        role: parsed.data.role,
        password: parsed.data.password ? hashPassword(parsed.data.password) : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser("admin")
    if (!sessionUser || sessionUser.role !== "SUPER_USER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}
