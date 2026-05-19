import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getOrder } from "@/lib/actions/order-actions"
import { OrderTimeline } from "@/components/admin/orders/order-timeline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { OrderPrintAction } from "@/components/admin/orders/order-print-action"
import { OrderReadMarker } from "@/components/admin/orders/order-read-marker"
import { OrderTrackingPanel } from "@/components/admin/orders/order-tracking-panel"
import { FulfillOrderModal } from "@/components/admin/orders/fulfill-order-modal"
import { OrderStatusActions } from "@/components/admin/orders/order-status-actions"
import { OrderDocumentActions } from "@/components/admin/orders/order-document-actions"
import { formatOrderCurrency } from "@/lib/order-details"
import { OrderAutoRefresh } from "@/components/admin/orders/order-auto-refresh"
import { listRecentPaymentWebhookEvents } from "@/lib/payment-webhook-events"

interface PageProps {
  params: Promise<{ id: string }>
}

function badgeVariant(status: string) {
  if (status === "PAID" || status === "DELIVERED") return "success"
  if (status === "CANCELLED" || status === "REFUNDED") return "destructive"
  return "secondary"
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params
  const order = await getOrder(id)
  if (!order) notFound()
  const recentWebhookEvents = await listRecentPaymentWebhookEvents(order.id, 8)

  const currency = order.details.currency || "USD"
  const subtotal = Number(order.details.subtotalAmount || order.items.reduce((sum, item) => sum + item.price * item.quantity, 0))
  const shipping = Number(order.details.shippingCost || 0)
  const tax = Number(order.details.taxAmount || 0)
  const discount = Number(order.details.discountAmount || 0)
  const total = Number(order.total || subtotal + shipping + tax - discount)
  const addressLines = [
    order.details.addressLine1,
    order.details.addressLine2,
    [order.details.city, order.details.state].filter(Boolean).join(", "),
    [order.details.postcode, order.details.country].filter(Boolean).join(" "),
  ].filter(Boolean)

  return (
    <div className="flex-1 space-y-8 p-8 pt-6 max-w-[1500px] mx-auto">
      <OrderAutoRefresh />
      <OrderReadMarker orderId={order.id} />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/dashboard/orders">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{order.orderNumber}</h1>
              <Badge variant={badgeVariant(order.status)}>{order.status}</Badge>
              <Badge variant="outline">{order.details.paymentStatus || "PENDING"}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {new Date(order.createdAt).toLocaleString()} • {order.customerName || "Customer"} • {order.customerEmail}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <OrderPrintAction href={`/api/admin/orders/${order.id}/invoice?format=html`} />
            <FulfillOrderModal orderId={order.id} isFulfillable={!["CANCELLED", "REFUNDED", "DELIVERED"].includes(order.status)} />
          </div>
          <OrderDocumentActions orderId={order.id} />
        </div>
      </div>

      <OrderStatusActions orderId={order.id} status={order.status} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Order items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.length === 0 ? (
                <p className="text-sm text-slate-500">No order items found.</p>
              ) : (
                order.items.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-xl border border-[#e6ecf4] p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">SKU: {item.productId || "-"}</p>
                    </div>
                    <div className="text-sm text-slate-600">Qty {item.quantity}</div>
                    <div className="text-sm text-slate-600">{formatOrderCurrency(item.price, currency)}</div>
                    <div className="text-right font-semibold text-slate-900">{formatOrderCurrency(item.quantity * item.price, currency)}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Customer info</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="font-medium text-slate-900">Name:</span> {order.customerName || "Customer"}</div>
                <div><span className="font-medium text-slate-900">Email:</span> {order.customerEmail}</div>
                <div><span className="font-medium text-slate-900">Phone:</span> {order.details.customerPhone || "-"}</div>
                <div><span className="font-medium text-slate-900">Country / City:</span> {[order.details.country, order.details.city].filter(Boolean).join(" / ") || "-"}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Order information</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="font-medium text-slate-900">Order number:</span> {order.orderNumber}</div>
                <div><span className="font-medium text-slate-900">Order date:</span> {new Date(order.createdAt).toLocaleString()}</div>
                <div><span className="font-medium text-slate-900">Payment method:</span> {order.details.paymentMethod || "-"}</div>
                <div><span className="font-medium text-slate-900">Payment provider:</span> {order.details.paymentProvider || "-"}</div>
                <div><span className="font-medium text-slate-900">Payment status:</span> {order.details.paymentStatus || "PENDING"}</div>
                <div className="break-all"><span className="font-medium text-slate-900">Payment session ID:</span> {order.details.paymentSessionId || "-"}</div>
                <div className="break-all"><span className="font-medium text-slate-900">Payment intent ID:</span> {order.details.paymentIntentId || "-"}</div>
                <div className="break-all"><span className="font-medium text-slate-900">Last webhook event:</span> {order.details.paymentLastEventId || "-"}</div>
                <div><span className="font-medium text-slate-900">Tracked webhook events:</span> {recentWebhookEvents.length}</div>
                <div><span className="font-medium text-slate-900">Order status:</span> {order.status}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Pricing breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatOrderCurrency(subtotal, currency)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>{formatOrderCurrency(tax, currency)}</span></div>
                <div className="flex justify-between"><span>Shipping</span><span>{formatOrderCurrency(shipping, currency)}</span></div>
                <div className="flex justify-between"><span>Discount</span><span>{formatOrderCurrency(discount, currency)}</span></div>
                <div className="flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{formatOrderCurrency(total, currency)}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Shipping info</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="font-medium text-slate-900">Shipping method:</span> {order.details.shippingMethod || "-"}</div>
                <div><span className="font-medium text-slate-900">Shipping status:</span> {order.shipmentStatus}</div>
                <div className="break-all"><span className="font-medium text-slate-900">Tracking number:</span> {order.trackingNumber || "-"}</div>
                <div className="space-y-1">
                  <div className="font-medium text-slate-900">Shipping address</div>
                  {addressLines.length === 0 ? <div className="text-slate-500">No shipping address captured.</div> : addressLines.map((line) => <div key={line}>{line}</div>)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Invoice snapshot</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <div><span className="font-medium text-slate-900">Invoice number:</span> {order.details.invoiceNumber || `INV-${order.orderNumber}`}</div>
              <div><span className="font-medium text-slate-900">Issued at:</span> {order.details.invoiceIssuedAt ? new Date(order.details.invoiceIssuedAt).toLocaleString() : "-"}</div>
              <div><span className="font-medium text-slate-900">Currency:</span> {currency}</div>
              <div><span className="font-medium text-slate-900">Refunded amount:</span> {formatOrderCurrency(order.details.refundedAmount || 0, currency)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Webhook processing</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {recentWebhookEvents.length === 0 ? (
                <p className="text-slate-500">No Stripe webhook events recorded for this order yet.</p>
              ) : (
                recentWebhookEvents.map((event) => (
                  <div key={event.eventId} className="rounded-xl border border-[#e6ecf4] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-slate-900">{event.eventType}</div>
                      <Badge variant={event.status === "FAILED" ? "destructive" : event.status === "PROCESSED" ? "success" : "secondary"}>
                        {event.status}
                      </Badge>
                    </div>
                    <div className="mt-1 break-all text-xs text-slate-500">{event.eventId}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Received: {new Date(event.createdAt).toLocaleString()}
                      {event.processedAt ? ` • Processed: ${new Date(event.processedAt).toLocaleString()}` : ""}
                    </div>
                    {event.error ? <div className="mt-2 text-xs text-red-600">{event.error}</div> : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <OrderTrackingPanel
            orderId={order.id}
            trackingCarrier={order.trackingCarrier}
            trackingNumber={order.trackingNumber}
            shipmentStatus={order.shipmentStatus}
          />

          <Card>
            <CardContent className="pt-6">
              <OrderTimeline events={order.events} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
