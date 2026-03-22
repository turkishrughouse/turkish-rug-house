"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"

// Types
interface Option {
    id: string
    name: string
    slug: string
}

interface FilterOptions {
    types: Option[]
    styles: Option[]
    colors: (Option & { hex?: string | null })[]
    sizes: Option[]
    ages: Option[]
}

interface CategoryFilterBarProps {
    options: FilterOptions
}

function FilterButton({
    label,
    id,
    activeCount,
    openFilter,
    onToggle,
}: {
    label: string
    id: string
    activeCount: number
    openFilter: string | null
    onToggle: (id: string) => void
}) {
    return (
        <button
            onClick={() => onToggle(id)}
            className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all",
                openFilter === id ? "border-slate-900 bg-slate-900 text-white" :
                    activeCount > 0 ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
            )}
        >
            {label}
            {activeCount > 0 && (
                <span className={cn(
                    "flex items-center justify-center w-5 h-5 rounded-full text-[10px]",
                    openFilter === id ? "bg-white text-slate-900" : "bg-slate-900 text-white"
                )}>
                    {activeCount}
                </span>
            )}
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", openFilter === id && "rotate-180")} />
        </button>
    )
}

function FilterDropdown({
    id,
    openFilter,
    onClose,
    children,
}: {
    id: string
    openFilter: string | null
    onClose: () => void
    children: React.ReactNode
}) {
    if (openFilter !== id) return null

    return (
        <div className="absolute top-full mt-2 left-0 w-full max-w-7xl mx-auto px-6 z-40">
            <div className="bg-white rounded-xl shadow-xl border border-slate-100 p-6 animate-in slide-in-from-top-2 fade-in duration-200">
                {children}
            </div>
            <div className="fixed inset-0 z-[-1]" onClick={onClose} />
        </div>
    )
}

