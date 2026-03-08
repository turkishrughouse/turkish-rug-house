"use client"

import Link from "next/link"
import type { Category } from "@prisma/client"

interface CategoryGridProps {
    categories: Category[]
}

function CategoryTile({
    category,
    className,
    isTall = false,
}: {
    category: Category
    className?: string
    isTall?: boolean
}) {
    const hasImage = !!category.image

    return (
        <Link
            href={`/category/${category.slug}`}
            className={`group block overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}
        >
            <div className="relative overflow-hidden bg-slate-100">
                {hasImage ? (
                    <img
                        src={category.image!}
                        alt={category.title}
                        className={`h-full w-full object-contain object-center transition-transform duration-500 group-hover:scale-[1.02] ${isTall ? "aspect-[3/4]" : "aspect-[16/10]"}`}
                    />
                ) : (
                    <div className={`${isTall ? "aspect-[3/4]" : "aspect-[16/10]"} h-full w-full bg-slate-200`} />
                )}
            </div>

            <div className="border-t border-slate-200 bg-white px-4 py-2 text-center">
                <h3 className="truncate text-sm font-medium text-slate-900">
                    {category.title}
                </h3>
            </div>
        </Link>
    )
}

const DEFAULT_TITLES = [
    "Vintage Turkish & Oriental Rugs",
    "Overdyed Vintage Rugs",
    "Vintage Handwoven Kilim Rugs",
    "New Handwoven Kilim Rugs",
    "Handwoven Runners" // This one is the tall tile
]

export function CategoryGrid({ categories }: CategoryGridProps) {
    // 1. Try to find categories matching the specific default titles in order
    // 2. Fallback to just filling the list with whatever is available

    const matchedCategories: (Category | null)[] = DEFAULT_TITLES.map(title =>
        categories.find(c => c.title.toLowerCase().includes(title.toLowerCase())) || null
    )

    // Fill gaps in matchedCategories with other categories that haven't been used
    const usedIds = new Set(matchedCategories.filter(Boolean).map(c => c!.id))

    const finalSelection = matchedCategories.map((match) => {
        if (match) return match
        // Find a category not yet used
        const available = categories.find(c => !usedIds.has(c.id))
        if (available) {
            usedIds.add(available.id)
            return available
        }
        return null
    }).filter(Boolean) as Category[]

    // If we still don't have enough, we might show fewer or placeholders.
    // We need 5 items for the perfect layout. 
    // If < 5, we can just render strict grid. But let's aim for the request.

    // Split: 0,1,2,3 for Left Grid. 4 for Right Tall.
    const leftGridCats = finalSelection.slice(0, 4)
    const rightTallCat = finalSelection[4]

    if (finalSelection.length === 0) return null

    return (
        <section className="container mx-auto px-4 pt-6 pb-8">
            <div className="flex flex-col lg:flex-row gap-3 h-auto lg:h-[600px]">

                {/* LEFT: 2x2 Grid (Takes 2/3 width on large screens) */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 h-full">
                    {leftGridCats.map((cat) => (
                        <CategoryTile
                            key={cat.id}
                            category={cat}
                            className="h-full w-full"
                        />
                    ))}
                    {/* Fill empty slots if we have < 4 items for grid? Optional logic */}
                </div>

                {/* RIGHT: Tall Item (Takes 1/3 width on large screens) */}
                {rightTallCat && (
                    <div className="w-full lg:w-1/3 h-[400px] lg:h-full">
                        <CategoryTile
                            category={rightTallCat}
                            isTall={true}
                            className="h-full w-full"
                        />
                    </div>
                )}
            </div>
        </section>
    )
}
