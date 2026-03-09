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
      <div className="w-full bg-[#f7f7f7] px-3 py-6 sm:px-6 sm:py-7">
        <div className="mx-auto grid w-full max-w-[1880px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {normalized.map((item, index) => {
            const Icon = getIcon(item.icon)
            const mergedLabel = item.subtitle ? `${item.title} ${item.subtitle}` : item.title
            return (
              <div key={item.id} className="relative flex items-center justify-center">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <Icon className="h-5 w-5 text-black" strokeWidth={2} />
                  <p className="text-[15px] font-normal leading-tight text-black sm:whitespace-nowrap sm:text-[17px] sm:leading-none">
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
