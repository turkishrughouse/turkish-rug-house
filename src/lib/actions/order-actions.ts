"use server"

import { prisma as db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { notifyOrderUpdate } from "@/lib/customer-messaging"
import { grantReviewRightForOrder } from "@/lib/review-access"

type ShipmentStatus = "PENDING" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED"

const TRACKING_STATUS_LABEL: Record<ShipmentStatus, string> = {
    PENDING: "Pending",
    SHIPPED: "Shipped",
    IN_TRANSIT: "In Transit",
    DELIVERED: "Delivered",
}

const TRACKING_BASE_URLS: Record<string, string> = {
    dhl: "https://www.dhl.com/global-en/home/tracking.html?tracking-id=",
    ups: "https://www.ups.com/track?tracknum=",
    fedex: "https://www.fedex.com/fedextrack/?trknbr=",
    usps: "https://tools.usps.com/go/TrackConfirmAction?tLabels=",
    aras: "https://kargotakip.araskargo.com.tr/mainpage.aspx?code=",
    yurtici: "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=",
    mng: "https://www.mngkargo.com.tr/track?ref=",
    ptt: "https://gonderitakip.ptt.gov.tr/Track/Verify?q=",
    sendeo: "https://www.sendeo.com.tr/track?trackingNumber=",
}

function buildTrackingUrl(carrier: string, trackingNumber: string) {
    const carrierValue = carrier.trim()
    const trackingValue = trackingNumber.trim()
    if (!trackingValue) return null
    const key = carrierValue.toLowerCase()
    const baseUrl = TRACKING_BASE_URLS[key]
    if (baseUrl) {
        return `${baseUrl}${encodeURIComponent(trackingValue)}`
    }
    return `https://www.google.com/search?q=${encodeURIComponent(`${carrierValue} ${trackingValue} tracking`)}`
}

export async function getOrders(page = 1, limit = 20) {
    const skip = (page - 1) * limit

    // We fetch raw and serialize manually to avoid Decimal errors
    const orders = await db.order.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { items: true } } }
    })

    const total = await db.order.count()

    // Serialize
    const serialized = orders.map(o => ({
        ...o,
        total: o.total.toNumber(),
    }))

    return {
        orders: serialized,
        metadata: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    }
}

