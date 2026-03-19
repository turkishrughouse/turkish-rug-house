import Link from "next/link"

export function BlogTableOfContents({
  items,
}: {
  items: Array<{ id: string; text: string; level: 2 | 3; anchor: string }>
}) {
  if (items.length === 0) return null

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.03)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#0f766e]">On this page</p>
      <nav className="mt-4 space-y-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`#${item.anchor}`}
            className={`block text-sm leading-6 text-slate-700 hover:text-[#0f766e] ${item.level === 3 ? "pl-3 text-slate-600" : ""}`}
          >
            {item.text}
          </Link>
        ))}
      </nav>
    </aside>
  )
}

