"use client"

import React, { useMemo, useState } from "react"
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
} from "@dnd-kit/core"
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, X, CornerDownRight, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"

// --- Types ---
export interface MenuItem {
    id: string
    type: "PAGE" | "CATEGORY" | "CUSTOM"
    label: string
    url: string
    referenceId?: string
    depth: number
    parentId: string | null
    collapsed?: boolean
}

interface MenuBuilderProps {
    items: MenuItem[]
    onChange: (items: MenuItem[]) => void
}

const indentationWidth = 40

// --- Sortable Item Component ---
function SortableMenuItem({
    item,
    onRemove,
    hasChildren = false,
    isCollapsed = false,
    onToggleCollapse,
    style: propStyle,
    isOverlay = false,
}: {
    item: MenuItem
    onRemove?: (id: string) => void
    hasChildren?: boolean
    isCollapsed?: boolean
    onToggleCollapse?: (id: string) => void
    style?: React.CSSProperties
    isOverlay?: boolean
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id })

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        marginLeft: `${item.depth * indentationWidth}px`,
        ...propStyle,
    }

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="bg-slate-100 border border-slate-200 rounded p-3 mb-2 opacity-50"
            >
                <div className="h-6" />
            </div>
        )
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative bg-white border border-slate-200 rounded shadow-sm mb-2 group transition-shadow ${isOverlay ? "shadow-xl border-teal-500 z-50 cursor-grabbing" : "hover:border-slate-300"
                }`}
        >
            <div className="flex items-center p-3">
                {/* Drag Handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-1 -ml-1 mr-2 text-slate-400 hover:text-slate-600"
                >
                    <GripVertical className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {item.type}
                        </span>
                        <span className="text-sm font-medium text-slate-800 truncate">{item.label}</span>
                    </div>
                    {(item.type === "CUSTOM" || isOverlay) && (
                        <div className="text-[10px] text-slate-400 truncate mt-0.5 pl-0.5">{item.url}</div>
                    )}
                </div>

                {/* Actions */}
                {!isOverlay ? (
                    <div className="flex items-center gap-1">
                        {item.depth === 0 && hasChildren && onToggleCollapse ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                onClick={() => onToggleCollapse(item.id)}
                                title={isCollapsed ? "Expand" : "Collapse"}
                            >
                                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                            </Button>
                        ) : null}
                        {onRemove ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                onClick={() => onRemove(item.id)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    )
}

// --- Main Builder Component ---

export function MenuBuilder({ items, onChange }: MenuBuilderProps) {
    const [activeId, setActiveId] = useState<string | null>(null)
    const [activeItem, setActiveItem] = useState<MenuItem | null>(null)
    const [collapsedRoots, setCollapsedRoots] = useState<Set<string>>(new Set())

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Prevent accidental drags
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    // --- Drag Logic ---

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event
        setActiveId(active.id as string)
        const item = items.find((i) => i.id === active.id)
        if (item) setActiveItem(item)
    }

    const handleDragMove = (event: DragMoveEvent) => {
        // We could implement real-time indentation visual feedback here if we wanted complex projection
        // For now, simpler is better.
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        setActiveId(null)
        setActiveItem(null)

        if (!over) return

        const activeIndex = items.findIndex((i) => i.id === active.id)
        const overIndex = items.findIndex((i) => i.id === over.id)

        // 1. Move Item in Array (Vertical Sort)
        let newItems = [...items]

        // Handle Subtree: Find all children and move them WITH the parent
        const getSubtreeCount = (index: number, list: MenuItem[]) => {
            let count = 0
            const parentDepth = list[index].depth
            for (let i = index + 1; i < list.length; i++) {
                if (list[i].depth > parentDepth) count++
                else break
            }
            return count
        }

        const subtreeSize = getSubtreeCount(activeIndex, newItems)
        const movingBlock = newItems.slice(activeIndex, activeIndex + 1 + subtreeSize)

        // Remove block from old position
        // Careful: If overIndex is inside our own subtree, ignore (but DnD kit usually prevents this visual overlap logic quirks) / 
        // Actually Dnd kit just gives us the over ID.

        // Simplification: Use arrayMove for the HEAD, then re-insert children?
        // Let's manually splice.

        // Remove old
        const listWithoutBlock = [...newItems]
        listWithoutBlock.splice(activeIndex, 1 + subtreeSize)

        // Calculate new insertion index
        // We need to find where 'over' is in the REDUCED list? No, overIndex is based on ORIGINAL list usually?
        // Wait, overId is stable. Find index in listWithoutBlock? 
        // Logic: if sorting down, insertion index adjustment.

        // Let's rely on arrayMove logic but adapted for blocks.
        // Actually, for simplicity and robustness in "WordPress Style", 
        // we often just move the single item, then re-attach children.
        // OR better: Just map the move for the single item, and children follow.

        // Let's try simple arrayMove first if just sorting.
        if (activeIndex !== overIndex) {
            // Note: This simple arrayMove doesn't handle subtree. 
            // We need to move the block.

            // Adjust overIndex for insertion
            // If we move DOWN: we want to insert AFTER the over item (if it wasn't strictly swaps).
            // DnD Kit list sorting usually implies SWAP.

            // Re-approach:
            // 1. Extract Block
            // 2. Insert Block at new specific index

            // Where is "over" now?
            const newOverIndex = listWithoutBlock.findIndex(i => i.id === over.id)

            // If moving down (originally), we likely want to be AFTER over?
            // Depends on direction.
            // Let's assume standard behavior: target index.

            if (newOverIndex === -1) {
                // Should not happen unless over was in the moving block (impossible)
                return
            }

            // Correction: If we drag below, we want to index+1.
            // But this is hard to detect from just "over".
            // Let's just use the arrayMove outcome as a hint.
            // arrayMove(items, activeIndex, overIndex) -> we see where active ends up.

            // Alternative: Just trust the user drop position visually?
            // "WordPress" behavior: Vertical position determines order. Horizontal determines depth.

            // Let's execute the vertical move of the block.
            const isMovingDown = activeIndex < overIndex

            let insertionIndex = newOverIndex
            if (isMovingDown) {
                insertionIndex = newOverIndex + 1
            }
            // Wait, if moving down, `listWithoutBlock` has shifted items up.
            // newOverIndex is the index of the item we hovered over.

            // Let's simplify: Just use `arrayMove` on the HEAD item, then re-splice children?
            // No, children need to stay strictly after.

            newItems = listWithoutBlock.toSpliced(
                isMovingDown ? newOverIndex + 1 : newOverIndex,
                0,
                ...movingBlock
            )
        }

        // 2. Handle Indentation (Depth Change)
        // DragEndEvent has `delta.x`. We can use that!
        const dragDeltaX = event.delta.x

        if (Math.abs(dragDeltaX) > 10) {
            const depthChange = Math.round(dragDeltaX / indentationWidth)
            if (depthChange !== 0) {
                const newDepth = Math.max(0, Math.min(10, movingBlock[0].depth + depthChange))
                const diff = newDepth - movingBlock[0].depth

                // Apply diff to all in block
                movingBlock.forEach(item => {
                    item.depth = Math.max(0, item.depth + diff)
                })
            }
        }

        // 3. Re-calculate Parent IDs based on new flat structure logic
        // Rule: Parent is the nearest PREVIOUS item with depth === myDepth - 1

        const finalItems = newItems.map((item, index) => {
            if (index === 0) {
                return { ...item, depth: 0, parentId: null } // Root is always 0 depth? Or allow root to have depth? No, roots are depth 0.
                // Actually, if I drag item to index 0, I can't be depth 1.
                // Force depth 0 for first item.
            }

            // Clamp depth based on previous item
            // Max depth = prev.depth + 1
            const prev = newItems[index - 1]
            const maxDepth = prev.depth + 1
            if (item.depth > maxDepth) {
                item.depth = maxDepth
            }

            // Find parent
            let parentId: string | null = null
            if (item.depth > 0) {
                for (let i = index - 1; i >= 0; i--) {
                    if (newItems[i].depth === item.depth - 1) {
                        parentId = newItems[i].id
                        break
                    }
                    if (newItems[i].depth < item.depth - 1) break
                }
            }

            return { ...item, parentId }
        })

        onChange(finalItems)
    }

    const hasChildren = (itemId: string) => items.some((candidate) => candidate.parentId === itemId)

    const visibleItems = items.filter((item, index) => {
        if (item.depth === 0) return true
        // Hide an item if any ancestor root is collapsed.
        let cursor = index - 1
        let rootId: string | null = null
        while (cursor >= 0) {
            if (items[cursor].depth < item.depth) {
                if (items[cursor].depth === 0) {
                    rootId = items[cursor].id
                    break
                }
                item = { ...item, depth: items[cursor].depth }
            }
            cursor--
        }
        return rootId ? !collapsedRoots.has(rootId) : true
    })

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
        >
            <div className="flex flex-col h-full bg-slate-50/50 rounded-lg border border-dashed border-slate-200 min-h-[400px]">
                <div className="flex-1 p-4 overflow-visible">
                    <SortableContext
                        items={visibleItems.map(i => i.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {visibleItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <CornerDownRight className="h-8 w-8 mb-2 opacity-20" />
                                <p className="text-sm">Drag items here or add from the left panel.</p>
                            </div>
                        ) : (
                            visibleItems.map((item) => (
                                <SortableMenuItem
                                    key={item.id}
                                    item={item}
                                    hasChildren={hasChildren(item.id)}
                                    isCollapsed={collapsedRoots.has(item.id)}
                                    onToggleCollapse={(id) => {
                                        setCollapsedRoots((prev) => {
                                            const next = new Set(prev)
                                            if (next.has(id)) next.delete(id)
                                            else next.add(id)
                                            return next
                                        })
                                    }}
                                    onRemove={(id) => {
                                        // Remove item and its children?
                                        // Or promote children?
                                        // "WordPress" usually keeps children but flattens them?
                                        // Let's remove block for safety/simplicity
                                        const idx = items.findIndex(i => i.id === id)
                                        // dumb remove single
                                        const next = items.filter(i => i.id !== id)
                                        onChange(next)
                                    }}
                                />
                            ))
                        )}
                    </SortableContext>
                </div>
            </div>

            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
                {activeItem ? (
                    <SortableMenuItem item={activeItem} isOverlay />
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}
