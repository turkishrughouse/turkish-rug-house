"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

type CategoryNode = {
  id: string
  slug?: string
  title?: string
  image?: string | null
  children?: CategoryNode[]
}

type ShopCard = {
  key: string
  label: string
  href: string
  image: string
}

function resolveHomepageCategoryAlias(category: CategoryNode | undefined, all: CategoryNode[]) {
  if (!category) return undefined
  if (String(category.slug || "") !== "pillow-covers") return category
  return all.find((item) => String(item.slug || "") === "cushion-covers") || category
}

const DEFAULT_TARGETS = [
  { label: "Turkish Rug", slugs: ["turkish-rugs"] },
  { label: "Overdyed Rugs", slugs: ["overdyed-rugs", "overdyed"] },
  { label: "Vintage Kilims", slugs: ["vintage-kilims"] },
  { label: "Antique Rugs", slugs: ["antique"] },
  { label: "Traditional Rugs", slugs: ["traditional"] },
] as const

export function GlobalShopByCategory() {
  const [cards, setCards] = useState<ShopCard[]>(
    DEFAULT_TARGETS.map((target) => ({
      key: target.label,
      label: target.label,
      href: target.slugs[0] ? `/category/${target.slugs[0]}` : "/shop",
      image: "/placeholder.jpg",
    }))
  )
  const [cardRadius, setCardRadius] = useState({
    topLeft: 15,
    topRight: 15,
    bottomRight: 15,
    bottomLeft: 15,
  })

  useEffect(() => {
    const load = async () => {
      try {
        const [categoriesRes, settingsRes] = await Promise.all([
          fetch("/api/v1/public/categories", { cache: "no-store" }),
          fetch("/api/public/settings", { cache: "no-store" }),
        ])
        if (!categoriesRes.ok) return

        const roots = (await categoriesRes.json().catch(() => [])) as CategoryNode[]
        const settings = settingsRes.ok
          ? ((await settingsRes.json().catch(() => ({}))) as {
              shopByCategoryIds?: string[]
              categoryCardRadiusTopLeft?: number
              categoryCardRadiusTopRight?: number
              categoryCardRadiusBottomRight?: number
              categoryCardRadiusBottomLeft?: number
            })
          : {}
        setCardRadius({
          topLeft:
            typeof settings.categoryCardRadiusTopLeft === "number"
              ? Math.max(0, Math.min(200, Math.round(settings.categoryCardRadiusTopLeft)))
              : 15,
          topRight:
            typeof settings.categoryCardRadiusTopRight === "number"
              ? Math.max(0, Math.min(200, Math.round(settings.categoryCardRadiusTopRight)))
              : 15,
          bottomRight:
            typeof settings.categoryCardRadiusBottomRight === "number"
              ? Math.max(0, Math.min(200, Math.round(settings.categoryCardRadiusBottomRight)))
              : 15,
          bottomLeft:
            typeof settings.categoryCardRadiusBottomLeft === "number"
              ? Math.max(0, Math.min(200, Math.round(settings.categoryCardRadiusBottomLeft)))
              : 15,
        })

        const all = roots.flatMap((root) => [root, ...(Array.isArray(root.children) ? root.children : [])])
        const byId = new Map<string, CategoryNode>(
          all
            .filter((item): item is CategoryNode => Boolean(item?.id))
            .map((item) => [String(item.id), item])
        )

        const selectedIds = Array.isArray(settings.shopByCategoryIds)
          ? settings.shopByCategoryIds.filter((id) => typeof id === "string" && id.trim().length > 0).slice(0, 5)
          : []

        if (selectedIds.length > 0) {
          const selectedCards: ShopCard[] = selectedIds.map((id, index) => {
            const match = resolveHomepageCategoryAlias(byId.get(id), all)
            const slug = String(match?.slug || "")
            const title = String(match?.title || `Category ${index + 1}`)
            return {
              key: `${id}-${index}`,
              label: title,
              href: slug ? `/category/${slug}` : "/shop",
              image: String(match?.image || "/placeholder.jpg"),
            }
          })

          while (selectedCards.length < 5) {
            const fallback = DEFAULT_TARGETS[selectedCards.length]
            selectedCards.push({
              key: `fallback-${selectedCards.length}`,
              label: fallback.label,
              href: fallback.slugs[0] ? `/category/${fallback.slugs[0]}` : "/shop",
              image: "/placeholder.jpg",
            })
          }

          setCards(selectedCards.slice(0, 5))
          return
        }

        setCards(
          DEFAULT_TARGETS.map((target) => {
            const match =
              all.find((cat) => target.slugs.some((slug) => slug === String(cat.slug || "")) && cat.image) ||
              all.find((cat) => target.slugs.some((slug) => slug === String(cat.slug || "")))
            const slug = String(match?.slug || target.slugs[0] || "")
            return {
              key: target.label,
              label: target.label,
              href: slug ? `/category/${slug}` : "/shop",
              image: String(match?.image || "/placeholder.jpg"),
            }
          })
        )
      } catch {
        // Keep default cards
      }
    }

    void load()
  }, [])

  return (
    <section className="mx-auto mt-8 w-full max-w-[1880px] px-8">
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Shop by Category</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
          {cards.slice(0, 5).map((card) => (
            <Link
              key={card.key}
              href={card.href}
              className="group relative block cursor-pointer overflow-hidden rounded border border-slate-300 text-left transition-transform duration-300 hover:z-10 hover:scale-[1.02] hover:shadow-md"
              style={{
                borderRadius: `${cardRadius.topLeft}px ${cardRadius.topRight}px ${cardRadius.bottomRight}px ${cardRadius.bottomLeft}px`,
              }}
            >
              <div className="relative h-56 w-full overflow-hidden">
                <img
                  src={card.image || "/placeholder.jpg"}
                  alt={card.label}
                  className="absolute inset-0 block h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
              </div>
              <div className="pointer-events-none absolute bottom-0 left-0 z-10 w-full p-4">
                <div className="max-w-[85%]">
                  <div
                    className="line-clamp-2 text-left text-xl font-bold text-white sm:text-2xl"
                    style={{ textShadow: "0 2px 10px rgba(0, 0, 0, 0.65)" }}
                  >
                    {card.label}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
