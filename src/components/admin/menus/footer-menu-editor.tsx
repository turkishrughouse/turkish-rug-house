"use client"

import { useMemo, useState } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { GripVertical } from "lucide-react"
import type { MenuItem } from "./menu-builder"

type FooterMenuEditorProps = {
  items: MenuItem[]
  onChange: (items: MenuItem[]) => void
}

type DropMode = "inside" | "after"

function getSubtreeIds(items: MenuItem[], id: string) {
  const map = new Map<string, string[]>()
  items.forEach((item) => {
    const parent = item.parentId || "__ROOT__"
    if (!map.has(parent)) map.set(parent, [])
    map.get(parent)!.push(item.id)
  })
  const out = new Set<string>()
  const walk = (nodeId: string) => {
    out.add(nodeId)
    ;(map.get(nodeId) || []).forEach(walk)
  }
  walk(id)
  return out
}

function findInsertIndexAfterSubtree(items: MenuItem[], rootId: string) {
  const start = items.findIndex((item) => item.id === rootId)
  if (start === -1) return items.length
  const depth = items[start].depth
  let idx = start + 1
  while (idx < items.length && items[idx].depth > depth) idx += 1
  return idx
}

function normalizeHierarchy(items: MenuItem[]) {
  const normalized: MenuItem[] = []

  for (let i = 0; i < items.length; i += 1) {
    const original = items[i]
    let depth = Math.max(0, Math.min(2, original.depth))

    if (i === 0) depth = 0
    else {
      const prevDepth = normalized[i - 1].depth
      depth = Math.min(depth, prevDepth + 1)
    }

    let parentId: string | null = null
    if (depth > 0) {
      for (let j = i - 1; j >= 0; j -= 1) {
        if (normalized[j].depth === depth - 1) {
          parentId = normalized[j].id
          break
        }
      }
      if (!parentId) {
        depth = 0
      }
    }

    normalized.push({
      ...original,
      depth,
      parentId: depth === 0 ? null : parentId,
    })
  }

  return normalized
}

function moveBranch(items: MenuItem[], draggedId: string, targetId: string, mode: DropMode) {
  const dragIndex = items.findIndex((item) => item.id === draggedId)
  if (dragIndex === -1) return items

  const dragDepth = items[dragIndex].depth
  let dragEnd = dragIndex + 1
  while (dragEnd < items.length && items[dragEnd].depth > dragDepth) dragEnd += 1

  const dragBranch = items.slice(dragIndex, dragEnd)
  const dragIds = new Set(dragBranch.map((item) => item.id))
  if (dragIds.has(targetId)) return items

  const listWithoutBranch = [...items.slice(0, dragIndex), ...items.slice(dragEnd)]
  const targetIndex = listWithoutBranch.findIndex((item) => item.id === targetId)
  if (targetIndex === -1) return items

  const target = listWithoutBranch[targetIndex]
  const nextDepth = mode === "inside" ? Math.min(target.depth + 1, 2) : target.depth
  const depthShift = nextDepth - dragBranch[0].depth
  const adjusted = dragBranch.map((item, idx) => ({
    ...item,
    depth: Math.max(0, Math.min(2, item.depth + depthShift)),
    parentId: idx === 0
      ? (mode === "inside" ? target.id : target.parentId)
      : item.parentId,
  }))

  const insertAt = findInsertIndexAfterSubtree(listWithoutBranch, targetId)
  const merged = [...listWithoutBranch.slice(0, insertAt), ...adjusted, ...listWithoutBranch.slice(insertAt)]
  return normalizeHierarchy(merged)
}

