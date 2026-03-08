import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
import { z } from "zod"

const patchSchema = z.object({
  marketingOptIn: z.boolean().optional(),
  notifyOrderUpdates: z.boolean().optional(),
  notifyDiscounts: z.boolean().optional(),
  notifyNewProducts: z.boolean().optional(),
  notifyNewCategories: z.boolean().optional(),
})

export async function GET() {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      marketingOptIn: true,
      notifyOrderUpdates: true,
      notifyDiscounts: true,
      notifyNewProducts: true,
      notifyNewCategories: true,
    },
  })

  return NextResponse.json(profile)
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      marketingOptIn: true,
      notifyOrderUpdates: true,
      notifyDiscounts: true,
      notifyNewProducts: true,
      notifyNewCategories: true,
    },
  })
  if (!current) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const changedEntries = Object.entries(parsed.data).filter(([key, value]) => {
    const currentValue = current[key as keyof typeof current]
    return typeof currentValue === "boolean" && currentValue !== value
  })

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
    select: {
      marketingOptIn: true,
      notifyOrderUpdates: true,
      notifyDiscounts: true,
      notifyNewProducts: true,
      notifyNewCategories: true,
    },
  })

  if (changedEntries.length > 0) {
    const labels: Record<string, string> = {
      marketingOptIn: "Marketing emails",
      notifyOrderUpdates: "Order updates",
      notifyDiscounts: "Discount alerts",
      notifyNewProducts: "New product alerts",
      notifyNewCategories: "New category alerts",
    }

    const summary = changedEntries
      .map(([key, value]) => `${labels[key] || key}: ${value ? "ON" : "OFF"}`)
      .join(" | ")

    await prisma.customerMessage.create({
      data: {
        userId: user.id,
        kind: "SYSTEM",
        title: "Notification settings updated",
        content: summary,
        ctaLabel: "Open settings",
        ctaUrl: "/account?tab=settings",
        metadata: JSON.stringify({ changed: Object.fromEntries(changedEntries) }),
      },
    })
  }

  return NextResponse.json(updated)
}
