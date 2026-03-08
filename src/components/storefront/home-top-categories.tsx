import Link from "next/link"

type HomeTopCategory = {
  id: string
  title: string
  slug: string
  image?: string | null
}

export function HomeTopCategories({ categories }: { categories: HomeTopCategory[] }) {
  if (categories.length === 0) return null

  return (
    <section className="container mx-auto px-6 pt-6">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {categories.slice(0, 5).map((category) => (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className="group inline-flex min-w-[170px] max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:border-emerald-300 hover:bg-emerald-50"
            >
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                {category.image ? (
                  <img src={category.image} alt={category.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                    {category.title.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="truncate text-sm font-medium text-slate-800 group-hover:text-emerald-700">{category.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

