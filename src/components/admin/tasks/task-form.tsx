"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { TASK_PRIORITIES, TASK_STATUSES, getTaskStatusLabel, type TaskPriority, type TaskStatus } from "@/lib/tasks"
import type { TaskCategoryOption, TaskProductOption, TaskRecord, TaskUserPreview } from "@/components/admin/tasks/task-board-types"

export function TaskForm({
  open,
  onOpenChange,
  users,
  products,
  categories,
  initialTask,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: TaskUserPreview[]
  products: TaskProductOption[]
  categories: TaskCategoryOption[]
  initialTask?: TaskRecord | null
  onSubmit: (payload: {
    title: string
    description: string
    priority: TaskPriority
    status: TaskStatus
    dueDate: string
    relatedCategoryId: string
    relatedProductIds: string[]
    relatedProductId: string
    assignedToId: string
    progressNote: string
  }) => Promise<void>
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM")
  const [status, setStatus] = useState<TaskStatus>("BACKLOG")
  const [dueDate, setDueDate] = useState("")
  const [relatedCategoryId, setRelatedCategoryId] = useState("")
  const [relatedProductIds, setRelatedProductIds] = useState<string[]>([])
  const [assignedToId, setAssignedToId] = useState("")
  const [progressNote, setProgressNote] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(initialTask?.title || "")
    setDescription(initialTask?.description || "")
    setPriority(initialTask?.priority || "MEDIUM")
    setStatus(initialTask?.status || "BACKLOG")
    setDueDate(initialTask?.dueDate ? initialTask.dueDate.slice(0, 10) : "")
    setRelatedCategoryId(initialTask?.relatedCategoryId || "")
    setRelatedProductIds(initialTask?.relatedProductIds || initialTask?.relatedProducts.map((product) => product.id) || [])
    setAssignedToId(initialTask?.assignedToId || "")
    setProgressNote(initialTask?.progressNote || "")
    setProductSearch("")
  }, [initialTask, open])

  const selectedCategory = categories.find((category) => category.id === relatedCategoryId) || null
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase()
    const base = products.slice(0, 80)
    if (!query) return base
    return base.filter((product) =>
      [product.title, product.sku, product.slug].some((value) => value?.toLowerCase().includes(query)),
    )
  }, [productSearch, products])

  const toggleProduct = (productId: string) => {
    setRelatedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((entry) => entry !== productId) : [...prev, productId],
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#dce3ed] bg-white sm:max-w-[880px]">
        <DialogHeader>
          <DialogTitle>{initialTask ? "Edit Operational Task" : "Create Operational Task"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault()
            setSaving(true)
            try {
              await onSubmit({
                title,
                description,
                priority,
                status,
                dueDate,
                relatedCategoryId,
                relatedProductIds,
                relatedProductId: relatedProductIds[0] || "",
                assignedToId,
                progressNote,
              })
              onOpenChange(false)
            } finally {
              setSaving(false)
            }
          }}
        >
          <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Category-linked work</p>
            <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Category</p>
                <select
                  value={relatedCategoryId}
                  onChange={(event) => setRelatedCategoryId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[#dce3ed] bg-white px-3 text-sm"
                >
                  <option value="">No category selected</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-[#dce3ed] bg-white px-4 py-3">
                {selectedCategory ? (
                  <>
                    <p className="text-sm font-semibold text-slate-950">{selectedCategory.title}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-slate-50 px-2 py-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Total</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{selectedCategory.totalProducts}</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 px-2 py-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-700">Uploaded</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-900">{selectedCategory.uploadedProducts}</p>
                      </div>
                      <div className="rounded-xl bg-amber-50 px-2 py-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-amber-700">Remaining</p>
                        <p className="mt-1 text-sm font-semibold text-amber-900">{selectedCategory.remainingProducts}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center text-sm text-slate-500">Select a category to show upload context.</div>
                )}
              </div>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Task Title</p>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Upload all new Oushak rugs" required />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Assignee</p>
              <select value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)} className="h-10 w-full rounded-xl border border-[#dce3ed] px-3 text-sm">
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {(user.name || user.email)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the upload, review, or metadata work clearly." className="min-h-[120px]" />

          <div className="grid gap-4 md:grid-cols-3">
            <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} className="h-10 rounded-xl border border-[#dce3ed] px-3 text-sm">
              {TASK_PRIORITIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)} className="h-10 rounded-xl border border-[#dce3ed] px-3 text-sm">
              {TASK_STATUSES.map((item) => (
                <option key={item} value={item}>{getTaskStatusLabel(item)}</option>
              ))}
            </select>
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>

          <section className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Related Products</p>
                <p className="mt-1 text-sm text-slate-500">Optional products that anchor the work to specific catalog items.</p>
              </div>
              <Input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Search products"
                className="w-full max-w-xs"
              />
            </div>
            <div className="mt-4 max-h-[240px] overflow-y-auto rounded-2xl border border-slate-200">
              {filteredProducts.map((product) => {
                const selected = relatedProductIds.includes(product.id)
                return (
                  <label key={product.id} className="flex cursor-pointer items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{product.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{product.sku || product.slug}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleProduct(product.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </label>
                )
              })}
            </div>
          </section>

          <Textarea value={progressNote} onChange={(event) => setProgressNote(event.target.value)} placeholder="Optional operational note" className="min-h-[96px]" />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : initialTask ? "Save Changes" : "Create Task"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
