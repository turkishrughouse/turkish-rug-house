import Link from "next/link"
import { getInventoryProducts } from "@/lib/admin-inventory"
import { requireDealerUser } from "@/lib/dealer-auth"
import { ResponsiveImage } from "@/components/ui/responsive-image"

export const dynamic = "force-dynamic"

function formatCurrency(value: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function resolveImage(imageUrls: string[]) {
  return imageUrls[0] || "/placeholder.jpg"
}

export default async function DealerInventoryPage() {
  await requireDealerUser()
  const inventory = await getInventoryProducts({
    status: "ALL",
    includeSoldData: false,
  })

  return (
    <div className="min-h-screen bg-[#f8f4ee]">
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="border-b border-[#e5ddd2] pb-5">
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Turkish Rug House</div>
          <h1 className="mt-2 text-[30px] font-medium tracking-tight text-slate-900">Dealer Inventory</h1>
          <p className="mt-2 text-sm text-slate-600">
            Read-only wholesale inventory view backed by the shared Turkish Rug House product catalog.
          </p>
        </div>

        <div className="overflow-hidden rounded-sm border border-[#dcdcde] bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#ece6dc]">
              <thead className="bg-[#faf7f3]">
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4 py-3 font-medium">Image</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Dealer Price</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Business Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece6dc]">
                {inventory.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                      No dealer inventory records found.
                    </td>
                  </tr>
                ) : (
                  inventory.rows.map((row) => (
                    <tr key={row.id} className="text-sm text-slate-700">
                      <td className="px-4 py-3">
                        <div className="relative h-16 w-16 overflow-hidden rounded-sm border border-[#ece6dc] bg-[#f4efe8]">
                          <ResponsiveImage
                            src={resolveImage(row.imageUrls)}
                            alt={row.title}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.sku || "-"}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <Link href={`/dealer/inventory?product=${row.slug}`} className="hover:underline">
                          {row.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{row.category || "-"}</td>
                      <td className="px-4 py-3">{formatCurrency(row.price)}</td>
                      <td className="px-4 py-3">{row.stockCount}</td>
                      <td className="px-4 py-3">{row.businessStatus}</td>
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
