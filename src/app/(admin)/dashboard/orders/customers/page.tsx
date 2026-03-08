import Link from "next/link"
import { prisma } from "@/lib/db"
import { getSiteSettings } from "@/lib/site-settings"
import { formatCurrency } from "@/lib/storefront/currency"

type CustomersPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

type CustomerRow = {
  email: string
  name: string
  username: string
  userId: string | null
  orderCount: number
  totalSpend: number
  avgOrderValue: number
  dateRegistered: Date
  lastActive: Date
  countryRegion: string
  city: string
}

function getSingle(params: { [key: string]: string | string[] | undefined }, key: string) {
  const value = params[key]
  if (!value) return ""
  return Array.isArray(value) ? value[0] || "" : value
}

function buildQuery(
  current: { [key: string]: string | string[] | undefined },
  patch: Record<string, string>
) {
  const next = new URLSearchParams()
  Object.entries(current).forEach(([key, value]) => {
    if (!value) return
    if (Array.isArray(value)) {
      value.forEach((entry) => next.append(key, entry))
    } else {
      next.set(key, value)
    }
  })
  Object.entries(patch).forEach(([key, value]) => {
    if (value.trim().length === 0) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
  })
  const query = next.toString()
  return query ? `?${query}` : ""
}

export default async function OrderCustomersPage({ searchParams }: CustomersPageProps) {
  const resolved = await searchParams
  const show = getSingle(resolved, "show") || "all"
  const q = getSingle(resolved, "q").trim().toLowerCase()
  const sort = getSingle(resolved, "sort") === "last-active-asc" ? "last-active-asc" : "last-active-desc"

  const [orders, siteSettings] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        customerEmail: true,
        customerName: true,
        total: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
      },
    }),
    getSiteSettings(),
  ])
  const userIds = Array.from(
    new Set(
      orders
        .map((order) => order.userId)
        .filter((id): id is string => Boolean(id))
    )
  )
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          lastLoginAt: true,
          customerProfile: {
            select: {
              city: true,
              state: true,
              country: true,
            },
          },
        },
      })
    : []
  const userById = new Map(users.map((user) => [user.id, user]))

  const customerMap = new Map<string, CustomerRow & { firstOrderAt: Date }>()
  for (const order of orders) {
    const email = (order.customerEmail || "").trim().toLowerCase()
    if (!email) continue
    const existing = customerMap.get(email)
    const user = order.userId ? userById.get(order.userId) : undefined
    const name =
      user?.name?.trim() ||
      order.customerName?.trim() ||
      email.split("@")[0] ||
      "Customer"
    const username = email.split("@")[0] || "user"
    const orderTotal = Number(order.total || 0)
    const statePart = user?.customerProfile?.state?.trim() || ""
    const countryPart = user?.customerProfile?.country?.trim() || ""
    const countryRegion =
      statePart && countryPart
        ? `${countryPart} / ${statePart}`
        : countryPart || statePart || "—"
    const city = user?.customerProfile?.city?.trim() || "—"
    const lastActive = new Date(
      Math.max(
        order.updatedAt.getTime(),
        user?.lastLoginAt ? user.lastLoginAt.getTime() : 0
      )
    )
    const dateRegistered = user?.createdAt || order.createdAt

    if (!existing) {
      customerMap.set(email, {
        email,
        name,
        username,
        userId: order.userId || null,
        orderCount: 1,
        totalSpend: orderTotal,
        avgOrderValue: orderTotal,
        dateRegistered,
        lastActive,
        countryRegion,
        city,
        firstOrderAt: order.createdAt,
      })
      continue
    }

    existing.orderCount += 1
    existing.totalSpend += orderTotal
    existing.avgOrderValue = existing.totalSpend / existing.orderCount
    if (order.createdAt < existing.firstOrderAt) existing.firstOrderAt = order.createdAt
    if (dateRegistered < existing.dateRegistered) existing.dateRegistered = dateRegistered
    if (lastActive > existing.lastActive) existing.lastActive = lastActive
    if (existing.userId === null && order.userId) existing.userId = order.userId
    if (existing.countryRegion === "—" && countryRegion !== "—") existing.countryRegion = countryRegion
    if (existing.city === "—" && city !== "—") existing.city = city
  }

  let rows = Array.from(customerMap.values())

  if (show === "registered") rows = rows.filter((row) => Boolean(row.userId))
  if (show === "guests") rows = rows.filter((row) => !row.userId)

  if (q) {
    rows = rows.filter((row) =>
      [row.name, row.username, row.email, row.countryRegion, row.city]
        .join(" ")
        .toLowerCase()
        .includes(q)
    )
  }

  rows.sort((a, b) => {
    if (sort === "last-active-asc") return a.lastActive.getTime() - b.lastActive.getTime()
    return b.lastActive.getTime() - a.lastActive.getTime()
  })

  const totalCustomers = rows.length
  const totalOrders = rows.reduce((sum, row) => sum + row.orderCount, 0)
  const totalSpend = rows.reduce((sum, row) => sum + row.totalSpend, 0)
  const avgOrders = totalCustomers > 0 ? totalOrders / totalCustomers : 0
  const avgLifetimeSpend = totalCustomers > 0 ? totalSpend / totalCustomers : 0
  const avgOrderValue = totalOrders > 0 ? totalSpend / totalOrders : 0

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "2-digit" }).format(date)

  const nextSort = sort === "last-active-desc" ? "last-active-asc" : "last-active-desc"
  const showQuery = buildQuery(resolved, { show, q, sort })
  const showOptions: Array<{ value: string; label: string }> = [
    { value: "all", label: "All Customers" },
    { value: "registered", label: "Single Customer" },
    { value: "guests", label: "Advanced filters" },
  ]
  const activeShowLabel = showOptions.find((option) => option.value === show)?.label || "All Customers"

  return (
    <div className="flex-1 space-y-4 p-6 pt-5">
      <div className="max-w-[780px] space-y-1.5">
        <p className="text-sm font-medium text-slate-700">Show:</p>
        <details className="group relative">
          <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-md border border-slate-400 bg-white px-4 text-sm font-semibold text-[#0677b8] [&::-webkit-details-marker]:hidden">
            <span className="text-sm leading-none">{activeShowLabel}</span>
            <span className="text-lg leading-none text-[#0677b8] transition-transform group-open:rotate-180">⌄</span>
          </summary>

          <div className="absolute left-0 top-[calc(100%+10px)] z-20 w-full max-w-[640px] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
            {showOptions.map((option) => {
              const active = show === option.value
              return (
                <Link
                  key={option.value}
                  href={buildQuery(resolved, { show: option.value, q, sort })}
                  className={`flex min-h-11 items-center gap-3 border-b border-slate-300 px-4 text-sm font-medium last:border-b-0 ${
                    active
                      ? "border-[#1882c4] bg-white text-slate-700 shadow-[inset_0_0_0_2px_#1882c4]"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 ${active ? "bg-[#6d28d9]" : "bg-transparent"}`} />
                  <span>{option.label}</span>
                </Link>
              )
            })}
          </div>
        </details>
      </div>
      <div className="h-1" />
      <section className="overflow-hidden rounded-xl border border-[#dce3ed] bg-white">
        <div className="flex items-center gap-3 border-b border-[#dce3ed] px-4 py-3">
          <h2 className="min-w-[96px] text-lg font-semibold text-slate-900">Customers</h2>
          <form method="GET" className="flex flex-1 items-center gap-2">
            <input type="hidden" name="show" defaultValue={show} />
            <input type="hidden" name="sort" defaultValue={sort} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by name, email, username, country or city..."
              className="h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#1882c4]"
            />
            <button className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Search
            </button>
          </form>
          <span className="text-base text-slate-700">⋮</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-[#f8fafc]">
              <tr className="border-b border-[#dce3ed] text-left">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-700">Name</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-700">Username</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  <Link href={buildQuery(resolved, { sort: nextSort })} className="inline-flex items-center gap-1 hover:text-[#136ca5]">
                    Last active
                    <span>{sort === "last-active-desc" ? "▼" : "▲"}</span>
                  </Link>
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-700">Date registered</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-700">Email</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-700">Orders</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-700">Total spend</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-700">AOV</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-700">Country / Region</th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-700">City</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-base font-medium text-slate-500">
                    No data to display
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.email} className="border-b border-[#e7edf5] text-sm text-slate-700">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/orders${showQuery ? `${showQuery}&customer=${encodeURIComponent(row.email)}` : `?customer=${encodeURIComponent(row.email)}`}`} className="font-medium text-slate-900 hover:text-[#136ca5]">
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.username}</td>
                    <td className="px-4 py-3">{formatDate(row.lastActive)}</td>
                    <td className="px-4 py-3">{formatDate(row.dateRegistered)}</td>
                    <td className="px-4 py-3">
                      <a href={`mailto:${row.email}`} className="hover:text-[#136ca5]">
                        {row.email}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/orders?customerEmail=${encodeURIComponent(row.email)}`} className="font-medium hover:text-[#136ca5]">
                        {row.orderCount}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {formatCurrency(row.totalSpend, {
                        defaultCurrency: siteSettings.defaultCurrency,
                        currencyPosition: siteSettings.currencyPosition,
                        thousandSeparator: siteSettings.thousandSeparator,
                        decimalSeparator: siteSettings.decimalSeparator,
                        numberOfDecimals: siteSettings.numberOfDecimals,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {formatCurrency(row.avgOrderValue, {
                        defaultCurrency: siteSettings.defaultCurrency,
                        currencyPosition: siteSettings.currencyPosition,
                        thousandSeparator: siteSettings.thousandSeparator,
                        decimalSeparator: siteSettings.decimalSeparator,
                        numberOfDecimals: siteSettings.numberOfDecimals,
                      })}
                    </td>
                    <td className="px-4 py-3">{row.countryRegion}</td>
                    <td className="px-4 py-3">{row.city}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 border-t border-[#dce3ed] px-4 py-3 text-sm text-slate-700">
          <span>
            <strong>{totalCustomers}</strong> customers
          </span>
          <span>
            <strong>{avgOrders.toFixed(0)}</strong> Average orders
          </span>
          <span>
            <strong>
              {formatCurrency(avgLifetimeSpend, {
                defaultCurrency: siteSettings.defaultCurrency,
                currencyPosition: siteSettings.currencyPosition,
                thousandSeparator: siteSettings.thousandSeparator,
                decimalSeparator: siteSettings.decimalSeparator,
                numberOfDecimals: siteSettings.numberOfDecimals,
              })}
            </strong>{" "}
            Average lifetime spend
          </span>
          <span>
            <strong>
              {formatCurrency(avgOrderValue, {
                defaultCurrency: siteSettings.defaultCurrency,
                currencyPosition: siteSettings.currencyPosition,
                thousandSeparator: siteSettings.thousandSeparator,
                decimalSeparator: siteSettings.decimalSeparator,
                numberOfDecimals: siteSettings.numberOfDecimals,
              })}
            </strong>{" "}
            Average order value
          </span>
        </div>
      </section>
    </div>
  )
}