export async function getOrder(id: string) {
    const order = await db.order.findUnique({
        where: { id },
        include: {
            items: true,
            events: {
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    if (!order) return null

    return {
        ...order,
        total: order.total.toNumber(),
        items: order.items.map(item => ({
            ...item,
            price: item.price.toNumber()
        })),
        events: order.events // Events don't usually have Decimals
    }
}

export async function addOrderEvent(orderId: string, type: string, title: string, description?: string, actorType: 'SYSTEM' | 'ADMIN' | 'CUSTOMER' = 'ADMIN') {
    try {
        await db.orderEvent.create({
            data: {
                orderId,
                type,
                title,
                description,
                actorType,
                isAdmin: actorType === 'ADMIN'
            }
        })
        if (actorType !== "CUSTOMER" && ["STATUS", "PAYMENT", "FULFILLMENT", "CANCELLED"].includes(type)) {
            await notifyOrderUpdate(
                orderId,
                title,
                description || title,
                "/account",
                type === "CANCELLED"
                    ? "CANCELLED"
                    : type === "FULFILLMENT"
                        ? "FULFILLMENT"
                        : "STATUS",
                { sendCustomerPanelMessage: false }
            )
        }
        revalidatePath(`/dashboard/orders/${orderId}`)
        return { success: true }
    } catch {
        return { success: false, error: "Failed to add event" }
    }
}

// Seed helper for verify
export async function createMockOrder(input?: { preferredEmail?: string }) {
    const preferred = (input?.preferredEmail || "").trim().toLowerCase()
    const fallbackUser = await db.user.findFirst({
        where: {
            role: "CUSTOMER",
            ...(preferred ? { email: preferred } : {}),
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, name: true },
    })

    const orderNumber = `ORD-DEMO-${Date.now().toString().slice(-8)}`
    const order = await db.order.create({
        data: {
            orderNumber,
            userId: fallbackUser?.id || null,
            customerEmail: fallbackUser?.email || "demo@example.com",
            customerName: fallbackUser?.name || "Demo User",
            total: 299.99,
            status: "PAID",
            items: {
                create: [
                    { title: "Vintage Rug 001", quantity: 1, price: 299.99 }
                ]
            },
            events: {
                create: [
                    { type: "CREATED", title: "Order Placed", description: "Order received via Checkout", actorType: "CUSTOMER" },
                    { type: "PAYMENT", title: "Payment Authorized", description: "VISA ending in 4242", actorType: "SYSTEM" },
                    { type: "STATUS", title: "Processing Started", actorType: "SYSTEM" }
                ]
            }
        }
    })
    await notifyOrderUpdate(
        order.id,
        "Order created",
        `Your order ${order.orderNumber} has been created successfully.`,
        "/account",
        "CREATE",
        { sendCustomerPanelMessage: true }
    )
    await grantReviewRightForOrder(order.id)
    return order.id
}

export async function fulfillOrder(orderId: string, carrier: string, trackingNumber: string, notes?: string) {
    try {
        const trackingUrl = buildTrackingUrl(carrier, trackingNumber)
        const updatedOrder = await db.order.update({
            where: { id: orderId },
            data: {
                status: 'FULFILLED',
                shipmentStatus: 'SHIPPED',
                trackingCarrier: carrier,
                trackingNumber,
                trackingUrl,
            }
        })

        await db.orderEvent.create({
            data: {
                orderId,
                type: 'FULFILLMENT',
                title: 'Order Fulfilled',
                description: `Shipped via ${carrier} (Tracking: ${trackingNumber}) ${notes ? `- ${notes}` : ''}`,
                actorType: 'ADMIN',
                isAdmin: true
            }
        })
        await notifyOrderUpdate(
            orderId,
            "Order shipped",
            `Your order ${updatedOrder.orderNumber} has been shipped via ${carrier}. Tracking number: ${trackingNumber}. Track shipment: ${trackingUrl || "Not available"}`,
            "/account",
            "FULFILLMENT",
            { sendCustomerPanelMessage: false }
        )

        revalidatePath(`/dashboard/orders/${orderId}`)
        revalidatePath("/dashboard/orders")
        return { success: true }
    } catch (error) {
        console.error("Fulfillment Error:", error)
        return { success: false, error: "Failed to fulfill order" }
    }
}

export async function updateOrderTracking(
    orderId: string,
    input: {
        carrier: string
        trackingNumber: string
        shipmentStatus: ShipmentStatus
        notes?: string
    }
) {
    try {
        const carrier = input.carrier.trim()
        const trackingNumber = input.trackingNumber.trim()
        const trackingUrl = buildTrackingUrl(carrier, trackingNumber)
        const shipmentStatus = input.shipmentStatus
        const notes = (input.notes || "").trim()

        if (!carrier) return { success: false, error: "Carrier is required" }
        if (!trackingNumber) return { success: false, error: "Tracking number is required" }

        const updateData: {
            trackingCarrier: string
            trackingNumber: string
            trackingUrl: string | null
            shipmentStatus: ShipmentStatus
            deliveredAt: Date | null
            status?: string
        } = {
            trackingCarrier: carrier,
            trackingNumber,
            trackingUrl,
            shipmentStatus,
            deliveredAt: shipmentStatus === "DELIVERED" ? new Date() : null,
        }
        if (shipmentStatus !== "PENDING") {
            updateData.status = "FULFILLED"
        }

        const updatedOrder = await db.order.update({
            where: { id: orderId },
            data: updateData,
            select: { id: true, orderNumber: true },
        })

        const eventTitle = shipmentStatus === "DELIVERED" ? "Order delivered" : "Tracking updated"
        const eventDescription = [
            `Carrier: ${carrier}`,
            `Tracking: ${trackingNumber}`,
            trackingUrl ? `Track: ${trackingUrl}` : "",
            `Shipment: ${TRACKING_STATUS_LABEL[shipmentStatus]}`,
            notes ? `Note: ${notes}` : "",
        ]
            .filter(Boolean)
            .join(" • ")

        await db.orderEvent.create({
            data: {
                orderId,
                type: "FULFILLMENT",
                title: eventTitle,
                description: eventDescription,
                actorType: "ADMIN",
                isAdmin: true,
            },
        })

        await notifyOrderUpdate(
            orderId,
            eventTitle,
            `Your order ${updatedOrder.orderNumber} tracking is updated. ${eventDescription}`,
            "/account?tab=orders",
            "FULFILLMENT",
            { sendCustomerPanelMessage: false }
        )

        revalidatePath(`/dashboard/orders/${orderId}`)
        revalidatePath("/dashboard/orders")
        revalidatePath("/account")
        return { success: true }
    } catch (error) {
        console.error("Tracking Update Error:", error)
        return { success: false, error: "Failed to update tracking" }
    }
}

export async function applyBulkOrderAction(
    orderIds: string[],
    action:
        | "MARK_PAID"
        | "MARK_FULFILLED"
        | "MARK_CANCELLED"
        | "MARK_SHIPPED"
        | "MARK_IN_TRANSIT"
        | "MARK_DELIVERED"
        | "DELETE"
) {
    const ids = Array.from(new Set(orderIds.filter(Boolean)))
    if (ids.length === 0) return { success: false, error: "No orders selected" }

    try {
        if (action === "DELETE") {
            const existing = await db.order.findMany({
                where: { id: { in: ids } },
                select: { id: true, status: true, shipmentStatus: true },
            })
            if (existing.length === 0) return { success: false, error: "No valid orders found" }

            const nowIso = new Date().toISOString()
            await db.$transaction(async (tx) => {
                await tx.order.updateMany({
                    where: { id: { in: existing.map((item) => item.id) } },
                    data: { status: "TRASHED" },
                })
                await tx.orderEvent.createMany({
                    data: existing.map((item) => ({
                        orderId: item.id,
                        type: "DELETE_PENDING",
                        title: "Order scheduled for deletion",
                        description: JSON.stringify({
                            previousStatus: item.status,
                            previousShipmentStatus: item.shipmentStatus,
                            deletedAt: nowIso,
                        }),
                        actorType: "ADMIN",
                        isAdmin: true,
                    })),
                })
            })
            revalidatePath("/dashboard/orders")
            return { success: true, affected: existing.length, undoIds: existing.map((item) => item.id), undoWindowSeconds: 10 }
        }

        const now = new Date()
        const dataByAction: Record<Exclude<typeof action, "DELETE">, { status?: string; shipmentStatus?: ShipmentStatus; deliveredAt?: Date | null }> = {
            MARK_PAID: { status: "PAID" },
            MARK_FULFILLED: { status: "FULFILLED" },
            MARK_CANCELLED: { status: "CANCELLED" },
            MARK_SHIPPED: { shipmentStatus: "SHIPPED", status: "FULFILLED" },
            MARK_IN_TRANSIT: { shipmentStatus: "IN_TRANSIT", status: "FULFILLED" },
            MARK_DELIVERED: { shipmentStatus: "DELIVERED", status: "FULFILLED", deliveredAt: now },
        }
        const updateData = dataByAction[action]

        await db.order.updateMany({
            where: { id: { in: ids } },
            data: updateData,
        })

        const titleByAction: Record<Exclude<typeof action, "DELETE">, string> = {
            MARK_PAID: "Order marked as paid",
            MARK_FULFILLED: "Order fulfilled",
            MARK_CANCELLED: "Order cancelled",
            MARK_SHIPPED: "Shipment marked as shipped",
            MARK_IN_TRANSIT: "Shipment marked in transit",
            MARK_DELIVERED: "Order delivered",
        }
        const eventTitle = titleByAction[action]

        await db.orderEvent.createMany({
            data: ids.map((id) => ({
                orderId: id,
                type: action.startsWith("MARK_") ? "STATUS" : "NOTE",
                title: eventTitle,
                actorType: "ADMIN",
                isAdmin: true,
            })),
        })

        await Promise.all(
            ids.map((id) =>
                notifyOrderUpdate(
                    id,
                    eventTitle,
                    `${eventTitle} by admin.`,
                    "/account?tab=orders",
                    action === "MARK_CANCELLED" ? "CANCELLED" : action.includes("SHIP") || action === "MARK_DELIVERED" ? "FULFILLMENT" : "STATUS",
                    { sendCustomerPanelMessage: false }
                )
            )
        )

        revalidatePath("/dashboard/orders")
        ids.forEach((id) => revalidatePath(`/dashboard/orders/${id}`))
        revalidatePath("/account")
        return { success: true, affected: ids.length }
    } catch (error) {
        console.error("Bulk Order Action Error:", error)
        return { success: false, error: "Bulk action failed" }
    }
}

export async function undoPendingDeletedOrders(orderIds: string[]) {
    const ids = Array.from(new Set(orderIds.filter(Boolean)))
    if (ids.length === 0) return { success: false, affected: 0, error: "No orders selected" }

    const threshold = new Date(Date.now() - 10_000)
    const candidates = await db.order.findMany({
        where: {
            id: { in: ids },
            status: "TRASHED",
            updatedAt: { gte: threshold },
        },
        select: { id: true },
    })
    if (candidates.length === 0) return { success: false, affected: 0, error: "Undo window expired" }

    const candidateIds = candidates.map((item) => item.id)
    const events = await db.orderEvent.findMany({
        where: { orderId: { in: candidateIds }, type: "DELETE_PENDING" },
        orderBy: { createdAt: "desc" },
        select: { orderId: true, description: true },
    })

    const latestByOrder = new Map<string, { previousStatus: string; previousShipmentStatus: ShipmentStatus }>()
    for (const event of events) {
        if (latestByOrder.has(event.orderId)) continue
        try {
            const parsed = JSON.parse(event.description || "{}") as { previousStatus?: string; previousShipmentStatus?: ShipmentStatus }
            latestByOrder.set(event.orderId, {
                previousStatus: parsed.previousStatus || "PENDING",
                previousShipmentStatus: parsed.previousShipmentStatus || "PENDING",
            })
        } catch {
            latestByOrder.set(event.orderId, { previousStatus: "PENDING", previousShipmentStatus: "PENDING" })
        }
    }

    await db.$transaction(async (tx) => {
        await Promise.all(
            candidateIds.map((id) => {
                const prev = latestByOrder.get(id) || { previousStatus: "PENDING", previousShipmentStatus: "PENDING" as ShipmentStatus }
                return tx.order.update({
                    where: { id },
                    data: {
                        status: prev.previousStatus,
                        shipmentStatus: prev.previousShipmentStatus,
                    },
                })
            })
        )
        await tx.orderEvent.createMany({
            data: candidateIds.map((id) => ({
                orderId: id,
                type: "DELETE_UNDO",
                title: "Deletion undone",
                description: "Order restored from trash within 10 seconds.",
                actorType: "ADMIN",
                isAdmin: true,
            })),
        })
    })

    revalidatePath("/dashboard/orders")
    return { success: true, affected: candidateIds.length }
}

export async function purgeExpiredTrashedOrders() {
    const threshold = new Date(Date.now() - 10_000)
    const expired = await db.order.findMany({
        where: { status: "TRASHED", updatedAt: { lt: threshold } },
        select: { id: true },
    })
    if (expired.length === 0) return { success: true, affected: 0 }

    const ids = expired.map((item) => item.id)
    await db.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { orderId: { in: ids } } })
        await tx.orderEvent.deleteMany({ where: { orderId: { in: ids } } })
        await tx.order.deleteMany({ where: { id: { in: ids } } })
    })

    revalidatePath("/dashboard/orders")
    return { success: true, affected: ids.length }
}
