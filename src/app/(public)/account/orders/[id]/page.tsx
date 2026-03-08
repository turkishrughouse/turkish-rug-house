import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { prisma } from "@/lib/db"

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser("customer")
  if (!user) {
    redirect("/account/auth")
  }

  const { id } = await params
  const order = await prisma.order.findFirst({
    where: {
      id,
      OR: [{ userId: user.id }, { customerEmail: user.email.toLowerCase() }],
    },
    include: {
      items: true,
      events: {
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!order) {
    notFound()
  }

  const orderTotal = order.total.toNumber()

  return (
    <section className="border-t border-slate-200 bg-[#f5f7fb]">
      <div className="mx-auto w-full max-w-[1080px] px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Order details</p>
              <h1 className="text-2xl font-semibold text-slate-900">{order.orderNumber}</h1>
              <p className="mt-1 text-sm text-slate-600">{new Date(order.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/account?tab=orders" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Back to my orders
              </Link>
              {order.trackingUrl ? (
                <Link
                  href={order.trackingUrl}
                  target="_blank"
                  className="rounded-md border border-teal-600 bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  Track shipment
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Order status</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{order.status}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Shipment status</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{order.shipmentStatus}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
              <p className="mt-1 text-sm font-semibold text-emerald-700">${orderTotal.toFixed(2)}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Tracking</p>
            <p className="mt-1 text-sm text-slate-700">
              Carrier: <span className="font-semibold text-slate-900">{order.trackingCarrier || "-"}</span>
            </p>
            <p className="text-sm text-slate-700">
              Number: <span className="font-semibold text-slate-900">{order.trackingNumber || "-"}</span>
            </p>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-semibold text-slate-900">Items</h2>
            <div className="mt-3 space-y-2">
              {order.items.length === 0 ? (
                <p className="text-sm text-slate-500">No items found.</p>
              ) : (
                order.items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-700">
                        {item.quantity} x ${item.price.toNumber().toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-semibold text-slate-900">Order timeline</h2>
            <div className="mt-3 space-y-2">
              {order.events.length === 0 ? (
                <p className="text-sm text-slate-500">No timeline activity yet.</p>
              ) : (
                order.events.map((event) => (
                  <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    {event.description ? <p className="mt-1 text-sm text-slate-600">{event.description}</p> : null}
                    <p className="mt-1 text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