export function FooterMenuEditor({ items, onChange }: FooterMenuEditorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<"DELETE_SELECTED">("DELETE_SELECTED")
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [hoverTarget, setHoverTarget] = useState<{ id: string; mode: DropMode } | null>(null)

  const sections = useMemo(() => items.filter((item) => item.depth === 0), [items])

  const validSelectedIds = useMemo(() => {
    const allIds = new Set(items.map((item) => item.id))
    return Array.from(selectedIds).filter((id) => allIds.has(id))
  }, [items, selectedIds])

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const updateItem = (id: string, patch: Partial<MenuItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const addSection = () => {
    const next: MenuItem = {
      id: `temp-section-${Date.now()}`,
      type: "CUSTOM",
      label: `New Section ${sections.length + 1}`,
      url: "#",
      depth: 0,
      parentId: null,
    }
    onChange([...items, next])
  }

  const addLinkToSection = (sectionId: string) => {
    const insertAt = findInsertIndexAfterSubtree(items, sectionId)
    const next: MenuItem = {
      id: `temp-link-${Date.now()}`,
      type: "CUSTOM",
      label: "New Link",
      url: "/",
      depth: 1,
      parentId: sectionId,
    }
    onChange([...items.slice(0, insertAt), next, ...items.slice(insertAt)])
  }

  const addSubmenuToLink = (linkId: string) => {
    const parent = items.find((item) => item.id === linkId)
    if (!parent) return
    const insertAt = findInsertIndexAfterSubtree(items, linkId)
    const next: MenuItem = {
      id: `temp-sublink-${Date.now()}`,
      type: "CUSTOM",
      label: "New Sub Link",
      url: "/",
      depth: Math.min(parent.depth + 1, 2),
      parentId: linkId,
    }
    onChange([...items.slice(0, insertAt), next, ...items.slice(insertAt)])
  }

  const removeIds = (ids: Set<string>) => {
    onChange(items.filter((item) => !ids.has(item.id)))
    setSelectedIds(new Set())
  }

  const removeSection = (sectionId: string) => {
    removeIds(getSubtreeIds(items, sectionId))
  }

  const applyBulk = () => {
    if (validSelectedIds.length === 0) return
    if (bulkAction === "DELETE_SELECTED") {
      const expanded = new Set<string>()
      validSelectedIds.forEach((id) => {
        getSubtreeIds(items, id).forEach((subId) => expanded.add(subId))
      })
      removeIds(expanded)
    }
  }

  const handleDragStart = (id: string) => {
    setDraggedId(id)
    setHoverTarget(null)
  }

  const handleDropToSection = (event: React.DragEvent, sectionId: string) => {
    event.preventDefault()
    if (!draggedId || draggedId === sectionId) return
    const moved = moveBranch(items, draggedId, sectionId, "inside")
    onChange(moved)
    setDraggedId(null)
    setHoverTarget(null)
  }

  const handleDropToItem = (event: React.DragEvent, targetId: string, mode: DropMode) => {
    event.preventDefault()
    if (!draggedId || draggedId === targetId) return
    const moved = moveBranch(items, draggedId, targetId, mode)
    onChange(moved)
    setDraggedId(null)
    setHoverTarget(null)
  }

  const renderChildren = (parentId: string, level: 1 | 2) => {
    const children = items.filter((item) => item.parentId === parentId)
    if (children.length === 0) return null

    return (
      <div className={level === 1 ? "space-y-2" : "space-y-2 pl-6"}>
        {children.map((node) => (
          <div key={node.id} className="space-y-2 rounded-md border border-slate-200 p-2" draggable onDragStart={() => handleDragStart(node.id)} onDragEnd={() => { setDraggedId(null); setHoverTarget(null) }}>
            <div
              className={`rounded-md ${hoverTarget?.id === node.id && hoverTarget.mode === "inside" ? "bg-teal-50 ring-1 ring-teal-300" : ""}`}
              onDragOver={(event) => {
                event.preventDefault()
                if (draggedId && draggedId !== node.id) setHoverTarget({ id: node.id, mode: "inside" })
              }}
              onDragLeave={() => {
                if (hoverTarget?.id === node.id && hoverTarget.mode === "inside") setHoverTarget(null)
              }}
              onDrop={(event) => handleDropToItem(event, node.id, "inside")}
            >
              <div className={`grid grid-cols-1 gap-2 ${level === 1 ? "md:grid-cols-[auto_auto_1fr_1.3fr_auto_auto]" : "md:grid-cols-[auto_auto_1fr_1.3fr_auto]"} md:items-center`}>
                <div className="cursor-grab text-slate-400">
                  <GripVertical className="h-4 w-4" />
                </div>
                <Checkbox checked={selectedIds.has(node.id)} onCheckedChange={(c) => toggleSelected(node.id, Boolean(c))} />
                <Input value={node.label} onChange={(e) => updateItem(node.id, { label: e.target.value })} className="h-8" placeholder={level === 1 ? "Link title" : "Sub link title"} />
                <Input value={node.url || ""} onChange={(e) => updateItem(node.id, { url: e.target.value })} className="h-8" placeholder="/path" />
                {level === 1 ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => addSubmenuToLink(node.id)}>
                    Add Submenu
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => removeIds(getSubtreeIds(items, node.id))}
                >
                  Delete
                </Button>
              </div>
            </div>

            <div
              className={`h-2 rounded ${hoverTarget?.id === node.id && hoverTarget.mode === "after" ? "bg-teal-200" : "bg-transparent"}`}
              onDragOver={(event) => {
                event.preventDefault()
                if (draggedId && draggedId !== node.id) setHoverTarget({ id: node.id, mode: "after" })
              }}
              onDragLeave={() => {
                if (hoverTarget?.id === node.id && hoverTarget.mode === "after") setHoverTarget(null)
              }}
              onDrop={(event) => handleDropToItem(event, node.id, "after")}
            />

            {level === 1 ? renderChildren(node.id, 2) : null}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3">
        <Button type="button" variant="outline" className="h-9" onClick={addSection}>
          Add Section
        </Button>
        <select
          value={bulkAction}
          onChange={(e) => setBulkAction(e.target.value as "DELETE_SELECTED")}
          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
        >
          <option value="DELETE_SELECTED">Delete selected</option>
        </select>
        <Button type="button" variant="outline" className="h-9" onClick={applyBulk} disabled={validSelectedIds.length === 0}>
          Apply Bulk
        </Button>
        <span className="ml-auto text-xs text-slate-500">Sections: {sections.length}</span>
      </div>

      <Accordion type="multiple" className="rounded-lg border border-slate-200 bg-white px-4">
        {sections.map((section) => (
          <AccordionItem value={section.id} key={section.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex min-w-0 flex-1 items-center gap-3 pr-3">
                <Checkbox checked={selectedIds.has(section.id)} onCheckedChange={(c) => toggleSelected(section.id, Boolean(c))} />
                <Input
                  value={section.label}
                  onChange={(e) => updateItem(section.id, { label: e.target.value })}
                  className="h-9 max-w-[360px]"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => addLinkToSection(section.id)}>
                    Add Link
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => removeSection(section.id)}>
                    Delete Section
                  </Button>
                </div>

                <div
                  className={`rounded-md border border-dashed p-2 text-xs ${draggedId ? "border-teal-300 bg-teal-50 text-teal-700" : "border-slate-300 text-slate-500"}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDropToSection(event, section.id)}
                >
                  Drop here to place item under this main menu
                </div>

                {renderChildren(section.id, 1) || (
                  <p className="text-xs text-slate-500">No links yet.</p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
