import Link from "next/link"

export default function NewOrderCouponPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">New coupon</h1>
          <p className="text-sm text-slate-600">Create a coupon for your store.</p>
        </div>
        <Link
          href="/dashboard/orders/coupons"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to coupons
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-800">Code</span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
              placeholder="e.g. SPRING10"
              name="code"
              autoComplete="off"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-800">Amount</span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
              placeholder="e.g. 10%"
              name="amount"
              autoComplete="off"
            />
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-800">Description</span>
            <textarea
              className="min-h-[110px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder="Internal description (optional)"
              name="description"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="h-11 rounded-md bg-slate-200 px-6 text-sm font-medium text-slate-600"
            aria-disabled="true"
          >
            Save (coming soon)
          </button>
          <p className="text-sm text-slate-600">
            This route exists to prevent 404s; wiring coupon creation can be added next.
          </p>
        </div>
      </div>
    </div>
  )
}
