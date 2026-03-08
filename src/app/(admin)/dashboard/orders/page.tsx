import { createMockOrder, purgeExpiredTrashedOrders } from "@/lib/actions/order-actions"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { SelectAllCheckbox } from "@/components/admin/orders/select-all-checkbox"

type OrdersPageProps = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function getSingle(params: { [key: string]: string | string[] | undefined }, key: string) {
    const value = params[key]
    if (!value) return ""
    return Array.isArray(value) ? value[0] || "" : value
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
    const resolved = await searchParams
    const customerEmail = getSingle(resolved, "customerEmail").trim().toLowerCase()
    const customer = getSingle(resolved, "customer").trim().toLowerCase()
    const bulkStatus = getSingle(resolved, "bulkStatus")
    const bulkAffected = getSingle(resolved, "bulkAffected")
    const undoIdsRaw = getSingle(resolved, "undoIds")
    const undoIds = undoIdsRaw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)

    await purgeExpiredTrashedOrders()

    const filterWhere =
        customerEmail.length > 0
            ? { customerEmail: { contains: customerEmail } }
            : customer.length > 0
                ? {
                    OR: [
                        { customerEmail: { contains: customer } },
                        { customerName: { contains: customer } },
                    ],
                }
                : {}

    const where = {
        AND: [
            filterWhere,
            { status: { not: "TRASHED" } },
        ],
    }

    const ordersRaw = await prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true } } },
    })
    const orders = ordersRaw.map((order) => ({ ...order, total: Number(order.total || 0) }))

    // Demo helper to generate order if empty
    async function seed() {
        "use server"
        await createMockOrder({ preferredEmail: customerEmail || customer || undefined })
        revalidatePath("/dashboard/orders")
    }

    const returnQuery = new URLSearchParams()
    if (customerEmail) returnQuery.set("customerEmail", customerEmail)
    if (customer) returnQuery.set("customer", customer)
    const returnTo = `/dashboard/orders${returnQuery.toString() ? `?${returnQuery.toString()}` : ""}`

    return (
        <div className="flex-1 space-y-8 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Orders</h2>
                    <p className="text-muted-foreground">Manage your orders and fulfillments.</p>
                    {customerEmail || customer ? (
                        <p className="mt-2 text-sm text-slate-600">
                            Filtered by customer:{" "}
                            <span className="font-semibold text-slate-900">{customerEmail || customer}</span>{" "}
                            <Link href="/dashboard/orders" className="text-blue-700 hover:underline">
                                Clear
                            </Link>
                        </p>
                    ) : null}
                </div>
                <form action={seed}>
                    <Button variant="outline" type="submit">Generate Demo Order</Button>
                </form>
            </div>

            {bulkStatus === "success" ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                    Bulk action applied successfully. Updated {bulkAffected || "0"} order(s).
                </div>
            ) : null}
            {bulkStatus === "none_selected" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                    Please select at least one order before clicking Apply.
                </div>
            ) : null}
            {bulkStatus === "invalid_action" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                    Please choose a valid bulk action.
                </div>
            ) : null}
            {bulkStatus === "error" ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
                    Bulk action failed. Please try again.
                </div>
            ) : null}
            {bulkStatus === "delete_pending" ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                    <span>
                        {bulkAffected || "0"} order(s) moved to trash. You can undo within 10 seconds.
                    </span>
                    {undoIds.length > 0 ? (
                        <form action="/api/admin/orders/undo-delete" method="post" className="shrink-0">
                            <input type="hidden" name="returnTo" value={returnTo} />
                            {undoIds.map((id) => (
                                <input key={id} type="hidden" name="orderIds" value={id} />
                            ))}
                            <Button type="submit" variant="outline" className="h-8 border-amber-400 bg-white text-amber-900 hover:bg-amber-100">
                                Undo
                            </Button>
                        </form>
                    ) : null}
                </div>
            ) : null}
            {bulkStatus === "undo_success" ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                    Deletion undone successfully. Restored {bulkAffected || "0"} order(s).
                </div>
            ) : null}
            {bulkStatus === "undo_expired" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                    Undo window expired (10 seconds).
                </div>
            ) : null}

            <form action="/api/admin/orders/bulk" method="post" className="rounded-md border bg-card w-full overflow-hidden">
                <input type="hidden" name="returnTo" value={returnTo} />
                <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
                    <div className="text-sm font-medium text-slate-700">Bulk actions for selected orders</div>
                    <div className="flex items-center gap-2">
                        <select
                            name="bulkAction"
                            defaultValue=""
                            className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-700"
                        >
                            <option value="" disabled>
                                Select action
                            </option>
                            <option value="MARK_PAID">Mark Paid</option>
                            <option value="MARK_FULFILLED">Mark Fulfilled</option>
                            <option value="MARK_CANCELLED">Mark Cancelled</option>
                            <option value="MARK_SHIPPED">Shipment: Shipped</option>
                            <option value="MARK_IN_TRANSIT">Shipment: In Transit</option>
                            <option value="MARK_DELIVERED">Shipment: Delivered</option>
                        </select>
                        <Button variant="outline" type="submit" className="h-9">
                            Apply
                        </Button>
                        <Button
                            variant="outline"
                            type="submit"
                            name="dangerDelete"
                            value="1"
                            className="h-9 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                        >
                            Delete Selected
                        </Button>
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[68px]">
                                <SelectAllCheckbox />
                            </TableHead>
                            <TableHead>Order</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Shipment</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    No orders found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            orders.map((order) => (
                                <TableRow key={order.id} className="hover:bg-muted/50">
                                    <TableCell>
                                        <input
                                            type="checkbox"
                                            name="orderIds"
                                            value={order.id}
                                            className="h-4 w-4 rounded border-slate-300"
                                            aria-label={`Select order ${order.orderNumber}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <Link href={`/dashboard/orders/${order.id}`} className="block">
                                            {order.orderNumber}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Link href={`/dashboard/orders/${order.id}`} className="block">
                                            {new Date(order.createdAt).toLocaleDateString()}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Link href={`/dashboard/orders/${order.id}`} className="block">
                                            <div className="flex flex-col">
                                                <span>{order.customerName}</span>
                                                <span className="text-xs text-muted-foreground">{order.customerEmail}</span>
                                            </div>
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Link href={`/dashboard/orders/${order.id}`} className="block">
                                            <Badge variant={
                                                order.status === 'PAID' ? 'success' :
                                                    order.status === 'CANCELLED' ? 'destructive' : 'secondary'
                                            }>
                                                {order.status}
                                            </Badge>
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Link href={`/dashboard/orders/${order.id}`} className="block">
                                            <span className="text-xs font-medium text-slate-700">{order.shipmentStatus}</span>
                                            {order.trackingCarrier ? (
                                                <span className="block text-[11px] text-slate-500">{order.trackingCarrier}</span>
                                            ) : null}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Link href={`/dashboard/orders/${order.id}`} className="block text-right">
                                            ${order.total.toFixed(2)}
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </form>
        </div>
    )
}
