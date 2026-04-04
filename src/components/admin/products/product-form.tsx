"use client"

import { useState, useEffect, useMemo, useRef, type ComponentType, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ProductFormInput, ProductFormValues, productFormSchema } from "@/lib/validations/product"
import { createProduct, updateProduct } from "@/lib/actions/product-actions"
import type { Category } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { CategoryCreateModal } from "@/components/admin/categories/category-create-modal"
import { CategoryCheckboxTree } from "@/components/admin/categories/category-checkbox-tree"
import {
    Loader2,
    ChevronLeft,
    ChevronUp,
    ChevronDown,
    X,
    HelpCircle,
    Wrench,
    Package,
    Truck,
    Link2,
    SlidersHorizontal,
    Settings,
    Sparkles,
    Bold,
    Italic,
    List,
    ListOrdered,
    Quote,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Maximize2,
    Table,
    Strikethrough,
    Minus,
    Clipboard,
    Eraser,
    Undo2,
    Redo2,
    Pilcrow,
    PanelTop,
    SmilePlus,
    IndentDecrease,
    IndentIncrease,
    Palette,
} from "lucide-react"
import {
    Form,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { normalizeRichTextHtml } from "@/lib/rich-text"
import { cn } from "@/lib/utils"
import { MediaPickerDialog } from "@/components/admin/media/media-picker-dialog"
import type { AdminLanguage } from "@/lib/admin/i18n"
import { PLACEHOLDER_IMAGE_URL, getProductImageUrlCandidates, parseProductImageRecords, parseProductImages } from "@/lib/product-images"
import type { AttributeGroupRecord } from "@/lib/product-attributes"
import { matchSupplierBySkuPrefix, type SupplierRecord } from "@/lib/supplier-prefix"
import { formatCmSizeWithFeet, parseCmSizeInput, resolveClosestSizeOptionFromCmInput } from "@/lib/size-filter"

type SelectOption = { id: string, name?: string, title?: string }

type AdminPreviewImageEntry = {
    src: string
    candidates: string[]
}

function buildAdminPreviewEntry(image: string | null | undefined): AdminPreviewImageEntry | null {
    if (!image) return null
    const record = parseProductImageRecords(image)[0]
    if (!record) return null
    const candidates = Array.from(new Set([
        ...getProductImageUrlCandidates(record, "large"),
        ...getProductImageUrlCandidates(record, "master"),
        ...getProductImageUrlCandidates(record, "thumb"),
    ].filter((candidate) => candidate && candidate !== PLACEHOLDER_IMAGE_URL)))
    if (candidates.length === 0) return null
    return {
        src: candidates[0],
        candidates,
    }
}

function AdminPreviewImage({
    entry,
    alt,
    className,
    fallbackEntry,
}: {
    entry: AdminPreviewImageEntry
    alt: string
    className: string
    fallbackEntry?: AdminPreviewImageEntry | null
}) {
    const mergedCandidates = useMemo(() => {
        const ownCandidates = [entry.src, ...entry.candidates]
        const fallbackCandidates = fallbackEntry ? [fallbackEntry.src, ...fallbackEntry.candidates] : []
        return Array.from(new Set([...ownCandidates, ...fallbackCandidates].filter(Boolean)))
    }, [entry, fallbackEntry])
    const [candidateIndex, setCandidateIndex] = useState(0)

    const currentSrc = mergedCandidates[candidateIndex] || PLACEHOLDER_IMAGE_URL

    return (
        <img
            src={currentSrc}
            alt={alt}
            className={className}
            onError={() => {
                setCandidateIndex((prev) => (prev + 1 < mergedCandidates.length ? prev + 1 : prev))
            }}
        />
    )
}

function DropdownMultiSelect({
    label,
    options,
    value,
    onChange,
    placeholder,
    error,
    selectionMode = "multiple",
}: {
    label: string
    options: SelectOption[],
    value: string[],
    onChange: (val: string[]) => void,
    placeholder: string
    error?: string
    selectionMode?: "single" | "multiple"
}) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement | null>(null)
    const menuRef = useRef<HTMLDivElement | null>(null)
    const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number }>({
        top: 0,
        left: 0,
        width: 0,
    })

    const handleToggle = (id: string) => {
        if (selectionMode === "single") {
            onChange(value.includes(id) ? [] : [id])
            return
        }
        if (value.includes(id)) onChange(value.filter(v => v !== id))
        else onChange([...value, id])
    }

    useEffect(() => {
        const onOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node
            if (rootRef.current?.contains(target)) return
            if (menuRef.current?.contains(target)) return
            if (open) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", onOutsideClick)
        return () => document.removeEventListener("mousedown", onOutsideClick)
    }, [open])

    useEffect(() => {
        if (!open) return

        const updatePosition = () => {
            if (!rootRef.current) return
            const trigger = rootRef.current.querySelector('[data-role="dropdown-trigger"]') as HTMLElement | null
            const anchor = trigger ?? rootRef.current
            const rect = anchor.getBoundingClientRect()
            setMenuStyle({
                top: rect.bottom + 6,
                left: rect.left,
                width: rect.width,
            })
        }

        updatePosition()
        window.addEventListener("resize", updatePosition)
        window.addEventListener("scroll", updatePosition, true)
        return () => {
            window.removeEventListener("resize", updatePosition)
            window.removeEventListener("scroll", updatePosition, true)
        }
    }, [open])

    const selectedLabels = options
        .filter((opt) => value.includes(opt.id))
        .map((opt) => opt.name || opt.title)
        .filter(Boolean) as string[]

    return (
        <div ref={rootRef} className="relative z-[200] space-y-2">
            <Label className="text-xs font-medium text-slate-700">{label}</Label>
            <button
                type="button"
                data-role="dropdown-trigger"
                onClick={() => setOpen((prev) => !prev)}
                className="flex h-10 w-full items-center justify-between gap-2 rounded-sm border border-[#8c8f94] bg-white px-3 text-left text-sm text-slate-800 hover:border-[#2271b1]"
            >
                <span className="truncate">
                    {selectedLabels.length > 0 ? selectedLabels.join(", ") : placeholder}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", open && "rotate-180")} />
            </button>

            {open && typeof document !== "undefined" && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[250] max-h-56 space-y-1 overflow-y-auto rounded-sm border border-[#c3c4c7] bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.15)]"
                    style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
                >
                    {options.length === 0 ? (
                        <div className="px-2 py-2 text-xs text-slate-500">No global options defined yet</div>
                    ) : (
                        options.map((opt) => (
                            <label
                                key={opt.id}
                                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                            >
                                <Checkbox
                                    checked={value.includes(opt.id)}
                                    onCheckedChange={() => handleToggle(opt.id)}
                                />
                                <span>{opt.name || opt.title}</span>
                            </label>
                        ))
                    )}
                </div>,
                document.body
            )}

            {selectedLabels.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                    {selectedLabels.map((selectedLabel) => (
                        <Badge key={selectedLabel} variant="outline" className="rounded-sm border-[#c3c4c7] bg-[#f6f7f7] text-[10px] font-medium text-slate-700">
                            {selectedLabel}
                        </Badge>
                    ))}
                </div>
            ) : null}

            {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
    )
}

interface ProductFormProps {
    lang?: AdminLanguage
    initialData?: ProductFormInitialData
    options: {
        categories: Category[]
        attributeGroups: AttributeGroupRecord[]
    }
}

type ProductRelation = { id: string }
type CustomAttributeInput = { name: string; values: string[]; visible: boolean }

const EXACT_SIZE_ATTRIBUTE_NAMES = ["Dimensions (cm)", "Size (cm)", "Exact Size"]

function normalizeAttributeNameKey(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function findExactSizeAttribute(attributes: CustomAttributeInput[] | undefined) {
    const exactKeys = new Set(EXACT_SIZE_ATTRIBUTE_NAMES.map(normalizeAttributeNameKey))
    return (attributes || []).find((item) => exactKeys.has(normalizeAttributeNameKey(item.name)))
}

function upsertExactSizeAttribute(attributes: CustomAttributeInput[] | undefined, exactSizeValue: string) {
    const exactKeys = new Set(EXACT_SIZE_ATTRIBUTE_NAMES.map(normalizeAttributeNameKey))
    const nextAttributes = [...(attributes || [])]
    const existingIndex = nextAttributes.findIndex((item) => exactKeys.has(normalizeAttributeNameKey(item.name)))

    const exactAttribute: CustomAttributeInput = {
        name: "Dimensions (cm)",
        values: [exactSizeValue],
        visible: true,
    }

    if (existingIndex >= 0) {
        nextAttributes[existingIndex] = exactAttribute
        return nextAttributes
    }

    return [...nextAttributes, exactAttribute]
}

type ProductFormInitialData = {
    id: string
    title: string
    slug: string
    sku: string | null
    description: string | null
    shortDescription: string | null
    price: number
    compareAtPrice: number | null
    stockCount: number
    isStock: boolean
    isPublished: boolean
    isFeatured: boolean
    images: string
    seoTitle: string | null
    seoDescription: string | null
    seoKeywords: string | null
    updatedAt: Date
    categories: ProductRelation[]
    customAttributes?: CustomAttributeInput[]
    attributeSelections?: Record<string, string[]>
}

type ProductDataTab = "general" | "inventory" | "shipping" | "linked" | "attributes" | "advanced" | "more"
type MobileProductStepKey = "basic" | "media" | "details" | "pricing" | "review"
type ProductMediaPickerTarget = "featured" | "gallery"

const PRODUCT_DATA_TABS: Array<{
    key: ProductDataTab
    label: { en: string; tr: string }
    icon: ComponentType<{ className?: string }>
}> = [
    { key: "general", label: { en: "General", tr: "Genel" }, icon: Wrench },
    { key: "inventory", label: { en: "Inventory", tr: "Envanter" }, icon: Package },
    { key: "shipping", label: { en: "Shipping", tr: "Kargo" }, icon: Truck },
    { key: "linked", label: { en: "Linked Products", tr: "Bagli Ürünler" }, icon: Link2 },
    { key: "attributes", label: { en: "Attributes", tr: "Özellikler" }, icon: SlidersHorizontal },
    { key: "advanced", label: { en: "Advanced", tr: "Gelismis" }, icon: Settings },
    { key: "more", label: { en: "Get more options", tr: "Daha fazla seçenek" }, icon: Sparkles },
]

const MOBILE_PRODUCT_STEPS: Array<{ key: MobileProductStepKey; en: string; tr: string }> = [
    { key: "basic", en: "Basic Info", tr: "Temel Bilgi" },
    { key: "media", en: "Media", tr: "Medya" },
    { key: "details", en: "Details", tr: "Detaylar" },
    { key: "pricing", en: "Pricing", tr: "Fiyatlandırma" },
    { key: "review", en: "Review", tr: "Gözden Geçir" },
]

function parseImageList(value: unknown): string[] {
    return parseProductImages(value)
}

function toSlug(value: string): string {
    const turkishCharMap: Record<string, string> = {
        ç: "c",
        Ç: "c",
        ğ: "g",
        Ğ: "g",
        ı: "i",
        I: "i",
        İ: "i",
        ö: "o",
        Ö: "o",
        ş: "s",
        Ş: "s",
        ü: "u",
        Ü: "u",
    }

    const normalized = value
        .split("")
        .map((char) => turkishCharMap[char] ?? char)
        .join("")

    return normalized
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
}

function stripHtmlPreview(input: string): string {
    return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function buildHtmlTable(rows: number, cols: number): string {
    const safeRows = Math.max(1, Math.min(rows, 20))
    const safeCols = Math.max(1, Math.min(cols, 10))
    const header = Array.from({ length: safeCols })
        .map((_, i) => `      <th>Header ${i + 1}</th>`)
        .join("\n")
    const bodyRows = Array.from({ length: safeRows })
        .map((_, rowIndex) => {
            const cells = Array.from({ length: safeCols })
                .map((__, colIndex) => `      <td>R${rowIndex + 1}C${colIndex + 1}</td>`)
                .join("\n")
            return `    <tr>\n${cells}\n    </tr>`
        })
        .join("\n")

    return `<table>\n  <thead>\n    <tr>\n${header}\n    </tr>\n  </thead>\n  <tbody>\n${bodyRows}\n  </tbody>\n</table>`
}

const TEXT_SIZE_OPTIONS = [
    { label: "Text size", value: "" },
    { label: "Small", value: "14px" },
    { label: "Normal", value: "16px" },
    { label: "Large", value: "20px" },
    { label: "XL", value: "28px" },
] as const

function RichToolbarButton({
    label,
    icon,
    title,
    onClick,
    active = false,
}: {
    label: string
    icon?: ReactNode
    title?: string
    onClick: () => void
    active?: boolean
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title || label}
            aria-label={title || label}
            className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-sm border px-0 text-sm text-slate-700 hover:bg-white",
                active ? "border-[#8c8f94] bg-white" : "border-transparent"
            )}
        >
            {icon || label}
        </button>
    )
}

