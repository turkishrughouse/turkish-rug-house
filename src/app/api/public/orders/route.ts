import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth"
import { notifyOrderUpdate } from "@/lib/customer-messaging"
import { getSiteSettings } from "@/lib/site-settings"
import { grantReviewRightForOrder } from "@/lib/review-access"

const checkoutSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().optional().nullable(),
      title: z.string().min(1),
      quantity: z.number().int().min(1),
      price: z.number().nonnegative(),
    })
  ).min(1),
  total: z.number().nonnegative(),
})

async function nextOrderNumber() {
  const latest = await prisma.order.findFirst({
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true },
  })
  const lastNumber = latest?.orderNumber ? Number(String(latest.orderNumber).replace(/\D/g, "")) : 0
  const next = Number.isFinite(lastNumber) ? lastNumber + 1 : 1
  return `TRH-${String(next).padStart(3, "0")}`
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser("customer")
    const body = await req.json()
    const parsed = checkoutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid checkout payload" }, { status: 400 })
    }
    const siteSettings = await getSiteSettings()
    const isCustomerSession = sessionUser?.role === "CUSTOMER"
    if (!siteSettings.enableGuestCheckout && !isCustomerSession) {
      return NextResponse.json({ error: "Please sign in to place an order" }, { status: 401 })
    }
    if (siteSettings.requirePhoneAtCheckout && !parsed.data.customerPhone?.trim()) {
      return NextResponse.json({ error: "Phone is required for checkout" }, { status: 400 })
    }
    if (
      siteSettings.requireAddressAtCheckout &&
      (!parsed.data.addressLine1?.trim() || !parsed.data.city?.trim() || !parsed.data.postcode?.trim())
    ) {
      return NextResponse.json({ error: "Address, city and postcode are required for checkout" }, { status: 400 })
    }

    const order = await prisma.order.create({
      data: {
        orderNumber: await nextOrderNumber(),
        userId: isCustomerSession ? sessionUser.id : null,
        customerName: parsed.data.customerName,
        customerEmail: parsed.data.customerEmail.toLowerCase(),
        total: parsed.data.total,
        status: "PAID",
        shipmentStatus: "PENDING",
        items: {
          create: parsed.data.items.map((item) => ({
            productId: item.productId || null,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
          })),
        },
        events: {
          create: [
            {
              type: "CREATED",
              title: "Order placed",
              description: "Order received from checkout",
              actorType: "CUSTOMER",
              isAdmin: false,
            },
          ],
        },
      },
    })

    await notifyOrderUpdate(
      order.id,
      "Order received",
      `Your order ${order.orderNumber} has been received. We will share tracking details after shipment.`,
      "/account",
      "CREATE"
    )
    await grantReviewRightForOrder(order.id)

    return NextResponse.json({ success: true, orderNumber: order.orderNumber, orderId: order.id }, { status: 201 })
  } catch (error) {
    console.error("Create order error:", error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}
