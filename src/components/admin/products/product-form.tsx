"use client"

import { useState, useEffect, useMemo, useRef, type ComponentType, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
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
    Building2,
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
import { cn } from "@/lib/utils"
import { MediaPickerDialog } from "@/components/admin/media/media-picker-dialog"
import type { AdminLanguage } from "@/lib/admin/i18n"
import { parseProductImages } from "@/lib/product-images"

type SelectOption = { id: string, name?: string, title?: string }

function DropdownMultiSelect({
    label,
    options,
    value,
    onChange,
    placeholder,
    error
}: {
    label: string
    options: SelectOption[],
    value: string[],
    onChange: (val: string[]) => void,
    placeholder: string
    error?: string
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

type CategoryAttributeMap = Record<string, {
    typeIds: string[]
    styleIds: string[]
    colorIds: string[]
    sizeIds: string[]
    ageIds: string[]
    materialIds: string[]
}>

interface ProductFormProps {
    lang?: AdminLanguage
    initialData?: ProductFormInitialData
    options: {
        categories: Category[]
        types: SelectOption[]
        styles: SelectOption[]
        colors: SelectOption[]
        sizes: SelectOption[]
        ages: SelectOption[]
        materials: SelectOption[]
        categoryAttributeMap?: CategoryAttributeMap
    }
}

type ProductRelation = { id: string }
type CustomAttributeInput = { name: string; values: string[]; visible: boolean }
type SupplierInput = { name: string; number: string; company: string; phone: string; note: string }
const EMPTY_CUSTOM_ATTRIBUTES: CustomAttributeInput[] = []
const EMPTY_SUPPLIERS: SupplierInput[] = []

type ProductFormInitialData = {
    id: string
    title: string
    slug: string
    sku: string | null
    description: string | null
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
    types: ProductRelation[]
    styles: ProductRelation[]
    colors: ProductRelation[]
    sizes: ProductRelation[]
    ages: ProductRelation[]
    materials: ProductRelation[]
    customAttributes?: CustomAttributeInput[]
    suppliers?: SupplierInput[]
}

type ProductDataTab = "general" | "inventory" | "shipping" | "linked" | "supplier" | "attributes" | "advanced" | "more"
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
    { key: "supplier", label: { en: "Suppliers", tr: "Tedarikciler" }, icon: Building2 },
    { key: "attributes", label: { en: "Attributes", tr: "Özellikler" }, icon: SlidersHorizontal },
    { key: "advanced", label: { en: "Advanced", tr: "Gelismis" }, icon: Settings },
    { key: "more", label: { en: "Get more options", tr: "Daha fazla seçenek" }, icon: Sparkles },
]

function filterOptionsByCategory(
    allOptions: SelectOption[],
    selectedCategoryIds: string[],
    map: CategoryAttributeMap | undefined,
    attributeKey: keyof CategoryAttributeMap[string]
) {
    void selectedCategoryIds
    void map
    void attributeKey
    return allOptions
}

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

    const toolbarWrapperClass = cn(
        "border-b border-[#dcdcde] bg-[#f6f7f7] px-3 py-2",
        isFullscreen && "sticky top-0 z-20"
    )
    const editorWrapperClass = cn(
        "border border-[#8c8f94] bg-white",
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

                <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pb-1">
                    <select
                        className="h-8 min-w-[145px] rounded-sm border border-[#c3c4c7] bg-white px-2 text-sm text-slate-700"
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
                    <div className="mt-2 flex items-center gap-1 overflow-x-auto whitespace-nowrap pb-1">
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
                        "w-full px-3 py-2 text-sm leading-6 text-slate-900 focus:outline-none",
                        "[&_h1]:text-4xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:my-3",
                        "[&_h2]:text-3xl [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:my-3",
                        "[&_h3]:text-2xl [&_h3]:font-semibold [&_h3]:leading-snug [&_h3]:my-2.5",
                        "[&_h4]:text-xl [&_h4]:font-semibold [&_h4]:leading-snug [&_h4]:my-2",
                        "[&_h5]:text-lg [&_h5]:font-semibold [&_h5]:leading-snug [&_h5]:my-2",
                        "[&_h6]:text-base [&_h6]:font-semibold [&_h6]:leading-snug [&_h6]:my-2",
                        "[&_p]:my-2 [&_pre]:my-2 [&_blockquote]:my-2",
                        "[&_table]:w-full [&_table]:border-collapse",
                        "[&_th]:border [&_th]:border-[#d1d5db] [&_th]:bg-[#f8fafc] [&_th]:p-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold",
                        "[&_td]:border [&_td]:border-[#d1d5db] [&_td]:p-2 [&_td]:text-xs"
                    )}
                    style={{ minHeight: `${Math.max(minHeight, 180)}px` }}
                    data-placeholder={placeholder}
                />
            ) : (
                <textarea
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="w-full px-3 py-2 font-mono text-[13px] leading-5 text-slate-900 focus:outline-none"
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
    const isTr = lang === "tr"
    const tx = (en: string, tr: string) => (isTr ? tr : en)
    const router = useRouter()
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
    const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
    const [supplierDraft, setSupplierDraft] = useState<SupplierInput>({ name: "", number: "", company: "", phone: "", note: "" })

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
        seoKeywords: initialData.seoKeywords || "",
        customAttributes: initialData.customAttributes || [],
        suppliers: initialData.suppliers || [],
        images: initialImages,
        categoryIds: initialData.categories.map((c) => c.id),
        typeIds: initialData.types.map((t) => t.id),
        styleIds: initialData.styles.map((s) => s.id),
        colorIds: initialData.colors.map((c) => c.id),
        sizeIds: initialData.sizes.map((s) => s.id),
        ageIds: initialData.ages.map((a) => a.id),
        materialIds: initialData.materials.map((m) => m.id),
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
        seoKeywords: "",
        customAttributes: [],
        suppliers: [],
        images: [],
        categoryIds: [],
        typeIds: [],
        styleIds: [],
        colorIds: [],
        sizeIds: [],
        ageIds: [],
        materialIds: [],
    }

    const form = useForm<ProductFormInput, unknown, ProductFormValues>({
        resolver: zodResolver(productFormSchema),
        defaultValues: defaultValues as ProductFormInput,
    })

    const { register, handleSubmit, setValue, watch, formState: { errors } } = form
    const title = watch("title")
    const slugValue = watch("slug") || ""
    const seoTitleValue = watch("seoTitle") || ""
    const seoKeywordsValue = watch("seoKeywords") || ""

    const customAttributeItems = watch("customAttributes") ?? EMPTY_CUSTOM_ATTRIBUTES
    const supplierItems = watch("suppliers") ?? EMPTY_SUPPLIERS
    const selectedCategoryIds = watch("categoryIds")
    const selectedTypeIds = watch("typeIds") || []
    const selectedStyleIds = watch("styleIds") || []
    const selectedColorIds = watch("colorIds") || []
    const selectedSizeIds = watch("sizeIds") || []
    const selectedAgeIds = watch("ageIds") || []
    const selectedMaterialIds = watch("materialIds") || []
    const selectedAttributeCount =
        customAttributeItems.length +
        selectedTypeIds.length +
        selectedStyleIds.length +
        selectedColorIds.length +
        selectedSizeIds.length +
        selectedAgeIds.length +
        selectedMaterialIds.length
    const descriptionValue = watch("description") || ""
    const shortDescriptionValue = watch("seoDescription") || ""
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
    const availableTypeOptions = useMemo(
        () => filterOptionsByCategory(options.types, selectedCategoryIds || [], options.categoryAttributeMap, "typeIds"),
        [options.types, options.categoryAttributeMap, selectedCategoryIds]
    )
    const availableStyleOptions = useMemo(
        () => filterOptionsByCategory(options.styles, selectedCategoryIds || [], options.categoryAttributeMap, "styleIds"),
        [options.styles, options.categoryAttributeMap, selectedCategoryIds]
    )
    const availableColorOptions = useMemo(
        () => filterOptionsByCategory(options.colors, selectedCategoryIds || [], options.categoryAttributeMap, "colorIds"),
        [options.colors, options.categoryAttributeMap, selectedCategoryIds]
    )
    const availableSizeOptions = useMemo(
        () => filterOptionsByCategory(options.sizes, selectedCategoryIds || [], options.categoryAttributeMap, "sizeIds"),
        [options.sizes, options.categoryAttributeMap, selectedCategoryIds]
    )
    const availableAgeOptions = useMemo(
        () => filterOptionsByCategory(options.ages, selectedCategoryIds || [], options.categoryAttributeMap, "ageIds"),
        [options.ages, options.categoryAttributeMap, selectedCategoryIds]
    )
    const availableMaterialOptions = useMemo(
        () => filterOptionsByCategory(options.materials, selectedCategoryIds || [], options.categoryAttributeMap, "materialIds"),
        [options.materials, options.categoryAttributeMap, selectedCategoryIds]
    )

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

    const handleCategoryCreated = (newCategory: Category) => {
        setCategories((prev) => [...prev, newCategory])
        const currentIds = form.getValues("categoryIds") || []
        form.setValue("categoryIds", [...currentIds, newCategory.id])
        toast.success(tx("Category added and selected", "Kategori eklendi ve seçildi"))
    }

    const addCustomAttribute = () => {
        const current = form.getValues("customAttributes") || []
        setValue("customAttributes", [...current, { name: "", values: [], visible: true }], { shouldDirty: true, shouldTouch: true, shouldValidate: true })
    }

    const updateCustomAttribute = (index: number, patch: Partial<CustomAttributeInput>) => {
        const current = form.getValues("customAttributes") || []
        const next = current.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
        setValue("customAttributes", next, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
    }

    const removeCustomAttribute = (index: number) => {
        const current = form.getValues("customAttributes") || []
        const next = current.filter((_, idx) => idx !== index)
        setValue("customAttributes", next, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
    }

    const addSupplier = () => {
        const name = (supplierDraft.name || "").trim()
        const number = (supplierDraft.number || "").trim().toUpperCase()
        const company = (supplierDraft.company || "").trim()
        const phone = (supplierDraft.phone || "").trim()
        const note = (supplierDraft.note || "").trim()
        if (!name && !company && !number) {
            toast.error(tx("Supplier name, company, or number is required", "Tedarikçi adı, şirket veya number zorunlu"))
            return
        }
        const current = form.getValues("suppliers") || []
        setValue("suppliers", [
            ...current,
            {
                name,
                number,
                company,
                phone,
                note,
            },
        ], { shouldDirty: true, shouldTouch: true, shouldValidate: true })
        setSupplierDraft({ name: "", number: "", company: "", phone: "", note: "" })
        setSupplierDialogOpen(false)
        toast.success(tx("Supplier added", "Tedarikçi eklendi"))
    }

    const removeSupplier = (index: number) => {
        const current = form.getValues("suppliers") || []
        const next = current.filter((_, idx) => idx !== index)
        setValue("suppliers", next, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
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
        data.suppliers = (data.suppliers || [])
            .map((item) => ({
                name: (item.name || "").trim(),
                number: (item.number || "").trim().toUpperCase(),
                company: (item.company || "").trim(),
                phone: (item.phone || "").trim(),
                note: (item.note || "").trim(),
            }))
            .filter((item) => item.name.length > 0 || item.company.length > 0 || item.number.length > 0)

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

        try {
            if (initialData) {
                const res = await updateProduct(initialData.id, data)
                if (res.success) {
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new Event("admin-products-updated"))
                    }
                    toast.success(tx("Product updated", "Ürün güncellendi"))
                    router.push("/dashboard/products")
                } else {
                    toast.error(res.error)
                }
            } else {
                const res = await createProduct(data)
                if (res.success) {
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
    const previewImages = [featuredImage, ...galleryImages].filter((image): image is string => Boolean(image))

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

    return (
        <>
        <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-7 pb-1 text-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-sm border-[#c3c4c7] bg-white text-slate-700 hover:bg-[#f6f7f7]"
                            onClick={() => router.back()}
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
                            onClick={() => router.push("/dashboard/products")}
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

                <div className="grid gap-7 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] xl:items-start">
                    <section className="space-y-7">
                        <div className="rounded-sm border border-[#c3c4c7] bg-white">
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
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
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
                                        className="h-8 max-w-[320px] rounded-sm border-[#8c8f94] font-mono text-xs"
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
                                onChange={(nextValue) => setValue("description", nextValue, { shouldValidate: true, shouldDirty: true, shouldTouch: true })}
                                placeholder={tx("Long description shown under product gallery on the storefront.", "Ön tarafta ürün galerisi altında gösterilecek uzun açıklama.")}
                                minHeight={320}
                            />
                        </div>

                        <div className="rounded-sm border border-[#c3c4c7] bg-white">
                            <div className="flex flex-wrap items-center gap-4 border-b border-[#dcdcde] bg-[#f6f7f7] px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-semibold leading-none">{tx("Product data", "Ürün verileri")}</h2>
                                    <span className="text-lg text-slate-400">-</span>
                                    <select
                                        value={productType}
                                        onChange={(event) => setProductType(event.target.value)}
                                        className="h-10 min-w-[250px] rounded-sm border border-[#8c8f94] bg-white px-3 text-sm font-medium"
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

                                <div className="min-h-[420px] p-6">
                                    {activeProductDataTab === "general" ? (
                                        <div className="max-w-[700px] space-y-4">
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
                                        <div className="max-w-[760px] space-y-4">
                                            <div className="grid items-center gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                                                <Label className="text-sm font-medium text-slate-700">SKU</Label>
                                                <Input
                                                    {...register("sku")}
                                                    className="h-11 rounded-sm border-[#8c8f94]"
                                                    placeholder="TRH-SKU-001"
                                                />
                                            </div>

                                            <div className="grid items-center gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                                                <Label className="text-sm font-medium text-slate-700">{tx("Manage stock?", "Stok yönetilsin mi?")}</Label>
                                                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                                    <Checkbox
                                                        checked={stockManaged}
                                                        onCheckedChange={(checked) => setValue("isStock", checked === true, { shouldValidate: true })}
                                                    />
                                                    {tx("Track quantity for this product", "Bu ürün için stok adedi takip et")}
                                                </label>
                                            </div>

                                            <div className="grid items-center gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                                                <Label className="text-sm font-medium text-slate-700">{tx("Stock quantity", "Stok adedi")}</Label>
                                                <div>
                                                    <Input type="number" {...register("stockCount")} className="h-11 rounded-sm border-[#8c8f94]" />
                                                    {errors.stockCount ? <p className="mt-1 text-xs text-red-600">{errors.stockCount.message}</p> : null}
                                                </div>
                                            </div>

                                            <div className="grid items-center gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
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
                                        <div className="max-w-[760px] space-y-4">
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
                                                <div className="grid grid-cols-3 gap-3">
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
                                        <div className="max-w-[760px] space-y-4">
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

                                    {activeProductDataTab === "supplier" ? (
                                        <div className="space-y-5">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="text-base font-semibold text-slate-900">{tx("Suppliers", "Tedarikçiler")}</h3>
                                                    <p className="mt-1 text-sm text-slate-500">{tx("Supplier records stay only in admin. Quantity is tracked in settings.", "Tedarikçi kayıtları sadece adminde kalır. Quantity bilgisi settings tarafında takip edilir.")}</p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    className="rounded-sm bg-[#2271b1] text-white hover:bg-[#135e96]"
                                                    onClick={() => setSupplierDialogOpen(true)}
                                                >
                                                    {tx("Add supplier", "Tedarikçi Ekle")}
                                                </Button>
                                            </div>

                                            {supplierItems.length === 0 ? (
                                                <div className="rounded-sm border border-dashed border-[#c3c4c7] bg-[#f6f7f7] px-4 py-6 text-sm text-slate-500">
                                                    {tx("No supplier added yet.", "Henüz tedarikçi eklenmedi.")}
                                                </div>
                                            ) : (
                                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                                    {supplierItems.map((supplier, index) => (
                                                        <div key={`${supplier.name}-${index}`} className="rounded-sm border border-[#dcdcde] bg-[#f8fafc] p-4">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <h4 className="text-sm font-semibold text-slate-900">{supplier.company || supplier.name || supplier.number || tx("Company not set", "Şirket belirtilmedi")}</h4>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="text-xs font-medium text-red-600 hover:underline"
                                                                    onClick={() => removeSupplier(index)}
                                                                >
                                                                    {tx("Remove", "Kaldır")}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
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
                                                <div className="grid gap-4 p-4 md:grid-cols-2">
                                                    <DropdownMultiSelect
                                                        label={tx("Type", "Tip")}
                                                        options={availableTypeOptions}
                                                        value={selectedTypeIds}
                                                        onChange={(val) => setValue("typeIds", val, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                                                        placeholder={tx("Select type", "Tip seç")}
                                                        error={errors.typeIds?.message as string | undefined}
                                                    />
                                                    <DropdownMultiSelect
                                                        label={tx("Style", "Stil")}
                                                        options={availableStyleOptions}
                                                        value={selectedStyleIds}
                                                        onChange={(val) => setValue("styleIds", val, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                                                        placeholder={tx("Select style", "Stil seç")}
                                                        error={errors.styleIds?.message as string | undefined}
                                                    />
                                                    <DropdownMultiSelect
                                                        label={tx("Color", "Renk")}
                                                        options={availableColorOptions}
                                                        value={selectedColorIds}
                                                        onChange={(val) => setValue("colorIds", val, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                                                        placeholder={tx("Select color", "Renk seç")}
                                                        error={errors.colorIds?.message as string | undefined}
                                                    />
                                                    <DropdownMultiSelect
                                                        label={tx("Size", "Boyut")}
                                                        options={availableSizeOptions}
                                                        value={selectedSizeIds}
                                                        onChange={(val) => setValue("sizeIds", val, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                                                        placeholder={tx("Select size", "Boyut seç")}
                                                        error={errors.sizeIds?.message as string | undefined}
                                                    />
                                                    <DropdownMultiSelect
                                                        label={tx("Age", "Yaş")}
                                                        options={availableAgeOptions}
                                                        value={selectedAgeIds}
                                                        onChange={(val) => setValue("ageIds", val, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                                                        placeholder={tx("Select age", "Yaş seç")}
                                                        error={errors.ageIds?.message as string | undefined}
                                                    />
                                                    <DropdownMultiSelect
                                                        label={tx("Material", "Malzeme")}
                                                        options={availableMaterialOptions}
                                                        value={selectedMaterialIds}
                                                        onChange={(val) => setValue("materialIds", val, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                                                        placeholder={tx("Select material", "Malzeme seç")}
                                                        error={errors.materialIds?.message as string | undefined}
                                                    />
                                                </div>
                                            </div>
                                            <div className="rounded-sm border border-[#dcdcde] bg-[#f6f7f7] p-4 text-sm text-slate-600">
                                                {tx("Add descriptive pieces of information customers can see on the product page, such as Material, Size, or Origin.", "Müşterilerin ürün sayfasında göreceği açıklayıcı bilgileri ekleyin; örneğin Malzeme, Boyut veya Köken.")}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button type="button" variant="outline" className="rounded-sm border-[#2271b1] bg-white text-[#2271b1] hover:bg-[#f0f6fc]" onClick={addCustomAttribute}>
                                                    {tx("Add new", "Yeni ekle")}
                                                </Button>
                                            </div>

                                            <p className="text-sm text-slate-500">{tx("Manual product attributes shown on the storefront Attributes tab.", "Elle eklenen ürün özellikleri ön taraftaki Özellikler sekmesinde gösterilir.")}</p>

                                            <div className="space-y-3">
                                                {customAttributeItems.length === 0 ? (
                                                    <div className="rounded-sm border border-dashed border-[#c3c4c7] bg-[#f6f7f7] px-4 py-3 text-sm text-slate-500">
                                                        {tx("No manual attributes yet. Click Add new.", "Henüz manuel özellik yok. Yeni ekle'ye tıklayın.")}
                                                    </div>
                                                ) : (
                                                    customAttributeItems.map((attribute, index) => (
                                                        <div key={`custom-attribute-${index}`} className="rounded-sm border border-[#dcdcde] bg-white">
                                                            <div className="flex items-center justify-between border-b border-[#dcdcde] px-4 py-3">
                                                                <h4 className="text-base font-semibold text-slate-700">
                                                                    {attribute.name?.trim() || (isTr ? `Yeni özellik ${index + 1}` : `New attribute ${index + 1}`)}
                                                                </h4>
                                                                <button
                                                                    type="button"
                                                                    className="text-sm font-medium text-red-600 hover:underline"
                                                                    onClick={() => removeCustomAttribute(index)}
                                                                >
                                                                    {tx("Remove", "Kaldır")}
                                                                </button>
                                                            </div>
                                                            <div className="grid gap-4 p-4 md:grid-cols-[240px_minmax(0,1fr)]">
                                                                <div className="space-y-3">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-sm font-medium text-slate-700">{tx("Name", "Ad")}</Label>
                                                                        <Input
                                                                            value={attribute.name || ""}
                                                                            onChange={(event) => updateCustomAttribute(index, { name: event.target.value })}
                                                                            placeholder={tx("e.g. length or weight", "örnek: uzunluk veya ağırlık")}
                                                                            className="h-10 rounded-sm border-[#8c8f94]"
                                                                        />
                                                                    </div>
                                                                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                                                        <Checkbox
                                                                            checked={attribute.visible !== false}
                                                                            onCheckedChange={(checked) => updateCustomAttribute(index, { visible: checked === true })}
                                                                        />
                                                                        {tx("Visible on the product page", "Ürün sayfasında görünsün")}
                                                                    </label>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Label className="text-sm font-medium text-slate-700">{tx("Value(s)", "Değer(ler)")}</Label>
                                                                    <textarea
                                                                        value={(attribute.values || []).join(" | ")}
                                                                        onChange={(event) =>
                                                                            updateCustomAttribute(index, {
                                                                                values: event.target.value
                                                                                    .split("|")
                                                                                    .map((item) => item.trim())
                                                                                    .filter(Boolean),
                                                                            })
                                                                        }
                                                                        placeholder={tx('Enter values. Use "|" to separate values.', 'Değerleri girin. Değerleri ayırmak için "|" kullanın.')}
                                                                        className="min-h-[110px] w-full rounded-sm border border-[#8c8f94] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2271b1]"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    ) : null}

                                    {activeProductDataTab === "advanced" ? (
                                        <div className="max-w-[760px] space-y-4">
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

                        <div className="rounded-sm border border-[#c3c4c7] bg-white">
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

                        <div className="rounded-sm border border-[#c3c4c7] bg-white">
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
                                onChange={(nextValue) => setValue("seoDescription", nextValue, { shouldValidate: true, shouldDirty: true, shouldTouch: true })}
                                placeholder={tx("Short description shown near product title and price.", "Ürün başlığı ve fiyata yakın gösterilecek kısa açıklama.")}
                                minHeight={170}
                            />
                        </div>
                    </section>

                    <aside className="space-y-7 xl:col-start-2">
                        <div className="rounded-sm border border-[#c3c4c7] bg-white">
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

                        <div className="rounded-sm border border-[#c3c4c7] bg-white">
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
                                            {primaryImage ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => openImagePreview(0)}
                                                        className="block w-full overflow-hidden rounded-sm"
                                                    >
                                                        <img src={primaryImage} alt={tx("Product image thumb", "Ürün görsel önizleme")} className="h-20 w-full rounded-sm object-cover" />
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

                        <div className="rounded-sm border border-[#c3c4c7] bg-white">
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

                        <div className="rounded-sm border border-[#c3c4c7] bg-white">
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

                        <div className="rounded-sm border border-[#c3c4c7] bg-white">
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

                        <div className="rounded-sm border border-[#c3c4c7] bg-white">
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
                            <div className="rounded-sm border border-red-200 bg-red-50">
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
                    description: stripHtmlPreview(shortDescriptionValue || ""),
                    categoryFolderPath: primaryCategoryFolderPath,
                }}
            />
        ) : null}
        <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>{tx("Add supplier", "Tedarikçi Ekle")}</DialogTitle>
                    <DialogDescription>{tx("Supplier data stays only in the admin panel.", "Tedarikçi verisi sadece admin panelinde kalır.")}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="space-y-1.5">
                        <Label>{tx("Supplier name", "Tedarikçi adı")}</Label>
                        <Input value={supplierDraft.name} onChange={(event) => setSupplierDraft((prev) => ({ ...prev, name: event.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>{tx("Number", "Number")}</Label>
                        <Input value={supplierDraft.number} onChange={(event) => setSupplierDraft((prev) => ({ ...prev, number: event.target.value.toUpperCase() }))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>{tx("Company", "Şirket")}</Label>
                        <Input value={supplierDraft.company} onChange={(event) => setSupplierDraft((prev) => ({ ...prev, company: event.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>{tx("Phone", "Telefon")}</Label>
                        <Input value={supplierDraft.phone} onChange={(event) => setSupplierDraft((prev) => ({ ...prev, phone: event.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>{tx("Note", "Not")}</Label>
                        <textarea
                            value={supplierDraft.note}
                            onChange={(event) => setSupplierDraft((prev) => ({ ...prev, note: event.target.value }))}
                            className="min-h-[110px] w-full rounded-sm border border-[#8c8f94] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2271b1]"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setSupplierDialogOpen(false)}>
                        {tx("Cancel", "İptal")}
                    </Button>
                    <Button type="button" onClick={addSupplier}>
                        {tx("Add supplier", "Tedarikçi Ekle")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
            <DialogContent className="!left-1/2 !top-1/2 !translate-x-[-50%] !translate-y-[-50%] w-[90vw] max-w-5xl border-none bg-black/95 p-0 text-white">
                <div className="relative flex min-h-[70vh] items-center justify-center px-16 py-10">
                    {previewImages[imagePreviewIndex] ? (
                        <img
                            src={previewImages[imagePreviewIndex]}
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