function RichTextEditor({
    value,
    mode,
    onModeChange,
    onChange,
    placeholder,
    minHeight = 260,
}: {
    value: string
    mode: "visual" | "code"
    onModeChange: (mode: "visual" | "code") => void
    onChange: (value: string) => void
    placeholder: string
    minHeight?: number
}) {
    const visualRef = useRef<HTMLDivElement | null>(null)
    const savedRangeRef = useRef<Range | null>(null)
    const [pasteAsText, setPasteAsText] = useState(false)
    const [toolbarExpanded, setToolbarExpanded] = useState(true)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [tableDialogOpen, setTableDialogOpen] = useState(false)
    const [tableRows, setTableRows] = useState(3)
    const [tableCols, setTableCols] = useState(3)

    const saveSelection = () => {
        if (mode !== "visual" || !visualRef.current) return
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return
        const range = selection.getRangeAt(0)
        if (!visualRef.current.contains(range.commonAncestorContainer)) return
        savedRangeRef.current = range.cloneRange()
    }

    const syncContent = () => {
        if (!visualRef.current) return
        onChange(visualRef.current.innerHTML || "")
    }

    useEffect(() => {
        if (mode !== "visual") return
        if (!visualRef.current) return
        if (visualRef.current.innerHTML !== value) {
            visualRef.current.innerHTML = value || ""
        }
    }, [value, mode])

    const runCommand = (command: string, commandValue?: string) => {
        if (mode !== "visual") return
        if (!visualRef.current) return
        visualRef.current.focus()
        document.execCommand(command, false, commandValue)
        syncContent()
    }

    const applyBlockFormat = (tag: string) => {
        if (mode !== "visual") return
        if (!visualRef.current) return

        const normalized = tag.toLowerCase()
        const selection = window.getSelection()
        visualRef.current.focus()

        // Browser differences: some accept `h1`, some `H1`, some `<h1>`.
        const values = [normalized, normalized.toUpperCase(), `<${normalized}>`]
        values.forEach((value) => {
            document.execCommand("formatBlock", false, value)
        })

        // Fallback for browsers where formatBlock silently fails.
        if (!selection || selection.rangeCount === 0) {
            syncContent()
            return
        }

        const range = selection.getRangeAt(0)
        let node: Node | null = range.commonAncestorContainer
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement
        }

        const block = node instanceof Element
            ? node.closest("p,h1,h2,h3,h4,h5,h6,pre,div,blockquote")
            : null

        if (block && visualRef.current.contains(block)) {
            const replacement = document.createElement(normalized)
            replacement.innerHTML = block.innerHTML
            block.replaceWith(replacement)
        }

        syncContent()
    }

    const insertHtml = (html: string) => {
        if (mode !== "visual") {
            const next = value.trim().length > 0 ? `${value}\n\n${html}` : html
            onChange(next)
            return
        }
        if (!visualRef.current) return
        const selection = window.getSelection()
        visualRef.current.focus()
        let range: Range | null = savedRangeRef.current ? savedRangeRef.current.cloneRange() : null

        if (!range && selection && selection.rangeCount > 0) {
            const currentRange = selection.getRangeAt(0)
            if (visualRef.current.contains(currentRange.commonAncestorContainer)) {
                range = currentRange.cloneRange()
            }
        }

        if (!range) {
            range = document.createRange()
            range.selectNodeContents(visualRef.current)
            range.collapse(false)
        }

        range.deleteContents()
        const fragment = range.createContextualFragment(html)
        const lastNode = fragment.lastChild
        range.insertNode(fragment)

        if (selection) {
            const nextRange = document.createRange()
            if (lastNode) {
                nextRange.setStartAfter(lastNode)
            } else {
                nextRange.selectNodeContents(visualRef.current)
                nextRange.collapse(false)
            }
            nextRange.collapse(true)
            selection.removeAllRanges()
            selection.addRange(nextRange)
            savedRangeRef.current = nextRange.cloneRange()
        }
        syncContent()
    }

    const handleInsertTable = () => {
        insertHtml(buildHtmlTable(tableRows, tableCols))
        setTableDialogOpen(false)
    }

    const applyTextSize = (fontSize: string) => {
        if (!fontSize || mode !== "visual" || !visualRef.current) return
        visualRef.current.focus()
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return
        const range = selection.getRangeAt(0)
        if (!visualRef.current.contains(range.commonAncestorContainer) || range.collapsed) return

        const fragment = range.extractContents()
        const wrapper = document.createElement("span")
        wrapper.style.fontSize = fontSize
        wrapper.appendChild(fragment)
        range.insertNode(wrapper)

        const nextRange = document.createRange()
        nextRange.selectNodeContents(wrapper)
        selection.removeAllRanges()
        selection.addRange(nextRange)
        savedRangeRef.current = nextRange.cloneRange()
        syncContent()
    }

    const toolbarWrapperClass = cn(
        "w-full max-w-full overflow-x-hidden border-b border-[#dcdcde] bg-[#f6f7f7] px-3 py-2",
        isFullscreen && "sticky top-0 z-20"
    )
    const editorWrapperClass = cn(
        "h-auto min-h-0 w-full max-w-full overflow-x-hidden border border-[#8c8f94] bg-white",
        isFullscreen && "fixed inset-6 z-50 overflow-auto bg-[#f6f7f7] p-4 shadow-2xl"
    )

    return (
        <div className={editorWrapperClass}>
            <div className={toolbarWrapperClass}>
                <div className="mb-2 flex items-center justify-end">
                    <div className="inline-flex overflow-hidden rounded-sm border border-[#c3c4c7]">
                        <button
                            type="button"
                            onClick={() => onModeChange("visual")}
                            className={cn(
                                "h-8 px-3 text-xs font-medium",
                                mode === "visual" ? "bg-white text-slate-900" : "bg-[#f6f7f7] text-slate-600"
                            )}
                        >
                            Visual
                        </button>
                        <button
                            type="button"
                            onClick={() => onModeChange("code")}
                            className={cn(
                                "h-8 border-l border-[#c3c4c7] px-3 text-xs font-medium",
                                mode === "code" ? "bg-white text-slate-900" : "bg-[#f6f7f7] text-slate-600"
                            )}
                        >
                            Code
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-1 pb-1 sm:flex-nowrap sm:overflow-x-auto sm:whitespace-nowrap">
                    <select
                        className="h-8 min-w-0 flex-1 rounded-sm border border-[#c3c4c7] bg-white px-2 text-sm text-slate-700 sm:min-w-[145px] sm:flex-none"
                        onChange={(event) => {
                            applyBlockFormat(event.target.value)
                        }}
                        defaultValue="p"
                    >
                        <option value="p">Paragraph</option>
                        <option value="h1">Heading 1</option>
                        <option value="h2">Heading 2</option>
                        <option value="h3">Heading 3</option>
                        <option value="h4">Heading 4</option>
                        <option value="h5">Heading 5</option>
                        <option value="h6">Heading 6</option>
                        <option value="pre">Preformatted</option>
                    </select>
                    <select
                        className="h-8 min-w-0 flex-1 rounded-sm border border-[#c3c4c7] bg-white px-2 text-sm text-slate-700 sm:min-w-[118px] sm:flex-none"
                        defaultValue=""
                        onChange={(event) => {
                            applyTextSize(event.target.value)
                            event.currentTarget.value = ""
                        }}
                    >
                        {TEXT_SIZE_OPTIONS.map((option) => (
                            <option key={option.label} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <RichToolbarButton label="Bold" icon={<Bold className="h-4 w-4" />} onClick={() => runCommand("bold")} />
                    <RichToolbarButton label="Italic" icon={<Italic className="h-4 w-4" />} onClick={() => runCommand("italic")} />
                    <RichToolbarButton label="Bulleted list" icon={<List className="h-4 w-4" />} onClick={() => runCommand("insertUnorderedList")} />
                    <RichToolbarButton label="Numbered list" icon={<ListOrdered className="h-4 w-4" />} onClick={() => runCommand("insertOrderedList")} />
                    <RichToolbarButton label="Blockquote" icon={<Quote className="h-4 w-4" />} onClick={() => runCommand("formatBlock", "<blockquote>")} />
                    <RichToolbarButton label="Align left" icon={<AlignLeft className="h-4 w-4" />} onClick={() => runCommand("justifyLeft")} />
                    <RichToolbarButton label="Align center" icon={<AlignCenter className="h-4 w-4" />} onClick={() => runCommand("justifyCenter")} />
                    <RichToolbarButton label="Align right" icon={<AlignRight className="h-4 w-4" />} onClick={() => runCommand("justifyRight")} />
                    <RichToolbarButton
                        label="Link"
                        icon={<Link2 className="h-4 w-4" />}
                        onClick={() => {
                            const href = window.prompt("Enter URL", "https://")
                            if (!href) return
                            runCommand("createLink", href)
                        }}
                    />
                    <RichToolbarButton label="Read More" icon={<Pilcrow className="h-4 w-4" />} onClick={() => insertHtml("<!--more-->")} />
                    <RichToolbarButton label="Fullscreen" icon={<Maximize2 className="h-4 w-4" />} onClick={() => setIsFullscreen((prev) => !prev)} active={isFullscreen} />
                    <RichToolbarButton label="Toolbar" icon={<PanelTop className="h-4 w-4" />} onClick={() => setToolbarExpanded((prev) => !prev)} active={toolbarExpanded} />
                    <RichToolbarButton
                        label="Table"
                        icon={<Table className="h-4 w-4" />}
                        onClick={() => {
                            saveSelection()
                            setTableDialogOpen(true)
                        }}
                    />
                </div>

                {toolbarExpanded ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1 pb-1 sm:flex-nowrap sm:overflow-x-auto sm:whitespace-nowrap">
                        <RichToolbarButton label="Strikethrough" icon={<Strikethrough className="h-4 w-4" />} onClick={() => runCommand("strikeThrough")} />
                        <RichToolbarButton label="Horizontal line" icon={<Minus className="h-4 w-4" />} onClick={() => runCommand("insertHorizontalRule")} />
                        <label className="inline-flex h-7 w-9 cursor-pointer items-center justify-center gap-1 rounded-sm border border-transparent px-0 text-sm text-slate-700 hover:bg-white">
                            <Palette className="h-4 w-4" />
                            <input
                                type="color"
                                className="h-4 w-4 border-0 bg-transparent p-0"
                                onChange={(event) => runCommand("foreColor", event.target.value)}
                            />
                        </label>
                        <RichToolbarButton label="Paste as text" icon={<Clipboard className="h-4 w-4" />} onClick={() => setPasteAsText((prev) => !prev)} active={pasteAsText} />
                        <RichToolbarButton label="Clear formatting" icon={<Eraser className="h-4 w-4" />} onClick={() => runCommand("removeFormat")} />
                        <RichToolbarButton
                            label="Special character"
                            icon={<SmilePlus className="h-4 w-4" />}
                            onClick={() => {
                                const special = window.prompt("Special character", "•")
                                if (!special) return
                                insertHtml(special)
                            }}
                        />
                        <RichToolbarButton label="Outdent" icon={<IndentDecrease className="h-4 w-4" />} onClick={() => runCommand("outdent")} />
                        <RichToolbarButton label="Indent" icon={<IndentIncrease className="h-4 w-4" />} onClick={() => runCommand("indent")} />
                        <RichToolbarButton label="Undo" icon={<Undo2 className="h-4 w-4" />} onClick={() => runCommand("undo")} />
                        <RichToolbarButton label="Redo" icon={<Redo2 className="h-4 w-4" />} onClick={() => runCommand("redo")} />
                    </div>
                ) : null}
            </div>

            {mode === "visual" ? (
                <div
                    ref={visualRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={syncContent}
                    onBlur={syncContent}
                    onKeyUp={saveSelection}
                    onMouseUp={saveSelection}
                    onPaste={(event) => {
                        if (!pasteAsText) return
                        event.preventDefault()
                        const text = event.clipboardData.getData("text/plain")
                        runCommand("insertText", text)
                    }}
                    className={cn(
                        "h-auto min-h-[180px] w-full max-w-full break-words px-3 py-2 text-sm leading-6 text-slate-900 focus:outline-none [overflow-wrap:anywhere]",
                        "[&_h1]:text-4xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:my-3",
                        "[&_h2]:text-3xl [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:my-3",
                        "[&_h3]:text-2xl [&_h3]:font-semibold [&_h3]:leading-snug [&_h3]:my-2.5",
                        "[&_h4]:text-xl [&_h4]:font-semibold [&_h4]:leading-snug [&_h4]:my-2",
                        "[&_h5]:text-lg [&_h5]:font-semibold [&_h5]:leading-snug [&_h5]:my-2",
                        "[&_h6]:text-base [&_h6]:font-semibold [&_h6]:leading-snug [&_h6]:my-2",
                        "[&_p]:my-2 [&_blockquote]:my-2",
                        "[&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse",
                        "[&_th]:border [&_th]:border-[#d1d5db] [&_th]:bg-[#f8fafc] [&_th]:p-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold",
                        "[&_td]:border [&_td]:border-[#d1d5db] [&_td]:p-2 [&_td]:text-xs [&_td]:align-top [&_td]:break-words",
                        "[&_th]:break-words [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-sm",
                        "[&_pre]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-xs [&_pre]:text-slate-100"
                    )}
                    style={{ minHeight: `${Math.max(minHeight, 180)}px` }}
                    data-placeholder={placeholder}
                />
            ) : (
                <textarea
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-auto min-h-[180px] w-full px-3 py-2 font-mono text-[13px] leading-5 text-slate-900 focus:outline-none"
                    style={{ minHeight: `${Math.max(minHeight, 180)}px` }}
                    placeholder={placeholder}
                />
            )}

            <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Insert Table</DialogTitle>
                        <DialogDescription>Select width and height, then OK.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                            <Label htmlFor="toolbar-table-cols" className="text-xs font-medium uppercase tracking-wide text-slate-600">
                                Width
                            </Label>
                            <Input
                                id="toolbar-table-cols"
                                type="number"
                                min={1}
                                max={10}
                                value={tableCols}
                                onChange={(event) => setTableCols(Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="toolbar-table-rows" className="text-xs font-medium uppercase tracking-wide text-slate-600">
                                Height
                            </Label>
                            <Input
                                id="toolbar-table-rows"
                                type="number"
                                min={1}
                                max={20}
                                value={tableRows}
                                onChange={(event) => setTableRows(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
                                className="h-9"
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-2">
                        <Button type="button" variant="outline" onClick={() => setTableDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleInsertTable}>
                            OK
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export function ProductForm({ lang = "en", initialData, options }: ProductFormProps) {
    const searchParams = useSearchParams()
    const isTr = lang === "tr"
    const tx = (en: string, tr: string) => (isTr ? tr : en)
    const router = useRouter()
    const returnToParam = searchParams.get("returnTo") || ""
    const resolvedReturnTo =
        returnToParam.startsWith("/dashboard/products")
            ? returnToParam
            : "/dashboard/products"
    const [isLoading, setIsLoading] = useState(false)
    const [categories, setCategories] = useState(options.categories || [])
    const initialImages = parseImageList(initialData?.images)
    const [featuredImage, setFeaturedImage] = useState<string | null>(initialImages[0] || null)
    const [galleryImagesState, setGalleryImagesState] = useState<string[]>(initialImages.slice(1))

    const [isSlugAutoSync, setIsSlugAutoSync] = useState(() => {
        if (!initialData) return true
        const initialTitleSlug = toSlug(initialData.title || "")
        const currentSlug = (initialData.slug || "").trim()
        return !currentSlug || currentSlug === initialTitleSlug
    })
    const [isSeoTitleAutoSync, setIsSeoTitleAutoSync] = useState(() => {
        if (!initialData) return true
        const currentSeoTitle = (initialData.seoTitle || "").trim()
        const currentTitle = (initialData.title || "").trim()
        return !currentSeoTitle || currentSeoTitle === currentTitle
    })
    const [activeProductDataTab, setActiveProductDataTab] = useState<ProductDataTab>("general")
    const [productType, setProductType] = useState("simple")
    const [isVirtual, setIsVirtual] = useState(false)
    const [isDownloadable, setIsDownloadable] = useState(false)

    const [shippingWeight, setShippingWeight] = useState("")
    const [shippingLength, setShippingLength] = useState("")
    const [shippingWidth, setShippingWidth] = useState("")
    const [shippingHeight, setShippingHeight] = useState("")
    const [groupedProducts, setGroupedProducts] = useState("")
    const [upsells, setUpsells] = useState("")
    const [crossSells, setCrossSells] = useState("")
    const [advancedNote, setAdvancedNote] = useState("")
    const [descriptionMode, setDescriptionMode] = useState<"visual" | "code">("visual")
    const [shortDescriptionMode, setShortDescriptionMode] = useState<"visual" | "code">("visual")
    const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
    const [mediaPickerTarget, setMediaPickerTarget] = useState<ProductMediaPickerTarget>("gallery")
    const [imagePreviewOpen, setImagePreviewOpen] = useState(false)
    const [imagePreviewIndex, setImagePreviewIndex] = useState(0)
    const [tagInput, setTagInput] = useState("")
    const [supplierRegistry, setSupplierRegistry] = useState<SupplierRecord[]>([])
    const [loadingSupplierRegistry, setLoadingSupplierRegistry] = useState(false)
    const [sizeInput, setSizeInput] = useState("")
    const [committedSizeInput, setCommittedSizeInput] = useState("")
    const [committedSizeMatchLabel, setCommittedSizeMatchLabel] = useState("")
    const [sizeHelpMessage, setSizeHelpMessage] = useState<string | null>(null)
    const [isMobileViewport, setIsMobileViewport] = useState(false)
    const [mobileStepIndex, setMobileStepIndex] = useState(0)
    const mobileDraftHydratedRef = useRef(false)

    const defaultValues: Partial<ProductFormValues> = initialData ? {
        title: initialData.title,
        slug: initialData.slug,
        sku: initialData.sku || "",
        description: initialData.description || "",
        price: Number(initialData.compareAtPrice && Number(initialData.compareAtPrice) > Number(initialData.price)
            ? initialData.compareAtPrice
            : initialData.price),
        compareAtPrice: Number(initialData.compareAtPrice && Number(initialData.compareAtPrice) > Number(initialData.price)
            ? initialData.price
            : 0),
        stockCount: initialData.stockCount,
        isStock: initialData.isStock,
        isPublished: initialData.isPublished,
        isFeatured: initialData.isFeatured,
        seoTitle: initialData.seoTitle || "",
        seoDescription: initialData.seoDescription || "",
        shortDescription: initialData.shortDescription || "",
        seoKeywords: initialData.seoKeywords || "",
        customAttributes: initialData.customAttributes || [],
        attributeSelections: initialData.attributeSelections || {},
        images: initialImages,
        categoryIds: initialData.categories.map((c) => c.id),
    } : {
        title: "",
        slug: "",
        sku: "",
        description: "",
        price: 0,
        compareAtPrice: 0,
        stockCount: 1,
        isStock: true,
        isPublished: false,
        isFeatured: false,
        seoTitle: "",
        seoDescription: "",
        shortDescription: "",
        seoKeywords: "",
        customAttributes: [],
        attributeSelections: {},
        images: [],
        categoryIds: [],
    }

    const form = useForm<ProductFormInput, unknown, ProductFormValues>({
        resolver: zodResolver(productFormSchema),
        defaultValues: defaultValues as ProductFormInput,
    })

    const { register, handleSubmit, setValue, watch, formState: { errors } } = form
    const title = watch("title")
    const slugValue = watch("slug") || ""
    const skuValue = watch("sku") || ""
    const seoTitleValue = watch("seoTitle") || ""
    const seoKeywordsValue = watch("seoKeywords") || ""

    const selectedCategoryIds = watch("categoryIds")
    const selectedAttributeSelections = watch("attributeSelections") || {}
    const selectedAttributeCount = Object.values(selectedAttributeSelections).reduce((total, ids) => total + (Array.isArray(ids) ? ids.length : 0), 0)
    const descriptionValue = watch("description") || ""
    const shortDescriptionValue = watch("shortDescription") || ""
    const tagItems = useMemo(
        () => seoKeywordsValue.split(",").map((item) => item.trim()).filter(Boolean),
        [seoKeywordsValue]
    )
    const categoryPathMap = useMemo(() => {
        const byId = new Map(categories.map((category) => [category.id, category]))
        const cache = new Map<string, string>()
        const resolvePath = (id: string): string => {
            if (cache.has(id)) return cache.get(id) || ""
            const current = byId.get(id)
            if (!current) return ""
            const parentPath = current.parentId ? resolvePath(current.parentId) : ""
            const slug = (current.slug || "").trim()
            const path = [parentPath, slug].filter(Boolean).join("/")
            cache.set(id, path)
            return path
        }
        categories.forEach((category) => resolvePath(category.id))
        return cache
    }, [categories])
    const primaryCategoryFolderPath = useMemo(() => {
        const firstCategoryId = selectedCategoryIds?.[0]
        if (!firstCategoryId) return ""
        return categoryPathMap.get(firstCategoryId) || ""
    }, [categoryPathMap, selectedCategoryIds])
    const resolvedSeoTitle = (seoTitleValue || title || tx("Product title preview", "Ürün başlığı önizleme")).trim()
    const previewDescriptionSource = stripHtmlPreview(descriptionValue || tx("Product description preview", "Ürün açıklaması önizleme"))
    const googlePreviewTitle = resolvedSeoTitle.slice(0, 60)
    const googlePreviewUrl = `https://turkishrughouse.com/product/${slugValue || "product-slug"}`
    const googlePreviewDescription = previewDescriptionSource.slice(0, 160)
    const googlePreviewTitleLength = resolvedSeoTitle.length
    const googlePreviewDescriptionLength = previewDescriptionSource.length
    const availableAttributeGroups = useMemo(
        () => options.attributeGroups.filter((group) => group.isActive),
        [options.attributeGroups]
    )
    const sizeAttributeGroup = useMemo(
        () => availableAttributeGroups.find((group) => group.slug === "size" || group.key === "size"),
        [availableAttributeGroups]
    )
    const matchedSupplier = useMemo(
        () => matchSupplierBySkuPrefix(skuValue, supplierRegistry),
        [skuValue, supplierRegistry]
    )
    const sizePreview = useMemo(() => formatCmSizeWithFeet(sizeInput), [sizeInput])
    const selectedSizeOption = useMemo(() => {
        if (!sizeAttributeGroup) return null
        const selectedIds = selectedAttributeSelections[sizeAttributeGroup.id] || []
        return sizeAttributeGroup.options.find((option) => selectedIds.includes(option.id)) || null
    }, [sizeAttributeGroup, selectedAttributeSelections])
    const mobileDraftStorageKey = useMemo(
        () => `admin-product-mobile-draft:${initialData?.id || "new"}`,
        [initialData?.id]
    )

    useEffect(() => {
        if (!initialData) return
        const exactSizeAttribute = findExactSizeAttribute(initialData.customAttributes)
        const exactSizeValue = exactSizeAttribute?.values?.[0]?.trim() || ""
        if (exactSizeValue) {
            setSizeInput(exactSizeValue)
            setCommittedSizeInput(exactSizeValue)
        }
        if (selectedSizeOption?.value) {
            setCommittedSizeMatchLabel(selectedSizeOption.value)
        }
    }, [initialData, selectedSizeOption])

    useEffect(() => {
        if (typeof window === "undefined") return
        const media = window.matchMedia("(max-width: 1023px)")
        const syncViewport = () => setIsMobileViewport(media.matches)
        syncViewport()
        media.addEventListener?.("change", syncViewport)
        return () => media.removeEventListener?.("change", syncViewport)
    }, [])

    useEffect(() => {
        if (typeof window === "undefined" || !isMobileViewport || mobileDraftHydratedRef.current) return
        mobileDraftHydratedRef.current = true

        try {
            const raw = window.localStorage.getItem(mobileDraftStorageKey)
            if (!raw) return
            const parsed = JSON.parse(raw) as {
                values?: Partial<ProductFormValues>
                featuredImage?: string | null
                galleryImages?: string[]
                mobileStepIndex?: number
            }

            if (parsed.values) {
                form.reset({
                    ...(defaultValues as ProductFormInput),
                    ...parsed.values,
                })
            }
            if (typeof parsed.featuredImage === "string" || parsed.featuredImage === null) {
                setFeaturedImage(parsed.featuredImage || null)
            }
            if (Array.isArray(parsed.galleryImages)) {
                setGalleryImagesState(parsed.galleryImages.filter((item): item is string => typeof item === "string"))
            }
            if (typeof parsed.mobileStepIndex === "number" && parsed.mobileStepIndex >= 0 && parsed.mobileStepIndex < MOBILE_PRODUCT_STEPS.length) {
                setMobileStepIndex(parsed.mobileStepIndex)
            }
        } catch {
            // Ignore invalid local mobile draft payloads.
        }
    }, [defaultValues, form, isMobileViewport, mobileDraftStorageKey])

    useEffect(() => {
        if (typeof window === "undefined" || !isMobileViewport) return
        const subscription = form.watch((values) => {
            window.localStorage.setItem(
                mobileDraftStorageKey,
                JSON.stringify({
                    values,
                    featuredImage,
                    galleryImages: galleryImagesState,
                    mobileStepIndex,
                }),
            )
        })
        return () => subscription.unsubscribe()
    }, [featuredImage, form, galleryImagesState, isMobileViewport, mobileDraftStorageKey, mobileStepIndex])

    const applySizeSelectionFromInput = (rawValue: string) => {
        if (!sizeAttributeGroup) return

        const compactValue = rawValue.replace(/\s+/g, "")

        if (!compactValue) {
            setCommittedSizeInput("")
            setCommittedSizeMatchLabel("")
            setSizeHelpMessage(null)
            setValue("attributeSelections", {
                ...selectedAttributeSelections,
                [sizeAttributeGroup.id]: [],
            }, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
            return
        }

        const parsed = parseCmSizeInput(compactValue)
        if (!parsed) {
            setCommittedSizeInput("")
            setCommittedSizeMatchLabel("")
            setSizeHelpMessage(null)
            setValue("attributeSelections", {
                ...selectedAttributeSelections,
                [sizeAttributeGroup.id]: [],
            }, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
            return
        }

        const matchedOption = resolveClosestSizeOptionFromCmInput(compactValue, sizeAttributeGroup.options, 6)

        if (!matchedOption || !matchedOption.id) {
            setCommittedSizeInput(parsed.normalized)
            setCommittedSizeMatchLabel("")
            setSizeHelpMessage(tx("No close Size option exists in Products > Attributes.", "Products > Attributes içinde yakın bir Boyut seçeneği bulunamadı."))
            setValue("attributeSelections", {
                ...selectedAttributeSelections,
                [sizeAttributeGroup.id]: [],
            }, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
            return
        }

        setCommittedSizeInput(parsed.normalized)
        setCommittedSizeMatchLabel(matchedOption.value || "")
        setSizeHelpMessage(tx(`Matched size: ${matchedOption.value}`, `Eşleşen boyut: ${matchedOption.value}`))
        setValue("attributeSelections", {
            ...selectedAttributeSelections,
            [sizeAttributeGroup.id]: [matchedOption.id],
        }, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
    }

    useEffect(() => {
        if (!isSlugAutoSync) return
        const nextSlug = toSlug(title || "")
        if ((form.getValues("slug") || "") === nextSlug) return
        setValue("slug", nextSlug, { shouldValidate: true })
    }, [title, isSlugAutoSync, form, setValue])

    useEffect(() => {
        if (!isSeoTitleAutoSync) return
        const nextSeoTitle = title || ""
        if ((form.getValues("seoTitle") || "") === nextSeoTitle) return
        setValue("seoTitle", nextSeoTitle, { shouldValidate: true, shouldDirty: true })
    }, [title, isSeoTitleAutoSync, form, setValue])

    useEffect(() => {
        if (!isMobileViewport) return
        if (mobileStepIndex === 2 && activeProductDataTab !== "attributes") {
            setActiveProductDataTab("attributes")
        }
        if (mobileStepIndex === 3 && !["general", "inventory"].includes(activeProductDataTab)) {
            setActiveProductDataTab("general")
        }
    }, [activeProductDataTab, isMobileViewport, mobileStepIndex])

    useEffect(() => {
        let cancelled = false

        const loadSupplierRegistry = async () => {
            setLoadingSupplierRegistry(true)
            try {
                const res = await fetch("/api/admin/suppliers", { cache: "no-store" })
                const json = await res.json().catch(() => ({ suppliers: [] as SupplierRecord[] }))
                if (!res.ok) return
                if (!cancelled) {
                    setSupplierRegistry(Array.isArray(json.suppliers) ? json.suppliers : [])
                }
            } catch {
                if (!cancelled) {
                    setSupplierRegistry([])
                }
            } finally {
                if (!cancelled) {
                    setLoadingSupplierRegistry(false)
                }
            }
        }

        void loadSupplierRegistry()

        return () => {
            cancelled = true
        }
    }, [])

    const handleCategoryCreated = (newCategory: Category) => {
        setCategories((prev) => [...prev, newCategory])
        const currentIds = form.getValues("categoryIds") || []
        form.setValue("categoryIds", [...currentIds, newCategory.id])
        toast.success(tx("Category added and selected", "Kategori eklendi ve seçildi"))
    }

    const syncImageState = (nextFeatured: string | null, nextGallery: string[]) => {
        setFeaturedImage(nextFeatured)
        setGalleryImagesState(nextGallery)
        const nextImages = [...(nextFeatured ? [nextFeatured] : []), ...nextGallery]
        setValue("images", nextImages, { shouldValidate: true })
    }

    const openProductMediaPicker = (target: ProductMediaPickerTarget) => {
        setMediaPickerTarget(target)
        setMediaPickerOpen(true)
    }

    const handleProductMediaSelect = (urls: string[]) => {
        if (urls.length === 0) return
        if (mediaPickerTarget === "featured") {
            const [nextFeatured, ...extraGallery] = urls
            const nextGallery = Array.from(new Set([...galleryImagesState, ...extraGallery]))
            syncImageState(nextFeatured || null, nextGallery)
            toast.success(
                urls.length > 1
                    ? (isTr ? `${urls.length} ürün görseli medyadan seçildi` : `${urls.length} product images selected from media`)
                    : tx("Product image selected from media", "Ürün görseli medyadan seçildi")
            )
            return
        }

        const nextGallery = Array.from(new Set([...galleryImagesState, ...urls]))
        syncImageState(featuredImage, nextGallery)
        toast.success(isTr ? `${urls.length} galeri görseli medyadan seçildi` : `${urls.length} gallery image(s) selected from media`)
    }

    const handleRemoveFeaturedImage = () => {
        syncImageState(null, galleryImagesState)
        toast.success(tx("Product image removed", "Ürün görseli kaldırıldı"))
    }

    const handleRemoveGalleryImage = (galleryIndex: number) => {
        const nextGallery = galleryImagesState.filter((_, idx) => idx !== galleryIndex)
        syncImageState(featuredImage, nextGallery)
    }

    const onSubmit = async (data: ProductFormValues) => {
        setIsLoading(true)
        data.images = [...(featuredImage ? [featuredImage] : []), ...galleryImagesState]
        data.customAttributes = (data.customAttributes || [])
            .map((item) => ({
                name: (item.name || "").trim(),
                values: (item.values || []).map((value) => value.trim()).filter(Boolean),
                visible: item.visible !== false,
            }))
            .filter((item) => item.name.length > 0 && item.values.length > 0)

        const exactSizeValue = committedSizeInput.trim()
        const parsedExactSize = parseCmSizeInput(exactSizeValue)
        if (parsedExactSize) {
            data.customAttributes = upsertExactSizeAttribute(data.customAttributes, parsedExactSize.normalized)
        }

        if (!data.slug && data.title) {
            data.slug = toSlug(data.title)
        }

        data.sku = (data.sku || "").trim()
        if (!data.sku) {
            toast.error(tx("SKU is required for product media folders", "Ürün media klasörü için SKU zorunlu"))
            setIsLoading(false)
            return
        }
        if (!data.images || data.images.length === 0) {
            toast.error(tx("At least one product image is required", "En az bir ürün görseli zorunlu"))
            setIsLoading(false)
            return
        }

        const regularPrice = Number(data.price || 0)
        const salePrice = Number(data.compareAtPrice || 0)

        if (salePrice > 0 && salePrice >= regularPrice) {
            toast.error(tx("Sale Price must be lower than Regular Price", "İndirimli fiyat normal fiyattan düşük olmalı"))
            setIsLoading(false)
            return
        }

        if (salePrice > 0 && salePrice < regularPrice) {
            data.price = salePrice
            data.compareAtPrice = regularPrice
        } else {
            data.price = regularPrice
            data.compareAtPrice = undefined
        }

        const missingRequiredAttributes = availableAttributeGroups.filter((group) => group.isRequired && (selectedAttributeSelections[group.id] || []).length === 0)
        if (missingRequiredAttributes.length > 0) {
            if (sizeAttributeGroup && missingRequiredAttributes.some((group) => group.id === sizeAttributeGroup.id)) {
                toast.error(
                    sizeHelpMessage ||
                    tx("Enter a Size in cm that matches an existing Size option before saving.", "Kaydetmeden önce mevcut bir Boyut seçeneğiyle eşleşen cm cinsinden bir Boyut girin.")
                )
                setIsLoading(false)
                return
            }
            toast.error(tx("Select all required product attributes before saving.", "Kaydetmeden önce tüm zorunlu ürün özelliklerini seçin"))
            setIsLoading(false)
            return
        }

        try {
            if (initialData) {
                const res = await updateProduct(initialData.id, data)
                if (res.success) {
                    if (typeof window !== "undefined") {
                        window.localStorage.removeItem(mobileDraftStorageKey)
                    }
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new Event("admin-products-updated"))
                    }
                    toast.success(tx("Product updated", "Ürün güncellendi"))
                    router.push(resolvedReturnTo)
                } else {
                    toast.error(res.error)
                }
            } else {
                const res = await createProduct(data)
                if (res.success) {
                    if (typeof window !== "undefined") {
                        window.localStorage.removeItem(mobileDraftStorageKey)
                    }
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new Event("admin-products-updated"))
                    }
                    toast.success(tx("Product created", "Ürün oluşturuldu"))
                    router.push("/dashboard/products")
                } else {
                    toast.error(res.error)
                }
            }
        } catch {
            toast.error(tx("Something went wrong", "Bir hata oluştu"))
        } finally {
            setIsLoading(false)
        }
    }

    const isPublished = watch("isPublished")
    const productStatus = isPublished ? tx("Published", "Yayında") : tx("Draft", "Taslak")
    const categoryCount = (watch("categoryIds") || []).length
    const stockManaged = watch("isStock")
    const primaryImage = featuredImage
    const galleryImages = galleryImagesState
    const previewImages = useMemo(
        () => [featuredImage, ...galleryImages]
            .map((image) => buildAdminPreviewEntry(image))
            .filter((image): image is AdminPreviewImageEntry => Boolean(image)),
        [featuredImage, galleryImages]
    )
    const primaryPreviewImage = useMemo(
        () => buildAdminPreviewEntry(primaryImage) || previewImages[0] || null,
        [primaryImage, previewImages]
    )

    const openImagePreview = (index: number) => {
        if (!previewImages[index]) return
        setImagePreviewIndex(index)
        setImagePreviewOpen(true)
    }

    const showPreviousPreviewImage = () => {
        if (previewImages.length <= 1) return
        setImagePreviewIndex((prev) => (prev === 0 ? previewImages.length - 1 : prev - 1))
    }

    const showNextPreviewImage = () => {
        if (previewImages.length <= 1) return
        setImagePreviewIndex((prev) => (prev === previewImages.length - 1 ? 0 : prev + 1))
    }

    const addTag = (rawValue: string) => {
        const nextTag = rawValue.trim()
        if (!nextTag) return
        const normalized = nextTag.replace(/\s+/g, " ")
        if (tagItems.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
            setTagInput("")
            return
        }
        const nextTags = [...tagItems, normalized]
        setValue("seoKeywords", nextTags.join(", "), { shouldValidate: true, shouldDirty: true, shouldTouch: true })
        setTagInput("")
    }

    const removeTag = (tagToRemove: string) => {
        const nextTags = tagItems.filter((item) => item !== tagToRemove)
        setValue("seoKeywords", nextTags.join(", "), { shouldValidate: true, shouldDirty: true, shouldTouch: true })
    }

    const showMobileStep = (steps: number | number[]) => {
        if (!isMobileViewport) return true
        const allowed = Array.isArray(steps) ? steps : [steps]
        return allowed.includes(mobileStepIndex)
    }

    return (
        <>
        <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className={cn("w-full min-w-0 max-w-full space-y-7 overflow-x-hidden pb-1 text-slate-900", isMobileViewport && "px-3 pb-28 pt-3 sm:px-4")}>
                {isMobileViewport ? (
                    <div className="rounded-2xl border border-[#dcdcde] bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                    {tx(`Step ${mobileStepIndex + 1} of ${MOBILE_PRODUCT_STEPS.length}`, `${mobileStepIndex + 1} / ${MOBILE_PRODUCT_STEPS.length}. adım`)}
                                </p>
                                <h1 className="mt-1 text-xl font-semibold">
                                    {isTr ? MOBILE_PRODUCT_STEPS[mobileStepIndex].tr : MOBILE_PRODUCT_STEPS[mobileStepIndex].en}
                                </h1>
                            </div>
                            <Badge variant={watch("isPublished") ? "success" : "secondary"} className="rounded-full border-[#c3c4c7] px-3 py-1">
                                {productStatus}
                            </Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-5 gap-2">
                            {MOBILE_PRODUCT_STEPS.map((step, index) => (
                                <div key={step.key} className={cn("h-2 rounded-full", index <= mobileStepIndex ? "bg-[#2271b1]" : "bg-slate-200")} />
                            ))}
                        </div>
                    </div>
                ) : null}
                {!isMobileViewport ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 rounded-sm border-[#c3c4c7] bg-white text-slate-700 hover:bg-[#f6f7f7]"
                                onClick={() => router.push(initialData ? resolvedReturnTo : "/dashboard/products")}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <h1 className="text-2xl font-semibold leading-none">
                                {initialData ? tx("Edit product", "Ürünü düzenle") : tx("Add new product", "Yeni ürün ekle")}
                            </h1>
                            <Badge variant={watch("isPublished") ? "success" : "secondary"} className="rounded-sm border-[#c3c4c7]">
                                {productStatus}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-sm border-[#c3c4c7] bg-[#f6f7f7] text-slate-700"
                                onClick={() => router.push(initialData ? resolvedReturnTo : "/dashboard/products")}
                            >
                                {tx("Cancel", "İptal")}
                            </Button>
                            <Button
                                type="submit"
                                className="rounded-sm bg-[#2271b1] px-5 text-white hover:bg-[#135e96]"
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {initialData ? tx("Update", "Güncelle") : tx("Publish", "Yayınla")}
                            </Button>
                        </div>
                    </div>
                ) : null}
                <div className={cn("grid min-w-0 max-w-full gap-7 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] xl:items-start", isMobileViewport && "xl:grid-cols-1")}>
                    <section className="min-w-0 max-w-full space-y-7">
                        <div className={cn("rounded-sm border border-[#c3c4c7] bg-white", !showMobileStep(0) && "hidden")}>
                            <div className="border-b border-[#dcdcde] px-4 py-3">
                                <h2 className="text-lg font-semibold">{tx("Product basic info", "Ürün temel bilgileri")}</h2>
                            </div>
                            <div className="space-y-3 border-b border-[#dcdcde] p-5">
                                <Input
                                    id="title"
                                    {...register("title")}
                                    placeholder={tx("Product name", "Ürün adı")}
                                    className="h-11 rounded-sm border-[#8c8f94] text-lg font-medium placeholder:text-slate-400"
                                />
                                {errors.title ? <p className="text-xs text-red-600">{errors.title.message}</p> : null}
                                <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 text-xs text-slate-600">
                                    <span>{tx("Permalink:", "Kalıcı bağlantı:")}</span>
                                    <span className="font-mono text-slate-500">/product/</span>
                                    <Input
                                        {...register("slug")}
                                        onChange={(event) => {
                                            const nextValue = event.target.value
                                            setValue("slug", nextValue, { shouldValidate: true })
                                            setIsSlugAutoSync(false)
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key !== "Enter") return
                                            event.preventDefault()
                                            const currentSlug = (form.getValues("slug") || "").trim()
                                            if (currentSlug.length > 0) return
                                            const generatedSlug = toSlug(form.getValues("title") || "")
                                            setValue("slug", generatedSlug, { shouldValidate: true })
                                            setIsSlugAutoSync(true)
                                        }}
                                        className="h-8 w-full min-w-0 rounded-sm border-[#8c8f94] font-mono text-xs sm:max-w-[320px]"
                                    />
                                </div>
                                {errors.slug ? <p className="text-xs text-red-600">{errors.slug.message}</p> : null}
                            </div>
                            <div className="border-b border-[#dcdcde] px-4 py-3">
                                <h3 className="text-base font-semibold">{tx("Product description", "Ürün açıklaması")}</h3>
                            </div>
                            <div className="border-b border-[#dcdcde] px-3 py-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-sm border-[#2271b1] bg-white px-3 text-sm text-[#2271b1] hover:bg-[#f0f6fc]"
                                    onClick={() => toast.info(tx("Media library integration is next.", "Medya kütüphanesi entegrasyonu sonraki adımda."))}
                                >
                                    {tx("Add Media", "Medya Ekle")}
                                </Button>
                            </div>
                            <RichTextEditor
                                mode={descriptionMode}
                                onModeChange={setDescriptionMode}
                                value={descriptionValue}
                                onChange={(nextValue) => setValue("description", normalizeRichTextHtml(nextValue), { shouldValidate: true, shouldDirty: true, shouldTouch: true })}
                                placeholder={tx("Long description shown under product gallery on the storefront.", "Ön tarafta ürün galerisi altında gösterilecek uzun açıklama.")}
                                minHeight={320}
                            />
                        </div>

                        <div className={cn("rounded-sm border border-[#c3c4c7] bg-white", !showMobileStep([2, 3]) && "hidden")}>
                            <div className="flex flex-wrap items-center gap-4 border-b border-[#dcdcde] bg-[#f6f7f7] px-4 py-3">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <h2 className="text-lg font-semibold leading-none">{tx("Product data", "Ürün verileri")}</h2>
                                    <span className="text-lg text-slate-400">-</span>
                                    <select
                                        value={productType}
                                        onChange={(event) => setProductType(event.target.value)}
                                        className="h-10 w-full min-w-0 rounded-sm border border-[#8c8f94] bg-white px-3 text-sm font-medium sm:min-w-[250px] sm:w-auto"
                                    >
                                        <option value="simple">{tx("Simple product", "Basit ürün")}</option>
                                        <option value="variable">{tx("Variable product", "Varyasyonlu ürün")}</option>
                                        <option value="grouped">{tx("Grouped product", "Gruplanmış ürün")}</option>
                                    </select>
                                    <HelpCircle className="h-4 w-4 text-slate-400" />
                                </div>
                                <div className="flex flex-wrap items-center gap-6 xl:ml-auto">
                                    <label className="inline-flex items-center gap-2 text-sm font-semibold">
                                        <Checkbox
                                            checked={isVirtual}
                                            onCheckedChange={(checked) => setIsVirtual(checked === true)}
                                            className="h-5 w-5 rounded border-[#8c8f94]"
                                        />
                                        {tx("Virtual", "Sanal")}
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-sm font-semibold">
                                        <Checkbox
                                            checked={isDownloadable}
                                            onCheckedChange={(checked) => setIsDownloadable(checked === true)}
                                            className="h-5 w-5 rounded border-[#8c8f94]"
                                        />
                                        {tx("Downloadable", "İndirilebilir")}
                                    </label>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-[230px_minmax(0,1fr)]">
                                <div className="border-r border-[#dcdcde] bg-[#f6f7f7]">
                                    {PRODUCT_DATA_TABS.map((tab) => {
                                        const Icon = tab.icon
                                        const isActive = activeProductDataTab === tab.key

                                        return (
                                            <button
                                                key={tab.key}
                                                type="button"
                                                onClick={() => setActiveProductDataTab(tab.key)}
                                                className={cn(
                                                    "flex w-full items-center gap-2.5 border-b border-[#dcdcde] px-4 py-3 text-left text-sm font-medium",
                                                    isActive
                                                        ? "bg-white text-[#2271b1]"
                                                        : "text-slate-700 hover:bg-white"
                                                )}
                                            >
                                                <Icon className="h-4 w-4" />
                                                <span>{isTr ? tab.label.tr : tab.label.en}</span>
                                            </button>
                                        )
                                    })}
                                </div>

                                <div className="min-h-[420px] min-w-0 max-w-full overflow-x-hidden p-4 sm:p-6">
                                    {activeProductDataTab === "general" ? (
                                        <div className="w-full max-w-[700px] min-w-0 space-y-4">
                                            <div className="grid items-center gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                                                <Label className="text-sm font-medium text-slate-700">{tx("Regular price (₺)", "Normal fiyat (₺)")}</Label>
                                                <div>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        {...register("price")}
                                                        className="h-10 rounded-sm border-[#8c8f94] text-sm"
                                                    />
                                                    {errors.price ? <p className="mt-1 text-xs text-red-600">{errors.price.message}</p> : null}
                                                </div>
                                            </div>
                                            <div className="grid items-center gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                                                <Label className="text-sm font-medium text-slate-700">{tx("Sale price (₺)", "İndirimli fiyat (₺)")}</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    {...register("compareAtPrice")}
                                                    className="h-10 rounded-sm border-[#8c8f94] text-sm"
                                                />
                                            </div>
                                            <button type="button" className="pl-[220px] text-sm font-medium text-[#2271b1] hover:underline">
                                                {tx("Schedule", "Planla")}
                                            </button>
                                        </div>
                                    ) : null}

                                    {activeProductDataTab === "inventory" ? (
                                        <div className="w-full max-w-[760px] min-w-0 space-y-3">
                                            <div className="grid items-start gap-x-3 gap-y-2 md:grid-cols-[220px_minmax(0,1fr)]">
                                                <Label className="text-sm font-medium text-slate-700">SKU</Label>
                                                <div className="space-y-1.5">
                                                    <Input
                                                        {...register("sku")}
                                                        className="h-11 rounded-sm border-[#8c8f94]"
                                                        placeholder="TRH-SKU-001"
                                                    />
                                                    <div className="rounded-sm border border-[#dcdcde] bg-[#f6f7f7] px-3 py-2 text-xs text-slate-600">
                                                        {loadingSupplierRegistry
                                                            ? tx("Checking supplier prefix...", "Supplier prefix kontrol ediliyor...")
                                                            : matchedSupplier
                                                                ? tx(
                                                                    `Supplier will be assigned automatically: ${matchedSupplier.company || matchedSupplier.name || matchedSupplier.number} (${matchedSupplier.number})`,
                                                                    `Supplier otomatik atanacak: ${matchedSupplier.company || matchedSupplier.name || matchedSupplier.number} (${matchedSupplier.number})`
                                                                )
                                                                : skuValue.trim().length > 0
                                                                    ? tx("No supplier prefix match found. Supplier will stay empty.", "Bu SKU icin supplier prefix eslesmesi bulunmadi. Supplier bos kalacak.")
                                                                    : tx("Supplier is matched automatically from Settings > Supplier by SKU prefix.", "Supplier, Settings > Supplier altindaki prefix kaydina gore otomatik eslesir.")}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid items-start gap-x-3 gap-y-2 md:grid-cols-[220px_minmax(0,1fr)]">
                                                <Label className="text-sm font-medium text-slate-700">{tx("Manage stock?", "Stok yönetilsin mi?")}</Label>
                                                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                                    <Checkbox
                                                        checked={stockManaged}
                                                        onCheckedChange={(checked) => setValue("isStock", checked === true, { shouldValidate: true })}
                                                    />
                                                    {tx("Track quantity for this product", "Bu ürün için stok adedi takip et")}
                                                </label>
                                            </div>

                                            <div className="grid items-start gap-x-3 gap-y-2 md:grid-cols-[220px_minmax(0,1fr)]">
                                                <Label className="text-sm font-medium text-slate-700">{tx("Stock quantity", "Stok adedi")}</Label>
                                                <div>
                                                    <Input type="number" {...register("stockCount")} className="h-11 rounded-sm border-[#8c8f94]" />
                                                    {errors.stockCount ? <p className="mt-1 text-xs text-red-600">{errors.stockCount.message}</p> : null}
                                                </div>
                                            </div>

                                            <div className="grid items-start gap-x-3 gap-y-2 md:grid-cols-[220px_minmax(0,1fr)]">
                                                <Label className="text-sm font-medium text-slate-700">{tx("Stock status", "Stok durumu")}</Label>
                                                <select
                                                    value={stockManaged ? "instock" : "outofstock"}
                                                    onChange={(event) => setValue("isStock", event.target.value === "instock", { shouldValidate: true })}
                                                    className="h-11 rounded-sm border border-[#8c8f94] bg-white px-3 text-sm"
                                                >
                                                    <option value="instock">{tx("In stock", "Stokta")}</option>
                                                    <option value="outofstock">{tx("Out of stock", "Stokta yok")}</option>
                                                </select>
                                            </div>
                                        </div>
                                    ) : null}

                                    {activeProductDataTab === "shipping" ? (
                                        <div className="w-full max-w-[760px] min-w-0 space-y-4">
                                            <div className="grid items-center gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                                                <Label className="text-sm font-medium text-slate-700">{tx("Weight (kg)", "Ağırlık (kg)")}</Label>
                                                <Input
                                                    value={shippingWeight}
                                                    onChange={(event) => setShippingWeight(event.target.value)}
                                                    className="h-11 rounded-sm border-[#8c8f94]"
                                                    placeholder="0.0"
                                                />
                                            </div>
                                            <div className="grid items-start gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                                                <Label className="pt-3 text-sm font-medium text-slate-700">{tx("Dimensions (cm)", "Ölçüler (cm)")}</Label>
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                    <Input
                                                        value={shippingLength}
                                                        onChange={(event) => setShippingLength(event.target.value)}
                                                        className="h-11 rounded-sm border-[#8c8f94]"
                                                        placeholder={tx("Length", "Uzunluk")}
                                                    />
                                                    <Input
                                                        value={shippingWidth}
                                                        onChange={(event) => setShippingWidth(event.target.value)}
                                                        className="h-11 rounded-sm border-[#8c8f94]"
                                                        placeholder={tx("Width", "Genişlik")}
                                                    />
                                                    <Input
                                                        value={shippingHeight}
                                                        onChange={(event) => setShippingHeight(event.target.value)}
                                                        className="h-11 rounded-sm border-[#8c8f94]"
                                                        placeholder={tx("Height", "Yükseklik")}
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-sm text-slate-500">{tx("Shipping values are design-ready placeholders and will be connected to backend rules next.", "Kargo alanları şimdilik tasarım amaçlıdır, sonraki adımda backend kurallarına bağlanacaktır.")}</p>
                                        </div>
                                    ) : null}

                                    {activeProductDataTab === "linked" ? (
                                        <div className="w-full max-w-[760px] min-w-0 space-y-4">
                                            <div className="grid items-center gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                                                <Label className="text-sm font-medium text-slate-700">{tx("Grouped products", "Gruplanmış ürünler")}</Label>
                                                <Input
                                                    value={groupedProducts}
                                                    onChange={(event) => setGroupedProducts(event.target.value)}
                                                    className="h-11 rounded-sm border-[#8c8f94]"
                                                    placeholder={tx("Search for a product...", "Ürün ara...")}
                                                />
                                            </div>
                                            <div className="grid items-center gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                                                <Label className="text-sm font-medium text-slate-700">{tx("Upsells", "Üst satış")}</Label>
                                                <Input
                                                    value={upsells}
                                                    onChange={(event) => setUpsells(event.target.value)}
                                                    className="h-11 rounded-sm border-[#8c8f94]"
                                                    placeholder={tx("Search for a product...", "Ürün ara...")}
                                                />
                                            </div>
                                            <div className="grid items-center gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                                                <Label className="text-sm font-medium text-slate-700">{tx("Cross-sells", "Çapraz satış")}</Label>
                                                <Input
                                                    value={crossSells}
                                                    onChange={(event) => setCrossSells(event.target.value)}
                                                    className="h-11 rounded-sm border-[#8c8f94]"
                                                    placeholder={tx("Search for a product...", "Ürün ara...")}
                                                />
                                            </div>
                                        </div>
                                    ) : null}

                                    {activeProductDataTab === "attributes" ? (
                                        <div className="space-y-5">
                                            <div className="rounded-sm border border-[#dcdcde] bg-white">
                                                <div className="border-b border-[#dcdcde] px-4 py-3">
                                                    <h3 className="text-base font-semibold text-slate-900">{tx("Storefront filters", "Storefront filtreleri")}</h3>
                                                    <p className="mt-1 text-sm text-slate-500">
                                                        {tx("These values feed storefront category filtering without changing the current product form layout.", "Bu değerler mevcut ürün form düzenini değiştirmeden storefront kategori filtrelerini besler.")}
                                                    </p>
                                                </div>
                                                <div className="grid min-w-0 max-w-full gap-4 p-4 md:grid-cols-2">
                                                    {availableAttributeGroups.length === 0 ? (
                                                        <div className="rounded-sm border border-dashed border-[#c3c4c7] bg-[#f6f7f7] px-4 py-3 text-sm text-slate-500 md:col-span-2">
                                                            {tx("No active attribute groups found. Create them first in Products > Attributes.", "Aktif özellik grubu bulunamadı. Önce Products > Attributes altında oluşturun.")}
                                                        </div>
                                                    ) : (
                                                        availableAttributeGroups.map((group) => {
                                                            const selectedIds = selectedAttributeSelections[group.id] || []
                                                            const isSizeGroup = group.id === sizeAttributeGroup?.id
                                                            return (
                                                                <div key={group.id} className="space-y-3 rounded-sm border border-[#dcdcde] bg-[#fbfcfd] p-3">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <Label className="text-sm font-semibold text-slate-800">{group.name}</Label>
                                                                        <Badge variant="outline" className="rounded-sm border-[#c3c4c7] bg-white text-[10px] uppercase tracking-wide text-slate-600">
                                                                            {group.selectionMode === "single" ? tx("Single", "Tek seçim") : tx("Multiple", "Çoklu seçim")}
                                                                        </Badge>
                                                                        {group.isRequired ? (
                                                                            <Badge variant="outline" className="rounded-sm border-amber-200 bg-amber-50 text-[10px] uppercase tracking-wide text-amber-700">
                                                                                {tx("Required", "Zorunlu")}
                                                                            </Badge>
                                                                        ) : null}
                                                                        {group.isFilterable ? (
                                                                            <Badge variant="outline" className="rounded-sm border-emerald-200 bg-emerald-50 text-[10px] uppercase tracking-wide text-emerald-700">
                                                                                {tx("Filterable", "Filtrelenir")}
                                                                            </Badge>
                                                                        ) : null}
                                                                        {group.isVisibleOnProduct ? (
                                                                            <Badge variant="outline" className="rounded-sm border-sky-200 bg-sky-50 text-[10px] uppercase tracking-wide text-sky-700">
                                                                                {tx("Visible", "Görünür")}
                                                                            </Badge>
                                                                        ) : null}
                                                                    </div>
                                                                    {isSizeGroup ? (
                                                                        <div className="space-y-2">
                                                                            <Label htmlFor="product-form-size-filter" className="text-xs font-medium text-slate-700">
                                                                                {tx("Size", "Boyut")}
                                                                            </Label>
                                                                            <Input
                                                                                id="product-form-size-filter"
                                                                                type="text"
                                                                                inputMode="numeric"
                                                                                value={sizeInput}
                                                                                onChange={(event) => {
                                                                                    const nextValue = event.target.value.replace(/\s+/g, "")
                                                                                    setSizeInput(nextValue)
                                                                                    if (!nextValue) {
                                                                                        setCommittedSizeInput("")
                                                                                        setCommittedSizeMatchLabel("")
                                                                                        setSizeHelpMessage(null)
                                                                                    }
                                                                                }}
                                                                                onKeyDown={(event) => {
                                                                                    if (event.key !== "Enter") return
                                                                                    event.preventDefault()
                                                                                    applySizeSelectionFromInput(event.currentTarget.value)
                                                                                }}
                                                                                onBlur={() => {
                                                                                    if (!sizeInput) return
                                                                                    applySizeSelectionFromInput(sizeInput)
                                                                                }}
                                                                                className="h-10 rounded-sm border-[#8c8f94]"
                                                                                placeholder="Enter size (e.g. 120x180 cm)"
                                                                            />
                                                                            {committedSizeInput ? (
                                                                                <div className="mt-2 flex flex-wrap gap-2">
                                                                                    <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                                                                                        {committedSizeInput} cm
                                                                                    </span>
                                                                                </div>
                                                                            ) : null}
                                                                            {sizePreview ? (
                                                                                <p className="text-xs text-slate-600">{sizePreview}</p>
                                                                            ) : null}
                                                                            {sizeHelpMessage ? (
                                                                                <p className="text-xs text-slate-500">{sizeHelpMessage}</p>
                                                                            ) : committedSizeMatchLabel ? (
                                                                                <p className="text-xs text-slate-500">
                                                                                    {tx(`Matched size: ${committedSizeMatchLabel}`, `Eşleşen boyut: ${committedSizeMatchLabel}`)}
                                                                                </p>
                                                                            ) : selectedSizeOption && !sizeInput ? (
                                                                                <p className="text-xs text-slate-500">
                                                                                    {tx(`Current size option: ${selectedSizeOption.value}`, `Mevcut boyut seçeneği: ${selectedSizeOption.value}`)}
                                                                                </p>
                                                                            ) : null}
                                                                            {typeof errors.attributeSelections?.message === "string" ? (
                                                                                <p className="text-xs text-red-600">{errors.attributeSelections.message}</p>
                                                                            ) : null}
                                                                        </div>
                                                                    ) : (
                                                                        <DropdownMultiSelect
                                                                            label={group.name}
                                                                            options={group.options.map((option) => ({
                                                                                id: option.id,
                                                                                name: option.value,
                                                                            }))}
                                                                            value={selectedIds}
                                                                            onChange={(val) => setValue("attributeSelections", {
                                                                                ...selectedAttributeSelections,
                                                                                [group.id]: val,
                                                                            }, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                                                                            placeholder={tx("Select values", "Değer seç")}
                                                                            error={errors.attributeSelections?.message as string | undefined}
                                                                            selectionMode={group.selectionMode}
                                                                        />
                                                                    )}
                                                                </div>
                                                            )
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                            <div className="rounded-sm border border-[#dcdcde] bg-[#f6f7f7] p-4 text-sm text-slate-600">
                                                {tx("Attribute groups, values, visibility, and storefront filtering are managed centrally in Products > Attributes. This form only selects which values belong to the current product.", "Özellik grupları, değerler, görünürlük ve storefront filtreleri Products > Attributes altında merkezi olarak yönetilir. Bu form yalnızca mevcut ürüne ait değerleri seçer.")}
                                            </div>
                                        </div>
                                    ) : null}

                                    {activeProductDataTab === "advanced" ? (
                                        <div className="w-full max-w-[760px] min-w-0 space-y-4">
                                            <div className="grid items-start gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                                                <Label className="pt-3 text-sm font-medium text-slate-700">{tx("Admin note", "Yönetici notu")}</Label>
                                                <textarea
                                                    value={advancedNote}
                                                    onChange={(event) => setAdvancedNote(event.target.value)}
                                                    className="min-h-[110px] w-full rounded-sm border border-[#8c8f94] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2271b1]"
                                                    placeholder={tx("Internal note for this product setup", "Bu ürün kurulumu için dahili not")}
                                                />
                                            </div>
                                            <p className="text-sm text-slate-500">{tx("Advanced fields are visually ready. We can attach more backend options next.", "Gelişmiş alanlar hazır. Sonraki adımda daha fazla backend seçeneği bağlanabilir.")}</p>
                                        </div>
                                    ) : null}

                                    {activeProductDataTab === "more" ? (
                                        <div className="rounded-sm border border-dashed border-[#c3c4c7] bg-[#f6f7f7] p-4 text-sm text-slate-600">
                                            {tx("Additional product modules can be plugged in here (bundles, subscriptions, custom fields, and rule engines).", "Ek ürün modülleri buraya bağlanabilir (paketler, abonelikler, özel alanlar ve kural motorları).")}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <div className={cn("rounded-sm border border-[#c3c4c7] bg-white", !showMobileStep(4) && "hidden")}>
                            <div className="border-b border-[#dcdcde] px-4 py-3">
                                <h2 className="text-lg font-semibold">{tx("Google search preview", "Google arama önizlemesi")}</h2>
                                <p className="mt-1 text-xs text-slate-500">{tx("This is how the product can appear in Google results.", "Ürün Google sonuçlarında bu şekilde görünebilir.")}</p>
                            </div>
                            <div className="p-4">
                                <div className="rounded-md border border-[#dcdcde] bg-white p-4">
                                    <p className="truncate text-[20px] leading-6 text-[#1a0dab]">{googlePreviewTitle}</p>
                                    <p className="mt-1 truncate text-sm text-[#006621]">{googlePreviewUrl}</p>
                                    <p className="mt-1 text-sm leading-5 text-[#4d5156]">{googlePreviewDescription}</p>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <p className="rounded-sm border border-[#dcdcde] bg-[#f6f7f7] px-3 py-2 text-xs text-slate-600">
                                        {tx("Title length", "Başlık uzunluğu")}: <span className="font-semibold text-slate-900">{googlePreviewTitleLength}</span> / 50–60
                                    </p>
                                    <p className="rounded-sm border border-[#dcdcde] bg-[#f6f7f7] px-3 py-2 text-xs text-slate-600">
                                        {tx("Description length", "Açıklama uzunluğu")}: <span className="font-semibold text-slate-900">{googlePreviewDescriptionLength}</span> / 150–160
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className={cn("rounded-sm border border-[#c3c4c7] bg-white", !showMobileStep(0) && "hidden")}>
                            <div className="border-b border-[#dcdcde] px-4 py-3">
                                <h2 className="text-lg font-semibold">{tx("Product short description", "Ürün kısa açıklaması")}</h2>
                                <p className="mt-1 text-xs text-slate-500">{tx("This section maps to the frontend text block on the right side of the product image.", "Bu alan ön tarafta ürün görselinin sağındaki metin bloğuna karşılık gelir.")}</p>
                            </div>
                            <div className="border-b border-[#dcdcde] px-3 py-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-sm border-[#2271b1] bg-white px-3 text-sm text-[#2271b1] hover:bg-[#f0f6fc]"
                                    onClick={() => toast.info(tx("Media library integration is next.", "Medya kütüphanesi entegrasyonu sonraki adımda."))}
                                >
                                    {tx("Add Media", "Medya Ekle")}
                                </Button>
                            </div>
                            <RichTextEditor
                                mode={shortDescriptionMode}
                                onModeChange={setShortDescriptionMode}
                                value={shortDescriptionValue}
                                onChange={(nextValue) => setValue("shortDescription", nextValue, { shouldValidate: true, shouldDirty: true, shouldTouch: true })}
                                placeholder={tx("Short description shown near product title and price.", "Ürün başlığı ve fiyata yakın gösterilecek kısa açıklama.")}
                                minHeight={170}
                            />
                        </div>
                    </section>

                    <aside className="min-w-0 max-w-full space-y-7 xl:col-start-2">
                        <div className={cn("rounded-sm border border-[#c3c4c7] bg-white", !showMobileStep(4) && "hidden")}>
                            <div className="border-b border-[#dcdcde] px-4 py-3">
                                <h3 className="text-xl font-semibold leading-none">{tx("Publish", "Yayın")}</h3>
                            </div>
                            <div className="space-y-4 p-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">{tx("Status:", "Durum:")}</span>
                                    <span className="font-semibold text-slate-900">{productStatus}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">{tx("Visibility:", "Görünürlük:")}</span>
                                    <span className="font-semibold text-slate-900">{tx("Public", "Herkese Açık")}</span>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-slate-700">{tx("Publish status", "Yayın durumu")}</Label>
                                    <select
                                        value={isPublished ? "publish" : "draft"}
                                        onChange={(event) => setValue("isPublished", event.target.value === "publish", { shouldValidate: true })}
                                        className="h-10 w-full rounded-sm border border-[#8c8f94] bg-white px-3 text-sm"
                                    >
                                        <option value="publish">{tx("Publish", "Yayınla")}</option>
                                        <option value="draft">{tx("Draft", "Taslak")}</option>
                                    </select>
                                </div>
                                <label className="flex items-center justify-between rounded-sm border border-[#dcdcde] bg-[#f6f7f7] px-3 py-2">
                                    <span className="text-sm text-slate-700">{tx("Featured site", "Öne çıkan site")}</span>
                                    <Checkbox
                                        checked={watch("isFeatured")}
                                        onCheckedChange={(checked) => setValue("isFeatured", checked === true, { shouldValidate: true })}
                                    />
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        className="rounded-sm border-[#2271b1] bg-white text-[#2271b1] hover:bg-[#f0f6fc]"
                                        onClick={() => setValue("isPublished", false, { shouldValidate: true })}
                                        disabled={isLoading}
                                    >
                                        {isPublished ? tx("Save as Draft", "Taslak olarak kaydet") : tx("Save Draft", "Taslak kaydet")}
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="rounded-sm bg-[#2271b1] text-white hover:bg-[#135e96]"
                                        onClick={() => setValue("isPublished", true, { shouldValidate: true })}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        {isPublished ? (initialData ? tx("Update", "Güncelle") : tx("Publish", "Yayınla")) : tx("Publish now", "Şimdi yayınla")}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className={cn("rounded-sm border border-[#c3c4c7] bg-white", !showMobileStep(1) && "hidden")}>
                            <div className="flex items-center justify-between border-b border-[#dcdcde] px-4 py-3">
                                <h3 className="text-lg font-semibold">{tx("Product image", "Ürün görseli")} ({primaryImage ? 1 : 0})</h3>
                                <div className="flex items-center gap-2 text-slate-500">
                                    <ChevronUp className="h-5 w-5" />
                                    <ChevronDown className="h-5 w-5" />
                                    <ChevronUp className="h-4 w-4 rotate-180" />
                                </div>
                            </div>
                            <div className="px-4 py-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => openProductMediaPicker("featured")}
                                                className="text-base font-medium text-[#2271b1] underline underline-offset-2 hover:text-[#135e96]"
                                            >
                                                {tx("Set product image", "Ürün görseli seç")}
                                            </button>
                                            <HelpCircle className="h-5 w-5 text-slate-500" />
                                        </div>
                                        {primaryImage ? (
                                            <p className="mt-2 text-xs text-slate-500">{tx("1 product image selected", "1 ürün görseli seçildi")}</p>
                                        ) : <p className="mt-2 text-xs text-slate-500">{tx("Select from media library", "Medya kütüphanesinden seç")}</p>}
                                    </div>
                                    <div className="w-[88px] shrink-0">
                                        <div className="relative rounded-sm border border-[#dcdcde] bg-[#f6f7f7] p-1">
                                            {primaryPreviewImage ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => openImagePreview(0)}
                                                        className="block w-full overflow-hidden rounded-sm"
                                                    >
                                                        <AdminPreviewImage
                                                            key={primaryPreviewImage.src}
                                                            entry={primaryPreviewImage}
                                                            fallbackEntry={previewImages[0] || null}
                                                            alt={tx("Product image thumb", "Ürün görsel önizleme")}
                                                            className="h-20 w-full rounded-sm object-cover"
                                                        />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            handleRemoveFeaturedImage()
                                                        }}
                                                        className="absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                                                        aria-label={tx("Remove product image", "Ürün görselini kaldır")}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="flex h-20 w-full items-center justify-center text-[11px] text-slate-500">{tx("No image", "Görsel yok")}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={cn("rounded-sm border border-[#c3c4c7] bg-white", !showMobileStep(1) && "hidden")}>
                            <div className="flex items-center justify-between border-b border-[#dcdcde] px-4 py-3">
                                <h3 className="text-lg font-semibold">{tx("Product gallery", "Ürün galerisi")} ({galleryImages.length})</h3>
                                <div className="flex items-center gap-2 text-slate-500">
                                    <ChevronUp className="h-5 w-5" />
                                    <ChevronDown className="h-5 w-5" />
                                    <ChevronUp className="h-4 w-4 rotate-180" />
                                </div>
                            </div>
                            <div className="px-4 py-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => openProductMediaPicker("gallery")}
                                                className="text-base font-medium text-[#2271b1] underline underline-offset-2 hover:text-[#135e96]"
                                            >
                                                {tx("Add product gallery images", "Ürün galeri görselleri ekle")}
                                            </button>
                                            <HelpCircle className="h-5 w-5 text-slate-500" />
                                        </div>
                                        <p className="mt-2 text-xs text-slate-500">
                                            {isTr ? `${galleryImages.length} galeri görseli seçildi` : `${galleryImages.length} gallery image(s) selected`}
                                        </p>
                                    </div>
                                    <div className="w-[88px] shrink-0">
                                        <div className="grid max-h-[188px] grid-cols-2 gap-1 overflow-y-auto rounded-sm border border-[#dcdcde] bg-[#f6f7f7] p-1">
                                            {galleryImages.length > 0 ? (
                                                galleryImages.map((image, index) => (
                                                    <div key={`${image}-${index}`} className="relative">
                                                        <button type="button" onClick={() => openImagePreview(index + 1)} className="block w-full">
                                                            <img
                                                                src={image}
                                                                alt={tx("Gallery thumb", "Galeri önizleme")}
                                                                className="h-9 w-full rounded-sm object-cover"
                                                            />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                handleRemoveGalleryImage(index)
                                                            }}
                                                            className="absolute right-0 top-0 inline-flex h-3.5 w-3.5 -translate-y-1/3 translate-x-1/3 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                                                            aria-label={tx("Remove gallery image", "Galeri görselini kaldır")}
                                                        >
                                                            <X className="h-2.5 w-2.5" />
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="col-span-2 flex h-16 items-center justify-center text-[11px] text-slate-500">
                                                    {tx("No gallery", "Galeri yok")}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={cn("rounded-sm border border-[#c3c4c7] bg-white", !showMobileStep(2) && "hidden")}>
                            <div className="border-b border-[#dcdcde] px-4 py-3">
                                <h3 className="text-lg font-semibold">{tx("Product categories", "Ürün kategorileri")}</h3>
                            </div>
                            <div className="p-4">
                                <FormField
                                    control={form.control}
                                    name="categoryIds"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="mb-3 flex items-center justify-between">
                                                <span className="text-sm font-medium text-slate-700">{tx("All categories", "Tüm kategoriler")}</span>
                                                <CategoryCreateModal
                                                    existingCategories={categories}
                                                    onCategoryCreated={handleCategoryCreated}
                                                />
                                            </div>
                                            <CategoryCheckboxTree
                                                categories={categories}
                                                selectedIds={field.value || []}
                                                onChange={field.onChange}
                                            />
                                            <div className="mt-4 space-y-2 rounded-sm border border-[#dcdcde] bg-[#f6f7f7] p-3">
                                                <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">{tx("Tags", "Etiketler")}</Label>
                                                <Input
                                                    value={tagInput}
                                                    onChange={(event) => setTagInput(event.target.value)}
                                                    onKeyDown={(event) => {
                                                        if (event.key !== "Enter") return
                                                        event.preventDefault()
                                                        addTag(tagInput)
                                                    }}
                                                    className="h-10 rounded-sm border-[#8c8f94] bg-white"
                                                    placeholder={tx("Type a tag and press Enter", "Etiket yazıp Enter'a basın")}
                                                />
                                                {tagItems.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {tagItems.map((tag) => (
                                                            <button
                                                                key={tag}
                                                                type="button"
                                                                onClick={() => removeTag(tag)}
                                                                className="inline-flex items-center gap-1 rounded-full border border-[#c3c4c7] bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                                                            >
                                                                <span>{tag}</span>
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-500">{tx("Tags will appear here.", "Etiketler burada görünür.")}</p>
                                                )}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <div className={cn("rounded-sm border border-[#c3c4c7] bg-white", !showMobileStep(4) && "hidden")}>
                            <div className="border-b border-[#dcdcde] px-4 py-3">
                                <h3 className="text-lg font-semibold">{tx("Search appearance", "Arama görünümü")}</h3>
                            </div>
                            <div className="space-y-4 p-4">
                                <div className="space-y-1">
                                    <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">{tx("Meta title", "Meta başlık")}</Label>
                                    <Input
                                        value={seoTitleValue}
                                        onChange={(event) => {
                                            const nextValue = event.target.value
                                            setValue("seoTitle", nextValue, { shouldValidate: true, shouldDirty: true, shouldTouch: true })
                                            setIsSeoTitleAutoSync(nextValue.trim().length === 0 || nextValue.trim() === (title || "").trim())
                                        }}
                                        className="h-10 rounded-sm border-[#8c8f94]"
                                        placeholder={tx("SEO title for search engines", "Arama motorları için SEO başlığı")}
                                    />
                                    <p className="text-xs text-slate-500">
                                        {tx("If left empty, search preview uses the product title instantly.", "Boş bırakılırsa arama önizlemesi ürün başlığını anında kullanır.")}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">{tx("Keywords / notes", "Anahtar kelimeler / notlar")}</Label>
                                    <textarea
                                        {...register("seoKeywords")}
                                        className="min-h-[100px] w-full rounded-sm border border-[#8c8f94] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2271b1]"
                                        placeholder={tx("Comma separated keywords", "Virgülle ayrılmış anahtar kelimeler")}
                                    />
                                </div>
                                <p className="rounded-sm border border-[#dcdcde] bg-[#f6f7f7] px-3 py-2 text-xs text-slate-500">
                                    {tx("Meta description preview uses the main product description, not the short description.", "Meta açıklama önizlemesi kısa açıklamayı değil ana ürün açıklamasını kullanır.")}
                                </p>
                            </div>
                        </div>

                        <div className={cn("rounded-sm border border-[#c3c4c7] bg-white", !showMobileStep(4) && "hidden")}>
                            <div className="border-b border-[#dcdcde] px-4 py-3">
                                <h3 className="text-lg font-semibold">{tx("Product summary", "Ürün özeti")}</h3>
                            </div>
                            <div className="space-y-3 p-4 text-sm">
                                <div className="flex items-center justify-between rounded-sm border border-[#dcdcde] bg-[#f6f7f7] px-3 py-2">
                                    <span className="text-slate-600">{tx("Categories", "Kategoriler")}</span>
                                    <span className="font-semibold text-slate-900">{categoryCount}</span>
                                </div>
                                <div className="flex items-center justify-between rounded-sm border border-[#dcdcde] bg-[#f6f7f7] px-3 py-2">
                                    <span className="text-slate-600">{tx("Attributes selected", "Seçilen özellikler")}</span>
                                    <span className="font-semibold text-slate-900">{selectedAttributeCount}</span>
                                </div>
                                <div className="flex items-center justify-between rounded-sm border border-[#dcdcde] bg-[#f6f7f7] px-3 py-2">
                                    <span className="text-slate-600">{tx("In stock", "Stokta")}</span>
                                    <span className="font-semibold text-slate-900">{Number(watch("stockCount") ?? 0)}</span>
                                </div>
                                {initialData ? (
                                    <div className="text-xs text-slate-500">
                                        {tx("Last updated:", "Son güncelleme:")} {new Date(initialData.updatedAt).toLocaleString()}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {initialData ? (
                            <div className={cn("rounded-sm border border-red-200 bg-red-50", !showMobileStep(4) && "hidden")}>
                                <div className="border-b border-red-200 px-4 py-3">
                                    <h3 className="text-sm font-semibold text-red-700">{tx("Danger zone", "Tehlikeli alan")}</h3>
                                </div>
                                <div className="p-4">
                                    <Button type="button" variant="destructive" className="w-full rounded-sm" disabled>
                                        {tx("Delete Product (will be connected later)", "Ürünü Sil (sonradan bağlanacak)")}
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </aside>
                </div>
                {isMobileViewport ? (
                    <div className="sticky bottom-0 z-20 -mx-3 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:-mx-4 sm:px-4">
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                className="h-12 flex-1 rounded-2xl"
                                onClick={() => setMobileStepIndex((prev) => Math.max(prev - 1, 0))}
                                disabled={mobileStepIndex === 0}
                            >
                                {tx("Back", "Geri")}
                            </Button>
                            {mobileStepIndex < MOBILE_PRODUCT_STEPS.length - 1 ? (
                                <Button
                                    type="button"
                                    className="h-12 flex-[1.4] rounded-2xl bg-[#2271b1] text-white hover:bg-[#135e96]"
                                    onClick={() => setMobileStepIndex((prev) => Math.min(prev + 1, MOBILE_PRODUCT_STEPS.length - 1))}
                                >
                                    {tx("Continue", "Devam Et")}
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    className="h-12 flex-[1.4] rounded-2xl bg-[#2271b1] text-white hover:bg-[#135e96]"
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {initialData ? tx("Update product", "Ürünü güncelle") : tx("Publish product", "Ürünü yayınla")}
                                </Button>
                            )}
                        </div>
                    </div>
                ) : null}
            </form>
        </Form>
        {mediaPickerOpen ? (
            <MediaPickerDialog
                open={mediaPickerOpen}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        setMediaPickerOpen(false)
                        return
                    }
                    setMediaPickerOpen(true)
                }}
                multiple={mediaPickerTarget === "gallery"}
                onSelect={handleProductMediaSelect}
                title={mediaPickerTarget === "featured" ? tx("Select product image", "Ürün görseli seç") : tx("Select gallery images", "Galeri görselleri seç")}
                productMeta={{
                    title: title || "",
                    sku: watch("sku") || "",
                    description: stripHtmlPreview(descriptionValue || ""),
                    categoryFolderPath: primaryCategoryFolderPath,
                }}
            />
        ) : null}
        <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
            <DialogContent className="!left-1/2 !top-1/2 !translate-x-[-50%] !translate-y-[-50%] w-[90vw] max-w-5xl border-none bg-black/95 p-0 text-white">
                <div className="relative flex min-h-[70vh] items-center justify-center px-16 py-10">
                    {previewImages[imagePreviewIndex] ? (
                        <AdminPreviewImage
                            key={previewImages[imagePreviewIndex].src}
                            entry={previewImages[imagePreviewIndex]}
                            fallbackEntry={previewImages.find((_, index) => index !== imagePreviewIndex) || null}
                            alt={tx("Product preview image", "Ürün önizleme görseli")}
                            className="max-h-[70vh] w-auto max-w-full rounded-md object-contain"
                        />
                    ) : null}

                    {previewImages.length > 1 ? (
                        <>
                            <button
                                type="button"
                                onClick={showPreviousPreviewImage}
                                className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
                                aria-label={tx("Previous image", "Önceki görsel")}
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </button>
                            <button
                                type="button"
                                onClick={showNextPreviewImage}
                                className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
                                aria-label={tx("Next image", "Sonraki görsel")}
                            >
                                <ChevronLeft className="h-6 w-6 rotate-180" />
                            </button>
                        </>
                    ) : null}

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm text-white">
                        {previewImages.length === 0 ? 0 : imagePreviewIndex + 1} / {previewImages.length}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
        </>
    )
}
