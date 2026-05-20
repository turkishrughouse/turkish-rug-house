import Link from "next/link"
import { ChevronDown } from "lucide-react"

type TopBarMenuItem = {
  id: string
  label: string
  url: string
}

export function TopBar({
  items,
  language,
  currency,
}: {
  items: TopBarMenuItem[]
  language: string
  currency: string
}) {
  const hasFaqItem = items.some((item) => (item.label || "").trim().toLowerCase() === "faq")

  return (
    <div className="bg-white border-b border-slate-100 hidden md:block">
      <div className="container mx-auto px-6 h-9 flex items-center justify-between text-[11px] font-medium tracking-wide uppercase text-slate-500">
        <div className="flex items-center gap-6">
          {items.length > 0 ? (
            <>
              {items.map((item) => (
                <Link key={item.id} href={item.url || "#"} className="hover:text-slate-900 transition-colors">
                  {item.label}
                </Link>
              ))}
              {!hasFaqItem ? (
                <Link href="/faq" className="hover:text-slate-900 transition-colors">
                  FAQ
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <Link href="/info/about" className="hover:text-slate-900 transition-colors">About Us</Link>
              <Link href="/support" className="hover:text-slate-900 transition-colors">Help</Link>
              <Link href="/info/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
              <Link href="/faq" className="hover:text-slate-900 transition-colors">FAQ</Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 hover:text-slate-900 transition-colors">
            {language}
            <ChevronDown className="h-3 w-3" />
          </span>
          <span className="flex items-center gap-1 hover:text-slate-900 transition-colors">
            {currency}
            <ChevronDown className="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>
  )
}
