"use client"

import { useState, useMemo } from "react"
import { Category } from "@prisma/client"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronRight, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface CategoryCheckboxTreeProps {
    categories: Category[]
    selectedIds: string[]
    onChange: (ids: string[]) => void
}

type TreeNode = Category & {
    children: TreeNode[]
}

export function CategoryCheckboxTree({ categories, selectedIds, onChange }: CategoryCheckboxTreeProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    // 1. Build Tree
    const tree = useMemo(() => {
        const nodes: Record<string, TreeNode> = {}
        const roots: TreeNode[] = []

        // Initialize nodes
        categories.forEach(cat => {
            nodes[cat.id] = { ...cat, children: [] }
        })

        // Build hierarchy
        categories.forEach(cat => {
            if (cat.parentId && nodes[cat.parentId]) {
                nodes[cat.parentId].children.push(nodes[cat.id])
            } else {
                roots.push(nodes[cat.id])
            }
        })

        // Sort by title
        const sortNodes = (n: TreeNode[]) => {
            n.sort((a, b) => a.title.localeCompare(b.title))
            n.forEach(node => sortNodes(node.children))
        }
        sortNodes(roots)

        return roots
    }, [categories])

    // 2. Filter Tree based on search
    const filteredTree = useMemo(() => {
        if (!searchTerm) return tree

        const term = searchTerm.toLowerCase()

        const filterNode = (node: TreeNode): TreeNode | null => {
            const matches = node.title.toLowerCase().includes(term)
            const filteredChildren = node.children
                .map(filterNode)
                .filter((child): child is TreeNode => child !== null)

            if (matches || filteredChildren.length > 0) {
                // Determine if we should expand this node to show children matches
                if (filteredChildren.length > 0) {
                    // This is handled by effect or default expand logic usually, 
                    // but here we just return the structure.
                }
                return { ...node, children: filteredChildren }
            }
            return null
        }

        return tree.map(filterNode).filter((n): n is TreeNode => n !== null)
    }, [tree, searchTerm])

    // Auto-expand on search
    useMemo(() => {
        if (searchTerm) {
            const allIds = new Set<string>()
            const collectIds = (nodes: TreeNode[]) => {
                nodes.forEach(n => {
                    allIds.add(n.id)
                    collectIds(n.children)
                })
            }
            collectIds(filteredTree)
            setExpandedIds(allIds)
        }
    }, [searchTerm, filteredTree])


    const toggleExpand = (id: string) => {
        const next = new Set(expandedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setExpandedIds(next)
    }

    const handleCheck = (id: string, checked: boolean) => {
        if (checked) {
            onChange([...selectedIds, id])
        } else {
            onChange(selectedIds.filter(prev => prev !== id))
        }
    }

    // Render Helper
    const renderNode = (node: TreeNode, level = 0) => {
        const hasChildren = node.children.length > 0
        const isExpanded = expandedIds.has(node.id)

        return (
            <div key={node.id} className="select-none">
                <div
                    className={cn(
                        "flex items-center gap-2 py-1 hover:bg-slate-50 rounded pr-2",
                        level > 0 && "ml-4" // Simple indentation
                    )}
                >
                    {/* Expand/Collapse Toggle */}
                    <div
                        className={cn("w-4 h-4 flex items-center justify-center cursor-pointer text-slate-400 hover:text-slate-600 transition-colors", !hasChildren && "opacity-0")}
                        onClick={() => hasChildren && toggleExpand(node.id)}
                    >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </div>

                    {/* Checkbox */}
                    <Checkbox
                        id={`cat-${node.id}`}
                        checked={selectedIds.includes(node.id)}
                        onCheckedChange={(c) => handleCheck(node.id, c as boolean)}
                        className="h-3.5 w-3.5 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                    />

                    {/* Label */}
                    <label
                        htmlFor={`cat-${node.id}`}
                        className="text-sm cursor-pointer flex-1 truncate text-slate-700 font-normal"
                    >
                        {node.title}
                    </label>
                </div>

                {/* Children */}
                {hasChildren && isExpanded && (
                    <div className="border-l border-slate-100 ml-2">
                        {node.children.map(child => renderNode(child, level + 1))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                    placeholder="Search categories..."
                    className="pl-8 h-8 text-xs bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Tree */}
            <div className="border rounded-md p-2 h-60 overflow-y-auto bg-slate-50/30">
                {filteredTree.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-8">
                        {searchTerm ? "No matches found." : "No categories."}
                    </div>
                ) : (
                    filteredTree.map(node => renderNode(node))
                )}
            </div>
        </div>
    )
}
