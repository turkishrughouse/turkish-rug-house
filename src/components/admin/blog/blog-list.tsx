"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { Edit, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AdminMobileDetailCard } from "@/components/admin/mobile-detail-card"
import type { BlogListItem } from "@/lib/blog-shared"
import { formatBlogDate } from "@/lib/blog-shared"
import { cn } from "@/lib/utils"

export function BlogList({
  initialPosts,
  metadata,
}: {
  initialPosts: BlogListItem[]
  metadata: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentStatus = searchParams.get("status") || "ALL"
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  function updateQuery(key: string, value: string) {
    const params = new URLSearchParams(window.location.search)
    if (!value || value === "ALL") params.delete(key)
    else params.set(key, value)
    params.set("page", "1")
    router.replace(`?${params.toString()}`)
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this article permanently?")) return
    setIsDeleting(id)
    try {
      const res = await fetch(`/api/admin/blog/${id}`, { method: "DELETE" })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(json?.error || "Failed to delete article")
      toast.success("Article deleted")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete article")
    } finally {
      setIsDeleting(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            defaultValue={searchParams.get("search") || ""}
            placeholder="Search blog posts..."
            className="border-[#dce3ed] bg-white pl-9"
            onChange={(event) => updateQuery("search", event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex rounded-lg border border-[#dce3ed] bg-slate-100 p-1">
            {["ALL", "PUBLISHED", "DRAFT"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => updateQuery("status", status)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  currentStatus === status ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                )}
              >
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <Button asChild className="bg-[#0f766e] text-white hover:bg-[#0b5c56]">
            <Link href="/dashboard/blog/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Article
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-4 lg:hidden">
        {initialPosts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#dce3ed] bg-white px-6 py-10 text-center text-sm text-slate-500">
            No blog posts found yet.
          </div>
        ) : (
          initialPosts.map((post) => (
            <AdminMobileDetailCard
              key={post.id}
              title={post.title}
              subtitle={`/${post.slug}`}
              badges={
                <>
                  <Badge variant="outline" className={cn(post.status === "PUBLISHED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600")}>
                    {post.status}
                  </Badge>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                    {post.publishedAt ? formatBlogDate(post.publishedAt) : "Not scheduled"}
                  </Badge>
                </>
              }
              rows={[
                { label: "Updated", value: formatBlogDate(post.updatedAt) || "-" },
                { label: "Meta", value: post.metaTitle ? "Custom SEO" : "Default SEO" },
              ]}
              actions={
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/blog/${post.id}`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                    disabled={isDeleting === post.id}
                    onClick={() => handleDelete(post.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              }
            />
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-[#dce3ed] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)] lg:block">
        <Table>
          <TableHeader className="[&_tr]:bg-slate-50/80">
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialPosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-sm text-slate-500">
                  No blog posts found yet.
                </TableCell>
              </TableRow>
            ) : (
              initialPosts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <Link href={`/dashboard/blog/${post.id}`} className="block py-1 hover:text-[#0f766e]">
                      <div className="font-medium text-slate-900">{post.title}</div>
                      <div className="mt-1 line-clamp-1 max-w-xl text-sm text-slate-500">{post.excerpt}</div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(post.status === "PUBLISHED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600")}>
                      {post.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {post.publishedAt ? formatBlogDate(post.publishedAt) : "Not scheduled"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{formatBlogDate(post.updatedAt)}</TableCell>
                  <TableCell className="text-sm text-slate-500">/{post.slug}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/blog/${post.id}`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => handleDelete(post.id)}
                          disabled={isDeleting === post.id}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
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

      <div className="text-sm text-slate-500">
        {metadata.total} total article{metadata.total === 1 ? "" : "s"}
      </div>
    </div>
  )
}
