"use server"

import { prisma as db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { notifyOrderUpdate } from "@/lib/customer-messaging"
import { ensureOrderDetailsColumn, getOrderDetailsMap, getSingleOrderDetails, saveOrderDetails } from "@/lib/order-details"

type ShipmentStatus = "PENDING" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED"
type AdminOrderStatus = "PENDING" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED" | "FAILED" | "TRASHED"
type PaymentStatus = "PENDING" | "PAID" | "REFUNDED" | "FAILED" | "PARTIALLY_REFUNDED"

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

function normalizeOrderStatus(input: string | null | undefined): AdminOrderStatus {
    const value = (input || "").trim().toUpperCase()
    if (value === "FULFILLED") return "SHIPPED"
    if (value === "TRASHED") return "TRASHED"
    if (value === "PENDING" || value === "PAID" || value === "PROCESSING" || value === "SHIPPED" || value === "DELIVERED" || value === "CANCELLED" || value === "REFUNDED" || value === "FAILED") {
        return value
    }
    return "PENDING"
}

function nextStatusForShipment(shipmentStatus: ShipmentStatus): AdminOrderStatus {
    if (shipmentStatus === "DELIVERED") return "DELIVERED"
    if (shipmentStatus === "SHIPPED" || shipmentStatus === "IN_TRANSIT") return "SHIPPED"
    return "PROCESSING"
}

export async function getOrders(
    page = 1,
    limit = 20,
    filters?: {
        query?: string
        status?: string
        paymentStatus?: string
        sort?: string
        dateFrom?: string
        dateTo?: string
    }
) {
    await ensureOrderDetailsColumn()
    const skip = (page - 1) * limit
    const query = (filters?.query || "").trim().toLowerCase()
    const status = (filters?.status || "").trim().toUpperCase()
    const paymentStatus = (filters?.paymentStatus || "").trim().toUpperCase()
    const dateFrom = filters?.dateFrom ? new Date(filters.dateFrom) : null
    const dateTo = filters?.dateTo ? new Date(filters.dateTo) : null
    const sort = (filters?.sort || "createdAt-desc").trim()
    const orderBy =
        sort === "createdAt-asc"
            ? { createdAt: "asc" as const }
            : sort === "total-asc"
                ? { total: "asc" as const }
                : sort === "total-desc"
                    ? { total: "desc" as const }
                    : { createdAt: "desc" as const }

    const where = {
        status: { not: "TRASHED" as const },
        ...(query
            ? {
                OR: [
                    { orderNumber: { contains: query } },
                    { customerEmail: { contains: query } },
                    { customerName: { contains: query } },
                ],
            }
            : {}),
        ...(status ? { status } : {}),
        ...(dateFrom || dateTo
            ? {
                createdAt: {
                    ...(dateFrom ? { gte: dateFrom } : {}),
                    ...(dateTo ? { lte: dateTo } : {}),
                },
            }
            : {}),
    }

    const [orders, total] = await Promise.all([
        db.order.findMany({
            ...(paymentStatus ? {} : { skip, take: limit }),
            where,
            orderBy,
            include: { _count: { select: { items: true } } }
        }),
        db.order.count({ where }),
    ])

    const detailsMap = await getOrderDetailsMap(orders.map((order) => order.id))

    const filtered = orders
        .map((o) => {
            const details = detailsMap.get(o.id)
            return {
                ...o,
                status: normalizeOrderStatus(o.status),
                total: o.total.toNumber(),
                paymentStatus: details?.paymentStatus || (normalizeOrderStatus(o.status) === "PAID" ? "PAID" : "PENDING"),
                paymentMethod: details?.paymentMethod || null,
                details,
            }
        })
        .filter((order) => !paymentStatus || (order.paymentStatus || "").toUpperCase() === paymentStatus)

    const serialized = paymentStatus ? filtered.slice(skip, skip + limit) : filtered

    return {
        orders: serialized,
        metadata: {
            total: paymentStatus ? filtered.length : total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil((paymentStatus ? filtered.length : total) / limit))
        }
    }
}