export function CategoryFilterBar({ options }: CategoryFilterBarProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // UI State
    const [openFilter, setOpenFilter] = React.useState<string | null>(null)

    // Current Values
    const getValues = (key: string) => searchParams.getAll(key)
    const hasValue = (key: string, value: string) => searchParams.getAll(key).includes(value)

    const updateFilter = (key: string, value: string, single = false) => {
        const params = new URLSearchParams(searchParams.toString())

        if (single) {
            if (params.get(key) === value) params.delete(key)
            else params.set(key, value)
        } else {
            const current = params.getAll(key)
            if (current.includes(value)) {
                params.delete(key)
                current.filter(c => c !== value).forEach(c => params.append(key, c))
            } else {
                params.append(key, value)
            }
        }

        // Reset page on filter change
        params.delete('page')

        router.push(`?${params.toString()}`, { scroll: false })
    }

    const removeFilter = (key: string, value: string) => {
        updateFilter(key, value)
    }

    const clearAll = () => {
        router.push(window.location.pathname)
    }
    const toggleFilter = (id: string) => setOpenFilter(openFilter === id ? null : id)
    const closeFilter = () => setOpenFilter(null)

    // Active Filters List (Chips)
    const activeFilters = [
        ...options.types.filter(o => hasValue('type', o.slug)).map(o => ({ key: 'type', ...o })),
        ...options.styles.filter(o => hasValue('style', o.slug)).map(o => ({ key: 'style', ...o })),
        ...options.colors.filter(o => hasValue('color', o.slug)).map(o => ({ key: 'color', ...o })),
        ...options.sizes.filter(o => hasValue('size', o.slug)).map(o => ({ key: 'size', ...o })),
        ...options.ages.filter(o => hasValue('age', o.slug)).map(o => ({ key: 'age', ...o })),
    ]
    if (searchParams.get('inStock') === 'true') activeFilters.push({ key: 'inStock', name: 'In Stock', id: 'stock', slug: 'true' })

    return (
        <div className="relative mb-8">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 pb-4">
                <FilterButton label="Type" id="type" activeCount={getValues('type').length} openFilter={openFilter} onToggle={toggleFilter} />
                <FilterButton label="Size" id="size" activeCount={getValues('size').length} openFilter={openFilter} onToggle={toggleFilter} />
                <FilterButton label="Age" id="age" activeCount={getValues('age').length} openFilter={openFilter} onToggle={toggleFilter} />
                <FilterButton label="Price" id="price" activeCount={0} openFilter={openFilter} onToggle={toggleFilter} /> {/* Todo: Price count */}
                <FilterButton label="Style" id="style" activeCount={getValues('style').length} openFilter={openFilter} onToggle={toggleFilter} />
                <FilterButton label="Color" id="color" activeCount={getValues('color').length} openFilter={openFilter} onToggle={toggleFilter} />

                <div className="h-6 w-px bg-slate-200 mx-2" />

                <div className="flex items-center gap-2">
                    <Checkbox
                        id="stock"
                        checked={searchParams.get('inStock') === 'true'}
                        onCheckedChange={(checked) => {
                            const params = new URLSearchParams(searchParams.toString())
                            if (checked) params.set('inStock', 'true')
                            else params.delete('inStock')
                            router.push(`?${params.toString()}`, { scroll: false })
                        }}
                    />
                    <label htmlFor="stock" className="text-sm font-medium cursor-pointer select-none">In Stock Only</label>
                </div>
            </div>

            {/* Dropdowns */}
            <FilterDropdown id="type" openFilter={openFilter} onClose={closeFilter}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {options.types.map(opt => (
                        <label key={opt.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors">
                            <Checkbox checked={hasValue('type', opt.slug)} onCheckedChange={() => updateFilter('type', opt.slug)} />
                            <span className="text-sm">{opt.name}</span>
                        </label>
                    ))}
                </div>
            </FilterDropdown>

            <FilterDropdown id="size" openFilter={openFilter} onClose={closeFilter}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {options.sizes.map(opt => (
                        <label key={opt.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors">
                            <Checkbox checked={hasValue('size', opt.slug)} onCheckedChange={() => updateFilter('size', opt.slug)} />
                            <span className="text-sm">{opt.name}</span>
                        </label>
                    ))}
                </div>
            </FilterDropdown>

            <FilterDropdown id="age" openFilter={openFilter} onClose={closeFilter}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {options.ages.map(opt => (
                        <label key={opt.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors">
                            <Checkbox checked={hasValue('age', opt.slug)} onCheckedChange={() => updateFilter('age', opt.slug)} />
                            <span className="text-sm">{opt.name}</span>
                        </label>
                    ))}
                </div>
            </FilterDropdown>

            <FilterDropdown id="style" openFilter={openFilter} onClose={closeFilter}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {options.styles.map(opt => (
                        <label key={opt.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors">
                            <Checkbox checked={hasValue('style', opt.slug)} onCheckedChange={() => updateFilter('style', opt.slug)} />
                            <span className="text-sm">{opt.name}</span>
                        </label>
                    ))}
                </div>
            </FilterDropdown>

            <FilterDropdown id="color" openFilter={openFilter} onClose={closeFilter}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {options.colors.map(opt => (
                        <label key={opt.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded transition-colors">
                            <Checkbox checked={hasValue('color', opt.slug)} onCheckedChange={() => updateFilter('color', opt.slug)} />
                            <div className="flex items-center gap-2">
                                {opt.hex && <div className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: opt.hex }} />}
                                <span className="text-sm">{opt.name}</span>
                            </div>
                        </label>
                    ))}
                </div>
            </FilterDropdown>

            <FilterDropdown id="price" openFilter={openFilter} onClose={closeFilter}>
                <div className="max-w-md">
                    <p className="text-sm text-slate-500 mb-4">Price range filter coming soon.</p>
                </div>
            </FilterDropdown>

            {/* Active Chips */}
            {activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-2 animate-in fade-in slide-in-from-top-1">
                    <span className="text-xs text-slate-500 font-medium mr-2">Active Filters:</span>
                    {activeFilters.map((filter, i) => (
                        <Badge key={`${filter.key}-${filter.slug}-${i}`} variant="secondary" className="px-2 py-1 gap-1 hover:bg-slate-200">
                            {filter.name}
                            <X
                                className="w-3 h-3 cursor-pointer hover:text-red-500"
                                onClick={() => removeFilter(filter.key, filter.slug)}
                            />
                        </Badge>
                    ))}
                    <button onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-900 underline ml-2">
                        Clear all
                    </button>
                </div>
            )}
        </div>
    )
}
