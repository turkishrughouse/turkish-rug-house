import { prisma } from "@/lib/db"
import { requireDealerUser } from "@/lib/dealer-auth"

export const dynamic = "force-dynamic"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export default async function DealerOrdersPage() {
  await requireDealerUser()
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerEmail: true,
      total: true,
      status: true,
      shipmentStatus: true,
      createdAt: true,
    },
  })

  return (
    <div className="min-h-screen bg-[#f8f4ee]">
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="border-b border-[#e5ddd2] pb-5">
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Turkish Rug House</div>
          <h1 className="mt-2 text-[30px] font-medium tracking-tight text-slate-900">Dealer Orders</h1>
          <p className="mt-2 text-sm text-slate-600">
            Read-only wholesale order visibility using the shared orders table.
          </p>
        </div>

        <div className="overflow-hidden rounded-sm border border-[#dcdcde] bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#ece6dc]">
              <thead className="bg-[#faf7f3]">
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Shipment</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece6dc]">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="text-sm text-slate-700">
                      <td className="px-4 py-3 font-medium text-slate-900">{order.orderNumber}</td>
                      <td className="px-4 py-3">{order.customerName || "-"}</td>
                      <td className="px-4 py-3">{order.customerEmail}</td>
                      <td className="px-4 py-3">{formatCurrency(order.total.toNumber())}</td>
                      <td className="px-4 py-3">{order.status}</td>
                      <td className="px-4 py-3">{order.shipmentStatus}</td>
                      <td className="px-4 py-3">{order.createdAt.toISOString().slice(0, 10)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
