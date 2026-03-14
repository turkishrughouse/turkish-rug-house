import Link from "next/link"
import { notFound } from "next/navigation"
import { House } from "lucide-react"
import { prisma } from "@/lib/db"
import { formatOrderCurrency, getOrderDisplaySummary, getSingleOrderDetails } from "@/lib/order-details"
import { CheckoutSuccessClient } from "@/components/storefront/checkout-success-client"

export const dynamic = "force-dynamic"

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const params = await searchParams
  const orderId = String(params.order || "").trim()
  if (!orderId) notFound()

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })
  if (!order) notFound()

  const details = await getSingleOrderDetails(order.id)
  const display = getOrderDisplaySummary(details)

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <CheckoutSuccessClient />
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Payment completed</p>
          <h1 className="mt-3 text-4xl font-semibold text-slate-900">Thank you for your order</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Your payment was processed securely and your one-of-a-kind piece is now reserved.
            We will prepare your order carefully and share shipping updates as soon as it is dispatched from Turkey.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3 text-sm text-slate-500">
            <Link href="/" className="inline-flex items-center gap-2 hover:text-slate-900">
              <House className="h-4 w-4" />
              Home
            </Link>
            <span>/</span>
            <span>Order Confirmation</span>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-[1200px] gap-6 px-6 py-10 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Order number</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">{order.orderNumber}</h2>
            </div>
            <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              Payment received
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">Quantity: {item.quantity}</p>
                </div>
                <p className="font-semibold text-slate-900">
                  {formatOrderCurrency(
                    display.displayCurrency === "USD"
                      ? Number(item.price) * item.quantity
                      : Math.round(Number(item.price) * item.quantity * display.exchangeRateUsed * 100) / 100,
                    display.displayCurrency
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
          <h3 className="text-xl font-semibold text-slate-900">Order summary</h3>
          <dl className="mt-5 space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-4">
              <dt>Customer</dt>
              <dd className="text-right font-medium text-slate-900">{order.customerName || "-"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>Email</dt>
              <dd className="text-right font-medium text-slate-900">{order.customerEmail}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>Shipping</dt>
              <dd className="text-right font-medium text-slate-900">{details.shippingMethod || "-"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>Payment</dt>
              <dd className="text-right font-medium text-slate-900">{details.paymentMethod || "-"}</dd>
            </div>
            <div className="border-t border-slate-200 pt-3 flex items-center justify-between gap-4">
              <dt className="font-semibold text-slate-900">Total</dt>
              <dd className="text-right text-lg font-semibold text-slate-900">
                {formatOrderCurrency(display.total, display.displayCurrency)}
              </dd>
            </div>
          </dl>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
            Your payment details were processed by the payment gateway and were not stored in our database.
          </div>

          <div className="mt-6 grid gap-3">
            <Link href="/shop" className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800">
              Continue Shopping
            </Link>
            <Link href="/account" className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              View My Account
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
