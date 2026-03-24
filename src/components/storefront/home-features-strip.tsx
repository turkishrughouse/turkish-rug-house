import { Headset, Plane, ShoppingCart, Truck } from "lucide-react"

type HomeFeatureItem = {
  id: string
  icon: "plane" | "cart" | "support" | "truck"
  title: string
  subtitle: string
}

const FALLBACK_ITEMS: HomeFeatureItem[] = [
  { id: "feature-shipping", icon: "plane", title: "Worldwide Free", subtitle: "Shipping" },
  { id: "feature-price", icon: "cart", title: "Best Price", subtitle: "Commitment" },
  { id: "feature-support", icon: "support", title: "7/24 Support", subtitle: "" },
  { id: "feature-return", icon: "truck", title: "Easy Return", subtitle: "" },
]

function getIcon(icon: HomeFeatureItem["icon"]) {
  if (icon === "plane") return Plane
  if (icon === "cart") return ShoppingCart
  if (icon === "support") return Headset
  return Truck
}

export function HomeFeaturesStrip({ items }: { items?: HomeFeatureItem[] }) {
  const source = Array.isArray(items) && items.length > 0 ? items.slice(0, 4) : FALLBACK_ITEMS
  const normalized = source.map((item, index) => ({ ...FALLBACK_ITEMS[index], ...item }))

  return (
    <section className="w-full pb-9 pt-4">
      <div className="w-full bg-[#f7f7f7] px-3 py-5 sm:px-6 sm:py-7">
        <div className="mx-auto grid w-full max-w-[1880px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {normalized.map((item, index) => {
            const Icon = getIcon(item.icon)
            const mergedLabel = item.subtitle ? `${item.title} ${item.subtitle}` : item.title
            return (
              <div
                key={item.id}
                className="relative flex min-h-[84px] items-center rounded-2xl border border-[#e5e7eb] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] sm:min-h-[92px] sm:px-5 lg:min-h-0 lg:justify-center lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none"
              >
                <div className="flex items-center gap-3 sm:gap-3.5">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f8fafc] text-slate-900 ring-1 ring-[#e5e7eb] lg:h-auto lg:w-auto lg:rounded-none lg:bg-transparent lg:ring-0">
                    <Icon className="h-5 w-5 text-black" strokeWidth={2} />
                  </span>
                  <p className="text-[15px] font-medium leading-snug text-slate-900 sm:text-[16px] lg:whitespace-nowrap lg:text-[17px] lg:font-normal lg:leading-none lg:text-black">
                    {mergedLabel}
                  </p>
                </div>
                {index < normalized.length - 1 ? (
                  <span className="absolute -right-2 top-1/2 hidden h-9 w-px -translate-y-1/2 bg-[#e6e6e6] lg:inline-block" />
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
