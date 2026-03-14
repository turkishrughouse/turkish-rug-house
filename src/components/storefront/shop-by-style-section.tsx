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
                <>
                  <img
                    src={category.image}
                    alt={category.title}
                    className="absolute inset-0 block h-full w-full object-contain object-center transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />
                </>
              ) : (
                <div className="absolute inset-0 bg-slate-100" />
              )}
            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 z-10 w-full p-4">
              <div className="max-w-[82%] rounded-md bg-black/40 px-4 py-3">
                <h3
                  className={`line-clamp-2 text-left font-semibold uppercase tracking-[0.08em] ${
                    category.image ? "text-base text-white sm:text-lg" : "text-xs text-slate-600 sm:text-sm"
                  }`}
                  style={category.image ? { textShadow: "0 2px 10px rgba(0, 0, 0, 0.65)" } : undefined}
                >
                  {category.title}
                </h3>
                {!category.image ? <div className="mt-2 h-px w-12 bg-slate-300" /> : null}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
