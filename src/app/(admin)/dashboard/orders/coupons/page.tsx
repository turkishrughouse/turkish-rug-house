import { BadgePercent, Gift, Link2, Lightbulb, Users, Wallet } from "lucide-react"
import Link from "next/link"

const extensionCards = [
  {
    title: "Personalized Coupons",
    description:
      "Generate dynamic personalized coupons for your customers that increase purchase rates.",
    icon: BadgePercent,
  },
  {
    title: "Smart Coupons",
    description:
      "Powerful, all in one solution for gift certificates, store credits, discount coupons and vouchers.",
    icon: Lightbulb,
  },
  {
    title: "URL Coupons",
    description:
      "Create a unique URL that applies a discount and optionally adds one or more products to the customer's cart.",
    icon: Link2,
  },
  {
    title: "WooCommerce Store Credit",
    description:
      "Create store credit coupons for customers which are redeemable at checkout.",
    icon: Wallet,
  },
  {
    title: "Free Gift Coupons",
    description: "Give away a free item to any customer with the coupon code.",
    icon: Gift,
  },
  {
    title: "Group Coupons",
    description:
      "Coupons for groups with role-based restrictions. Useful for wholesale and member pricing.",
    icon: Users,
  },
]

export default function OrderCouponsPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Coupons</h1>
        <Link
          href="/dashboard/orders/coupons/new"
          className="rounded-md border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
        >
          Add new coupon
        </Link>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium leading-none text-blue-700">All (0)</p>
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-11 min-w-[270px] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700">
            <option>Show all types</option>
          </select>
          <button
            type="button"
            className="h-11 rounded-md border border-blue-600 bg-white px-6 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            Filter
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-300 bg-white">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="w-14 px-4 py-3">
                <input type="checkbox" className="h-5 w-5 rounded border-slate-300" />
              </th>
              {["Code", "Coupon type", "Coupon amount", "Description", "Product IDs", "Usage / Limit", "Expiry date"].map(
                (head) => (
                  <th key={head} className="px-4 py-3 text-sm font-medium text-slate-800">
                    {head}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-300">
              <td colSpan={8} className="px-4 py-4 text-sm text-slate-600">
                No coupons found
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3">
                <input type="checkbox" className="h-5 w-5 rounded border-slate-300" />
              </td>
              {["Code", "Coupon type", "Coupon amount", "Description", "Product IDs", "Usage / Limit", "Expiry date"].map(
                (cell) => (
                  <td key={cell} className="px-4 py-3 text-sm text-slate-700">
                    {cell}
                  </td>
                )
              )}
            </tr>
          </tbody>
        </table>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-300 bg-white">
        <div className="border-b border-slate-200 px-8 py-6">
          <h2 className="text-2xl font-semibold leading-tight text-slate-900">Recommended coupon extensions</h2>
          <p className="mt-2 text-lg text-slate-600">
            Take your coupon marketing to the next level with our recommended coupon extensions.
          </p>
        </div>

        <div className="grid gap-x-10 gap-y-8 px-8 py-7 md:grid-cols-2 xl:grid-cols-3">
          {extensionCards.map((item) => {
            const Icon = item.icon
            return (
              <article key={item.title} className="flex gap-4">
                <div className="mt-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-blue-500 text-blue-600">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold leading-tight text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-lg leading-snug text-slate-600">{item.description}</p>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
