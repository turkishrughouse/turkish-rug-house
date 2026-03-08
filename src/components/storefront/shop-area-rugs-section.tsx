import Link from "next/link"

type AreaCategory = {
  id: string
  title: string
  slug: string
  image?: string | null
}

export function ShopAreaRugsSection({ categories }: { categories: AreaCategory[] }) {
  if (!categories.length) return null

  return (
    <section className="container mx-auto px-4 py-10">
      <div className="mb-6 border-b border-slate-200 pb-2">
        <h2 className="text-4xl font-semibold text-slate-900">Shop Our Area Rugs and Runners</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.slice(0, 6).map((category) => (
          <Link
            key={category.id}
            href={`/category/${category.slug}`}
            className="group overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <div className="bg-slate-100">
              {category.image ? (
                <img
                  src={category.image}
                  alt={category.title}
                  className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="h-56 w-full bg-slate-200" />
              )}
            </div>
            <div className="border-t border-slate-200 px-3 py-2 text-center">
              <p className="truncate text-lg font-medium text-slate-900">{category.title}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
