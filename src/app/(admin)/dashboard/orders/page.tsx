import Link from "next/link"
import { getOrders, purgeExpiredTrashedOrders } from "@/lib/actions/order-actions"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { SelectAllCheckbox } from "@/components/admin/orders/select-all-checkbox"
import { OrderAutoRefresh } from "@/components/admin/orders/order-auto-refresh"

type OrdersPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function getSingle(params: { [key: string]: string | string[] | undefined }, key: string) {
  const value = params[key]
  return Array.isArray(value) ? value[0] || "" : value || ""
}

function statusBadgeVariant(status: string) {
  if (status === "PAID" || status === "DELIVERED") return "success"
  if (status === "CANCELLED" || status === "REFUNDED") return "destructive"
  return "secondary"
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const resolved = await searchParams
  const page = Math.max(1, Number(getSingle(resolved, "page") || "1"))
  const limit = Math.max(1, Math.min(100, Number(getSingle(resolved, "limit") || "20")))
  const query = getSingle(resolved, "q").trim()
  const status = getSingle(resolved, "status").trim()
  const paymentStatus = getSingle(resolved, "paymentStatus").trim()
  const dateFrom = getSingle(resolved, "dateFrom").trim()
  const dateTo = getSingle(resolved, "dateTo").trim()
  const sort = getSingle(resolved, "sort").trim() || "createdAt-desc"
  const bulkStatus = getSingle(resolved, "bulkStatus")
  const bulkAffected = getSingle(resolved, "bulkAffected")
  const undoIds = getSingle(resolved, "undoIds")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  await purgeExpiredTrashedOrders()

  const { orders, metadata } = await getOrders(page, limit, {
    query,
    status,
    paymentStatus,
    sort,
    dateFrom,
    dateTo,
  })

  const queryParams = new URLSearchParams()
  if (query) queryParams.set("q", query)
  if (status) queryParams.set("status", status)
  if (paymentStatus) queryParams.set("paymentStatus", paymentStatus)
  if (dateFrom) queryParams.set("dateFrom", dateFrom)
  if (dateTo) queryParams.set("dateTo", dateTo)
  if (sort) queryParams.set("sort", sort)
  if (String(limit) !== "20") queryParams.set("limit", String(limit))
  const returnTo = `/dashboard/orders${queryParams.toString() ? `?${queryParams.toString()}` : ""}`

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <OrderAutoRefresh />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-slate-500">Production order management with real filters, workflow actions, exports and invoice support.</p>
        </div>
        <form action="/dashboard/orders" className="grid gap-3 rounded-xl border border-[#dce3ed] bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-6">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search order, customer, email"
            className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          />
          <select name="status" defaultValue={status} className="h-10 rounded-md border border-slate-300 px-3 text-sm">
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="PROCESSING">Processing</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
            <option value="FAILED">Failed</option>
          </select>
          <select name="paymentStatus" defaultValue={paymentStatus} className="h-10 rounded-md border border-slate-300 px-3 text-sm">
            <option value="">All payments</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="REFUNDED">Refunded</option>
            <option value="FAILED">Failed</option>
          </select>
          <input type="date" name="dateFrom" defaultValue={dateFrom} className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
          <input type="date" name="dateTo" defaultValue={dateTo} className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
          <div className="flex gap-2">
            <select name="sort" defaultValue={sort} className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm">
              <option value="createdAt-desc">Newest first</option>
              <option value="createdAt-asc">Oldest first</option>
              <option value="total-desc">Total high to low</option>
              <option value="total-asc">Total low to high</option>
            </select>
            <Button type="submit" variant="outline" className="h-10">Apply</Button>
          </div>
        </form>
      </div>

      {bulkStatus === "success" ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">Updated {bulkAffected || "0"} order(s).</div> : null}
      {bulkStatus === "delete_pending" ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>{bulkAffected || "0"} order(s) moved to trash. Undo is available for 10 seconds.</span>
          {undoIds.length > 0 ? (
            <form action="/api/admin/orders/undo-delete" method="post">
              <input type="hidden" name="returnTo" value={returnTo} />
              {undoIds.map((id) => <input key={id} type="hidden" name="orderIds" value={id} />)}
              <Button type="submit" variant="outline" className="h-8">Undo</Button>
            </form>
          ) : null}
        </div>
      ) : null}
      {bulkStatus === "undo_success" ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">Restored {bulkAffected || "0"} order(s).</div> : null}
      {bulkStatus === "undo_expired" ? <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">Undo window expired.</div> : null}
      {bulkStatus === "error" ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">Order action failed.</div> : null}

      <form action="/api/admin/orders/bulk" method="post" className="overflow-hidden rounded-xl border border-[#dce3ed] bg-white shadow-sm">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="flex flex-col gap-3 border-b bg-slate-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm font-medium text-slate-700">Bulk actions</div>
          <div className="flex flex-wrap items-center gap-2">
            <select name="bulkAction" defaultValue="" className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
              <option value="" disabled>Select action</option>
              <option value="MARK_PAID">Mark paid</option>
              <option value="MARK_FULFILLED">Move to processing</option>
              <option value="MARK_REFUNDED">Refund order</option>
              <option value="MARK_SHIPPED">Mark shipped</option>
              <option value="MARK_IN_TRANSIT">Mark in transit</option>
              <option value="MARK_DELIVERED">Mark delivered</option>
              <option value="MARK_CANCELLED">Cancel order</option>
            </select>
            <Button variant="outline" type="submit" className="h-9">Apply</Button>
            <Button variant="outline" type="submit" name="dangerDelete" value="1" className="h-9 border-red-300 text-red-700 hover:bg-red-50">
              Delete selected
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]"><SelectAllCheckbox /></TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Shipment</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-slate-500">No real orders match this filter.</TableCell>
              </TableRow>
            ) : orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <input type="checkbox" name="orderIds" value={order.id} className="h-4 w-4 rounded border-slate-300" />
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/dashboard/orders/${order.id}`} className="hover:underline">{order.orderNumber}</Link>
                </TableCell>
                <TableCell>{new Date(order.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">{order.customerName || "Customer"}</div>
                    <div className="truncate text-xs text-slate-500">{order.customerEmail}</div>
                  </div>
                </TableCell>
                <TableCell><Badge variant={statusBadgeVariant(order.status)}>{order.status}</Badge></TableCell>
                <TableCell>
                  <div className="text-sm text-slate-700">{order.paymentStatus || "PENDING"}</div>
                  <div className="text-xs text-slate-500">{order.paymentMethod || "-"}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-slate-700">{order.shipmentStatus}</div>
                  <div className="text-xs text-slate-500">{order.trackingCarrier || "-"}</div>
                </TableCell>
                <TableCell className="text-right font-semibold">${order.total.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </form>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Showing page {metadata.page} of {metadata.totalPages} • {metadata.total} order(s)</p>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="h-9" disabled={page <= 1}>
            <Link href={`/dashboard/orders?${(() => {
              const prev = new URLSearchParams(queryParams)
              prev.set("page", String(Math.max(1, page - 1)))
              return prev.toString()
            })()}`}>Previous</Link>
          </Button>
          <Button asChild variant="outline" className="h-9" disabled={page >= metadata.totalPages}>
            <Link href={`/dashboard/orders?${(() => {
              const next = new URLSearchParams(queryParams)
              next.set("page", String(page + 1))
              return next.toString()
            })()}`}>Next</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
