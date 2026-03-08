"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Page } from "@prisma/client"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
    Plus, Search, MoreHorizontal, Edit, Trash
} from "lucide-react"
import { toast } from "sonner" // Assuming sonner is installed as per products page
import { cn } from "@/lib/utils"

interface PageListProps {
    initialPages: Page[]
    metadata: {
        total: number
        page: number
        limit: number
        totalPages: number
    }
}

export function PageList({ initialPages, metadata }: PageListProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [selectedIds, setSelectedIds] = useState<string[]>([])

    // Status Filter State
    const currentStatus = searchParams.get('status') || 'ALL'

    const toggleSelectAll = () => {
        if (selectedIds.length === initialPages.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(initialPages.map((p) => p.id))
        }
    }

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter((item) => item !== id))
        } else {
            setSelectedIds([...selectedIds, id])
        }
    }

    const handleBulkStatus = async (status: "PUBLISHED" | "DRAFT") => {
        if (selectedIds.length === 0) return
        try {
            const res = await fetch("/api/admin/pages/bulk", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedIds, status }),
            })

            if (!res.ok) {
                toast.error("Failed to update selected pages")
                return
            }

            toast.success(status === "PUBLISHED" ? "Selected pages published" : "Selected pages moved to draft")
            setSelectedIds([])
            router.refresh()
        } catch {
            toast.error("Failed to update selected pages")
        }
    }

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return
        if (!confirm(`Delete ${selectedIds.length} selected pages?`)) return

        try {
            const res = await fetch("/api/admin/pages/bulk", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedIds }),
            })

            if (!res.ok) {
                toast.error("Failed to delete selected pages")
                return
            }

            toast.success("Selected pages deleted")
            setSelectedIds([])
            router.refresh()
        } catch {
            toast.error("Failed to delete selected pages")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this page?")) return

        try {
            const res = await fetch(`/api/admin/pages/${id}`, { method: 'DELETE' })
            if (res.ok) {
                toast.success("Page deleted")
                router.refresh()
            } else {
                toast.error("Failed to delete page")
            }
        } catch {
            toast.error("Error deleting page")
        }
    }

    const handleSearch = (term: string) => {
        const params = new URLSearchParams(window.location.search)
        if (term) params.set('search', term)
        else params.delete('search')
        params.set('page', '1')
        router.replace(`?${params.toString()}`)
    }

    const handleStatusFilter = (status: string) => {
        const params = new URLSearchParams(window.location.search)
        if (status === 'ALL') params.delete('status')
        else params.set('status', status)
        params.set('page', '1')
        router.replace(`?${params.toString()}`)
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 w-full">
                <div className="flex items-center gap-2 flex-1 relative w-full sm:max-w-md">
                    <Search className="h-4 w-4 absolute left-3 text-muted-foreground" />
                    <Input
                        placeholder="Search pages..."
                        className="pl-9 w-full bg-white border-[#dce3ed] text-slate-900 placeholder:text-slate-400"
                        defaultValue={searchParams.get('search') ?? ''}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {selectedIds.length > 0 ? (
                        <>
                            <Button variant="outline" size="sm" onClick={() => handleBulkStatus("PUBLISHED")}>Publish</Button>
                            <Button variant="outline" size="sm" onClick={() => handleBulkStatus("DRAFT")}>Draft</Button>
                            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>Delete ({selectedIds.length})</Button>
                        </>
                    ) : (
                        <>
                            {/* Filter Tabs */}
                            <div className="flex bg-slate-100 p-1 rounded-lg mr-2 border border-[#dce3ed]">
                                {['ALL', 'PUBLISHED', 'DRAFT', 'TRASH'].map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => handleStatusFilter(status)}
                                        className={cn(
                                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                            currentStatus === status
                                                ? "bg-white shadow text-slate-900"
                                                : "text-slate-500 hover:text-slate-900"
                                        )}
                                    >
                                        {status.charAt(0) + status.slice(1).toLowerCase()}
                                    </button>
                                ))}
                            </div>

                            <Button size="sm" onClick={() => router.push("/dashboard/pages/new")}>
                                <Plus className="h-4 w-4 mr-2" /> Add New
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-[#dce3ed] bg-white w-full shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                <Table>
                    <TableHeader className="[&_tr]:bg-slate-50/80">
                        <TableRow>
                            <TableHead className="w-[40px]">
                                <Checkbox
                                    checked={selectedIds.length === initialPages.length && initialPages.length > 0}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Updated</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialPages.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No pages found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            initialPages.map((page) => (
                                <TableRow key={page.id} className="group hover:bg-transparent transition-transform duration-150 hover:scale-[1.003]">
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.includes(page.id)}
                                            onCheckedChange={() => toggleSelect(page.id)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium text-slate-900">
                                        <Link href={`/dashboard/pages/${page.id}`} className="hover:underline hover:text-teal-600 block py-1">
                                            {page.title}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-slate-600 text-sm">{page.slug}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "uppercase text-[10px] tracking-wide",
                                            page.status === 'PUBLISHED' && "bg-green-50 text-green-700 border-green-200",
                                            page.status === 'DRAFT' && "bg-slate-50 text-slate-600 border-slate-200",
                                            page.status === 'TRASH' && "bg-red-50 text-red-600 border-red-200"
                                        )}>
                                            {page.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-slate-600 text-xs">
                                        {new Date(page.updatedAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/pages/${page.id}`}>
                                                        <Edit className="h-4 w-4 mr-2" /> Edit
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(page.id)}>
                                                    <Trash className="h-4 w-4 mr-2" /> Trash
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between text-sm text-muted-foreground p-2">
                <div>
                    Showing {initialPages.length} of {metadata.total} results
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={metadata.page <= 1}
                        onClick={() => {
                            const params = new URLSearchParams(window.location.search);
                            params.set('page', (metadata.page - 1).toString());
                            router.push(`?${params.toString()}`);
                        }}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={metadata.page >= metadata.totalPages}
                        onClick={() => {
                            const params = new URLSearchParams(window.location.search);
                            params.set('page', (metadata.page + 1).toString());
                            router.push(`?${params.toString()}`);
                        }}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}
