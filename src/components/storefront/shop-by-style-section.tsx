import Link from "next/link"

type ShopCategory = {
  id: string
  title: string
  slug: string
  image?: string | null
}

export function ShopByStyleSection({
  categories,
  radius = { topLeft: 15, topRight: 15, bottomRight: 15, bottomLeft: 15 },
}: {
  categories: ShopCategory[]
  radius?: {
    topLeft: number
    topRight: number
    bottomRight: number
    bottomLeft: number
  }
}) {
  if (!categories.length) return null

  const visible = categories.slice(0, 8)

  return (
    <section className="container mx-auto px-4 pt-5 pb-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((category) => (
          <Link
            key={category.id}
            href={`/category/${category.slug}`}
            className="group relative block overflow-hidden shadow-[0_6px_18px_rgba(15,23,42,0.06)]"
            style={{
              borderRadius: `${radius.topLeft}px ${radius.topRight}px ${radius.bottomRight}px ${radius.bottomLeft}px`,
            }}
          >
            <div className="relative aspect-[3/4] overflow-hidden">
              {category.image ? (
                <img
                  src={category.image}
                  alt={category.title}
                  className="absolute inset-0 block h-full w-full object-contain object-center transition-transform duration-300 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {category.title}
                </div>
              )}
            </div>
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
                <div className="relative z-10 rounded-md bg-black/35 px-5 py-2">
                  <h3
                    className="line-clamp-2 text-[24px] font-bold text-white sm:text-[28px]"
                    style={{ textShadow: "0 2px 10px rgba(0, 0, 0, 0.65)" }}
                  >
                    {category.title}
                  </h3>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
