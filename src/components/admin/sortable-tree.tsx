
"use client"

import React, { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragMoveEvent,
    DragEndEvent,
    DropAnimation,
    MeasuringStrategy,
} from "@dnd-kit/core"
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Edit2, Trash2, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

// --- Types ---

export type FlatItem = {
    id: string
    parentId: string | null
    title: string
    slug: string
    count: number
    depth: number
    index: number
}

type ReorderUpdate = {
    id: string
    parentId: string | null
    sortOrder: number
}

interface SortableTreeProps {
    items: FlatItem[]
    setItems: (items: FlatItem[]) => void
    onEdit: (item: FlatItem) => void
    onDelete: (id: string) => void
    onReorder: (updates: { id: string, parentId: string | null, sortOrder: number }[]) => void
}

const indentationWidth = 24

export function SortableTree({ items, setItems, onEdit, onDelete, onReorder }: SortableTreeProps) {
    const [activeId, setActiveId] = useState<string | null>(null)
    const [offsetLeft, setOffsetLeft] = useState(0)
    const [openRootId, setOpenRootId] = useState<string | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const childCountMap = useMemo(() => {
        const counts = new Map<string, number>()
        for (const item of items) {
            if (!item.parentId) continue
            counts.set(item.parentId, (counts.get(item.parentId) || 0) + 1)
        }
        return counts
    }, [items])

    const parentById = useMemo(() => {
        const map = new Map<string, string | null>()
        for (const item of items) {
            map.set(item.id, item.parentId)
        }
        return map
    }, [items])

    const rootById = useMemo(() => {
        const map = new Map<string, string>()
        for (const item of items) {
            let currentId = item.id
            let parentId = parentById.get(currentId) ?? null
            while (parentId) {
                currentId = parentId
                parentId = parentById.get(currentId) ?? null
            }
            map.set(item.id, currentId)
        }
        return map
    }, [items, parentById])

    const visibleItems = useMemo(() => {
        return items.filter((item) => {
            if (item.depth === 0) return true
            const rootId = rootById.get(item.id)
            return Boolean(openRootId && rootId === openRootId)
        })
    }, [items, rootById, openRootId])

    const sortedIds = useMemo(() => visibleItems.map((item) => item.id), [visibleItems])
    const activeItem = useMemo(() => activeId ? items.find((i) => i.id === activeId) : null, [activeId, items])

    // --- Helper Functions ---

    /**
     * Get all descendants of a given parent ID
     */
    function getDescendants(items: FlatItem[], parentId: string): FlatItem[] {
        const descendants: FlatItem[] = []
        const children = items.filter(item => item.parentId === parentId)

        for (const child of children) {
            descendants.push(child)
            // Recursively get descendants of this child
            descendants.push(...getDescendants(items, child.id))
        }

        return descendants
    }

    // --- Logic ---

    function handleDragStart({ active }: DragStartEvent) {
        setActiveId(active.id as string)
    }

    function handleDragMove({ delta }: DragMoveEvent) {
        setOffsetLeft(delta.x)
    }

    function handleDragEnd({ active, over }: DragEndEvent) {
        resetState()

        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        if (activeId === overId) return // No change

        const clone = [...items]
        const activeIndex = clone.findIndex(i => i.id === activeId)
        const overIndex = clone.findIndex(i => i.id === overId)

        if (activeIndex === -1 || overIndex === -1) return

        const activeItem = clone[activeIndex]

        // Get all descendants of the dragged item (entire subtree)
        const descendants = getDescendants(clone, activeId)
        const subtree = [activeItem, ...descendants]
        const subtreeIds = new Set(subtree.map(item => item.id))

        // Remove entire subtree from current position
        const withoutSubtree = clone.filter(item => !subtreeIds.has(item.id))

        // Calculate insertion index
        // Find where the overItem is in the array WITHOUT the subtree
        const overItem = clone[overIndex]
        let insertIndex = withoutSubtree.findIndex(i => i.id === overItem.id)

        // If we're moving down (activeIndex < overIndex), insert after the over item
        if (activeIndex < overIndex) {
            insertIndex = insertIndex + 1
        }

        // Handle edge case: if insertIndex is -1 or out of bounds, place at end
        if (insertIndex === -1 || insertIndex > withoutSubtree.length) {
            insertIndex = withoutSubtree.length
        }

        // Insert entire subtree at new position
        const newItems = [
            ...withoutSubtree.slice(0, insertIndex),
            ...subtree,
            ...withoutSubtree.slice(insertIndex)
        ]

        // Calculate new depth for the dragged parent
        const projectedDepth = activeItem.depth + Math.round(offsetLeft / indentationWidth)
        const maxDepth = getMaxDepth(newItems, insertIndex)
        const minDepth = 0

        let newDepth = projectedDepth
        if (newDepth > maxDepth) newDepth = maxDepth
        if (newDepth < minDepth) newDepth = minDepth

        // Calculate depth change
        const depthDelta = newDepth - activeItem.depth

        // Find new parent based on new depth
        let newParentId: string | null = null
        for (let i = insertIndex - 1; i >= 0; i--) {
            if (newItems[i].depth === newDepth - 1) {
                newParentId = newItems[i].id
                break
            }
            if (newItems[i].depth < newDepth - 1) break
        }

        // Update depth and parentId for entire subtree
        const finalItems = newItems.map((item) => {
            if (item.id === activeId) {
                // Update the dragged parent
                return { ...item, depth: newDepth, parentId: newParentId }
            } else if (subtreeIds.has(item.id)) {
                // Update descendants: adjust depth relatively, keep their parentId relationships
                return { ...item, depth: item.depth + depthDelta }
            }
            return item
        })

        setItems(finalItems)

        // Generate API Payload
        // Group all items by their parentId and assign sortOrder
        const updates: ReorderUpdate[] = []
        const groups: Record<string, FlatItem[]> = {}

        finalItems.forEach(item => {
            const key = item.parentId || "root"
            if (!groups[key]) groups[key] = []
            groups[key].push(item)
        })

        Object.keys(groups).forEach(key => {
            const group = groups[key]
            group.forEach((item, idx) => {
                updates.push({
                    id: item.id,
                    parentId: item.parentId,
                    sortOrder: idx
                })
            })
        })

        onReorder(updates)
    }

    function resetState() {
        setActiveId(null)
        setOffsetLeft(0)
    }

    function getMaxDepth(items: FlatItem[], index: number) {
        const prevItem = items[index - 1]
        if (!prevItem) return 0
        return prevItem.depth + 1
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
        >
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50">
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead className="w-[40%]">Name</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
                        {visibleItems.map((item) => (
                            <SortableItem
                                key={item.id}
                                item={item}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                indentationWidth={indentationWidth}
                                hasChildren={(childCountMap.get(item.id) || 0) > 0}
                                isOpenRoot={item.depth === 0 && openRootId === item.id}
                                onToggleRoot={() => {
                                    if (item.depth !== 0) return
                                    setOpenRootId((prev) => (prev === item.id ? null : item.id))
                                }}
                            />
                        ))}
                    </SortableContext>
                </TableBody>
            </Table>

            {createPortal(
                <DragOverlay dropAnimation={dropAnimationConfig}>
                    {activeItem && (
                        <div className="opacity-90">
                            <Table>
                                <TableBody>
                                    <SortableItem
                                        item={activeItem}
                                        onEdit={onEdit}
                                        onDelete={onDelete}
                                        indentationWidth={indentationWidth}
                                        isOverlay
                                    />
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </DragOverlay>,
                document.body
            )}
        </DndContext>
    )
}

type SortableItemProps = {
    item: FlatItem
    onEdit: (item: FlatItem) => void
    onDelete: (id: string) => void
    indentationWidth: number
    isOverlay?: boolean
    hasChildren?: boolean
    isOpenRoot?: boolean
    onToggleRoot?: () => void
}

function SortableItem({
    item,
    onEdit,
    onDelete,
    indentationWidth,
    isOverlay,
    hasChildren,
    isOpenRoot,
    onToggleRoot,
}: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id })

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
    }

    if (isDragging && !isOverlay) {
        return (
            <TableRow ref={setNodeRef} style={style} className="bg-teal-50 opacity-50 relative">
                <TableCell colSpan={5} className="h-16 border-2 border-dashed border-teal-500/50 rounded-lg block w-full"></TableCell>
            </TableRow>
        )
    }

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={cn(
                "group hover:bg-slate-50 transition-colors bg-white",
                isOverlay && "shadow-xl border-t border-b border-slate-200"
            )}
        >
            <TableCell className="w-[50px] align-middle">
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab hover:text-slate-900 text-slate-400 p-1 rounded hover:bg-slate-100 w-fit"
                >
                    <Menu className="h-4 w-4" /> {/* Hamburger Menu Icon */}
                </div>
            </TableCell>
            <TableCell className="font-medium text-slate-900">
                <div className="flex items-center gap-2">
                    <div style={{ width: item.depth * indentationWidth }} />
                    {item.depth > 0 && <span className="text-slate-300">└</span>}
                    {item.depth === 0 && hasChildren ? (
                        <button
                            type="button"
                            onClick={onToggleRoot}
                            className="inline-flex items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-slate-100"
                        >
                            <span>{item.title}</span>
                            <span className="text-slate-400 text-xs">{isOpenRoot ? "▾" : "▸"}</span>
                        </button>
                    ) : (
                        <span>{item.title}</span>
                    )}
                </div>
            </TableCell>
            <TableCell className="text-slate-500">{item.slug}</TableCell>
            <TableCell>
                <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded bg-slate-100 text-xs font-medium text-slate-600">
                    {item.count}
                </span>
            </TableCell>
            <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => onEdit(item)}
                    >
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => onDelete(item.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    )
}

const dropAnimationConfig: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: {
            active: {
                opacity: '0.4',
            },
        },
    }),
}