export async function getOrder(id: string) {
    await ensureOrderDetailsColumn()
    const order = await db.order.findUnique({
        where: { id },
        include: {
            items: true,
            events: {
                orderBy: { createdAt: 'desc' }
            },
            user: {
                select: {
                    email: true,
                    phone: true,
                    customerProfile: {
                        select: {
                            addressLine1: true,
                            addressLine2: true,
                            city: true,
                            state: true,
                            postalCode: true,
                            country: true,
                        },
                    },
                },
            },
        }
    })

    if (!order) return null
    const details = await getSingleOrderDetails(id)

    return {
        ...order,
        status: normalizeOrderStatus(order.status),
        total: order.total.toNumber(),
        details: {
            ...details,
            customerPhone: details.customerPhone || order.user?.phone || null,
            addressLine1: details.addressLine1 || order.user?.customerProfile?.addressLine1 || null,
            addressLine2: details.addressLine2 || order.user?.customerProfile?.addressLine2 || null,
            city: details.city || order.user?.customerProfile?.city || null,
            state: details.state || order.user?.customerProfile?.state || null,
            postcode: details.postcode || order.user?.customerProfile?.postalCode || null,
            country: details.country || order.user?.customerProfile?.country || null,
        },
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

export async function fulfillOrder(orderId: string, carrier: string, trackingNumber: string, notes?: string) {
    try {
        const trackingUrl = buildTrackingUrl(carrier, trackingNumber)
        const updatedOrder = await db.order.update({
            where: { id: orderId },
            data: {
                status: 'SHIPPED',
                shipmentStatus: 'SHIPPED',
                trackingCarrier: carrier,
                trackingNumber,
                trackingUrl,
            }
        })
        await saveOrderDetails(orderId, {
            invoiceNumber: `INV-${updatedOrder.orderNumber}`,
            invoiceIssuedAt: new Date().toISOString(),
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
        updateData.status = nextStatusForShipment(shipmentStatus)

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
        await saveOrderDetails(orderId, {
            invoiceNumber: `INV-${updatedOrder.orderNumber}`,
            invoiceIssuedAt: new Date().toISOString(),
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

export async function updateOrderWorkflow(
    orderId: string,
    input: {
        status?: AdminOrderStatus
        paymentStatus?: PaymentStatus
        notes?: string
        refundedAmount?: number
    }
) {
    try {
        const order = await db.order.findUnique({
            where: { id: orderId },
            select: { id: true, orderNumber: true, total: true, shipmentStatus: true },
        })
        if (!order) return { success: false, error: "Order not found" }

        const nextStatus = input.status ? normalizeOrderStatus(input.status) : undefined
        const nextPaymentStatus = input.paymentStatus?.trim().toUpperCase() as PaymentStatus | undefined
        const notes = (input.notes || "").trim()

        await db.order.update({
            where: { id: orderId },
            data: {
                ...(nextStatus ? { status: nextStatus } : {}),
                ...(nextStatus === "DELIVERED"
                    ? { deliveredAt: new Date(), shipmentStatus: "DELIVERED" }
                    : nextStatus === "SHIPPED"
                        ? { shipmentStatus: "SHIPPED" }
                        : nextStatus === "PROCESSING"
                            ? { shipmentStatus: "PENDING" }
                            : nextStatus === "CANCELLED" || nextStatus === "REFUNDED"
                                ? { shipmentStatus: order.shipmentStatus }
                                : {}),
            },
        })

        const detailsPatch: Record<string, unknown> = {}
        if (nextPaymentStatus) detailsPatch.paymentStatus = nextPaymentStatus
        if (nextStatus === "PAID" && !nextPaymentStatus) detailsPatch.paymentStatus = "PAID"
        if (nextStatus === "REFUNDED") {
            detailsPatch.paymentStatus = "REFUNDED"
            detailsPatch.refundedAmount = Number(input.refundedAmount || order.total.toNumber())
        } else if (typeof input.refundedAmount === "number") {
            detailsPatch.refundedAmount = Number(input.refundedAmount || 0)
        }
        if (Object.keys(detailsPatch).length > 0) {
            await saveOrderDetails(orderId, detailsPatch)
        }

        const eventTitle = nextStatus
            ? `Order ${nextStatus.toLowerCase()}`
            : nextPaymentStatus
                ? `Payment ${nextPaymentStatus.toLowerCase()}`
                : "Order updated"
        const eventDescription = [nextStatus ? `Status: ${nextStatus}` : "", nextPaymentStatus ? `Payment: ${nextPaymentStatus}` : "", notes].filter(Boolean).join(" • ")

        await addOrderEvent(orderId, nextStatus === "REFUNDED" ? "PAYMENT" : nextStatus === "CANCELLED" ? "CANCELLED" : "STATUS", eventTitle, eventDescription, "ADMIN")
        revalidatePath("/dashboard/orders")
        revalidatePath(`/dashboard/orders/${orderId}`)
        revalidatePath("/account")
        return { success: true }
    } catch (error) {
        console.error("Order workflow update error:", error)
        return { success: false, error: "Failed to update order" }
    }
}

export async function applyBulkOrderAction(
    orderIds: string[],
    action:
        | "MARK_PAID"
        | "MARK_FULFILLED"
        | "MARK_CANCELLED"
        | "MARK_REFUNDED"
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
            MARK_FULFILLED: { status: "PROCESSING" },
            MARK_CANCELLED: { status: "CANCELLED" },
            MARK_REFUNDED: { status: "REFUNDED" },
            MARK_SHIPPED: { shipmentStatus: "SHIPPED", status: "SHIPPED" },
            MARK_IN_TRANSIT: { shipmentStatus: "IN_TRANSIT", status: "SHIPPED" },
            MARK_DELIVERED: { shipmentStatus: "DELIVERED", status: "DELIVERED", deliveredAt: now },
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
            MARK_REFUNDED: "Order refunded",
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

        if (action === "MARK_PAID" || action === "MARK_CANCELLED" || action === "MARK_REFUNDED" || action === "MARK_DELIVERED" || action === "MARK_SHIPPED" || action === "MARK_IN_TRANSIT" || action === "MARK_FULFILLED") {
            await Promise.all(
                ids.map((id) =>
                    saveOrderDetails(id, {
                        ...(action === "MARK_PAID" ? { paymentStatus: "PAID" } : {}),
                        ...(action === "MARK_REFUNDED" ? { paymentStatus: "REFUNDED" as PaymentStatus } : {}),
                    })
                )
            )
        }

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
