import { notFound } from "next/navigation"
import { getOrder } from "@/lib/actions/order-actions"
import { OrderTimeline } from "@/components/admin/orders/order-timeline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { FulfillOrderModal } from "@/components/admin/orders/fulfill-order-modal"
import { OrderPrintAction } from "@/components/admin/orders/order-print-action" // Will create this small client comp
import { OrderReadMarker } from "@/components/admin/orders/order-read-marker"
import { OrderTrackingPanel } from "@/components/admin/orders/order-tracking-panel"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: PageProps) {
    const { id } = await params
    const order = await getOrder(id)

    if (!order) {
        notFound()
    }

    const isFulfillable = order.status !== 'FULFILLED' && order.status !== 'CANCELLED' && order.status !== 'REFUNDED'
    const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const discount = 0
    const tax = 0
    const paid = 0
    const total = Math.max(0, subtotal - discount + tax - paid)

    return (
        <div className="flex-1 space-y-8 p-8 pt-6 max-w-[1600px] mx-auto print:p-0 print:max-w-none">
            <OrderReadMarker orderId={order.id} />
            {/* Header - Hidden on Print */}
            <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/orders">
                        <Button variant="outline" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                            {order.orderNumber}
                            <Badge variant={order.status === 'PAID' ? 'success' : order.status === 'FULFILLED' ? 'default' : 'secondary'}>
                                {order.status}
                            </Badge>
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {new Date(order.createdAt).toLocaleString()} • {order.customerName}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <OrderPrintAction />
                    <FulfillOrderModal orderId={order.id} isFulfillable={isFulfillable} />
                </div>
            </div>

            <div className="hidden print:block">
                <div className="mx-auto w-full max-w-[820px] rounded-sm border border-slate-300 bg-white">
                    <div className="border-b border-slate-300 p-6">
                        <div className="flex items-start justify-between gap-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded bg-[#344767] text-xs font-bold text-white">RH</div>
                                <div>
                                    <p className="text-lg font-semibold text-slate-900">RugHouse</p>
                                    <p className="text-xs text-slate-600">Invoice Number: {order.orderNumber}</p>
                                    <p className="text-xs text-slate-600">Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="bg-[#344767] px-5 py-2 text-3xl font-bold tracking-wide text-white">INVOICE</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 border-b border-slate-300 p-6 text-sm">
                        <div>
                            <p className="mb-2 font-semibold text-slate-900">Bill from:</p>
                            <p className="text-slate-700">Turkish Rug House</p>
                            <p className="text-slate-700">123 Rug Street, Istanbul</p>
                            <p className="text-slate-700">support@turkishrughouse.com</p>
                        </div>
                        <div>
                            <p className="mb-2 font-semibold text-slate-900">Bill to:</p>
                            <p className="text-slate-700">{order.customerName || "Customer"}</p>
                            <p className="text-slate-700">{order.customerEmail}</p>
                            <p className="text-slate-700">{order.trackingCarrier ? `Carrier: ${order.trackingCarrier}` : "Carrier: -"}</p>
                        </div>
                    </div>

                    <div className="p-6">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-y border-slate-300 text-left">
                                    <th className="py-2 font-semibold">Item</th>
                                    <th className="py-2 text-center font-semibold">Quantity</th>
                                    <th className="py-2 text-right font-semibold">Rate</th>
                                    <th className="py-2 text-right font-semibold">Tax</th>
                                    <th className="py-2 text-right font-semibold">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item) => (
                                    <tr key={item.id} className="border-b border-slate-200">
                                        <td className="py-3 text-slate-900">{item.title}</td>
                                        <td className="py-3 text-center text-slate-700">{item.quantity}</td>
                                        <td className="py-3 text-right text-slate-700">${item.price.toFixed(2)}</td>
                                        <td className="py-3 text-right text-slate-700">$0.00</td>
                                        <td className="py-3 text-right font-medium text-slate-900">${(item.price * item.quantity).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="mt-5 border-t border-slate-300 pt-4">
                            <p className="text-sm text-slate-700">Terms & Conditions:</p>
                            <p className="mt-1 text-xs text-slate-500">All sales are subject to Turkish Rug House order and shipping terms.</p>
                        </div>

                        <div className="mt-5 flex justify-end">
                            <div className="w-full max-w-[300px] space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-700">Subtotal:</span>
                                    <span className="text-slate-900">${subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-700">Discount:</span>
                                    <span className="text-slate-900">${discount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-700">Tax:</span>
                                    <span className="text-slate-900">${tax.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-700">Paid:</span>
                                    <span className="text-slate-900">${paid.toFixed(2)}</span>
                                </div>
                                <div className="mt-2 flex items-center justify-between bg-[#344767] px-4 py-2 text-xl font-bold text-white">
                                    <span>Total</span>
                                    <span>${total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Separator className="print:hidden" />

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 print:hidden">
                {/* Main Content (Left 2 cols) */}
                <div className="space-y-6 lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Items</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {order.items.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between border-b py-4 last:border-0">
                                        <div className="flex gap-4">
                                            <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-slate-100 text-xs font-medium text-muted-foreground">
                                                IMG
                                            </div>
                                            <div>
                                                <Link href={`/dashboard/products/${item.productId}`} className="font-medium hover:underline text-black">
                                                    {item.title}
                                                </Link>
                                                <div className="text-sm text-muted-foreground">Qty: {item.quantity}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium">${item.price.toFixed(2)}</div>
                                            <div className="text-xs text-muted-foreground">
                                                Total: ${(item.price * item.quantity).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between border-t pt-4 text-lg font-bold">
                                    <span>Total</span>
                                    <span>${order.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium">Customer</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm">
                                <div className="font-medium">{order.customerName}</div>
                                <div className="text-muted-foreground">{order.customerEmail}</div>
                                <Link
                                    href={`/dashboard/users?q=${encodeURIComponent(order.customerEmail)}`}
                                    className="mt-2 block text-teal-600 hover:underline"
                                >
                                    View Profile
                                </Link>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium">Shipping Address</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm">
                                <div>123 Rug Avenue</div>
                                <div>Istanbul, TR 34000</div>
                                <div className="mt-1 text-muted-foreground">Via DHL Express</div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="space-y-6">
                    <OrderTrackingPanel
                        orderId={order.id}
                        trackingCarrier={order.trackingCarrier}
                        trackingNumber={order.trackingNumber}
                        shipmentStatus={order.shipmentStatus}
                    />
                    <Card className="h-full border-none shadow-none bg-transparent lg:bg-white lg:border lg:shadow-sm">
                        <CardContent className="pt-6">
                            <OrderTimeline events={order.events} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
