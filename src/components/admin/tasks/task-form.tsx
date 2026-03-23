"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "@/lib/tasks"
import { StorefrontProductImage } from "@/components/storefront/storefront-product-image"
import { buildProductImageAlt, getProductImageUrlCandidates, parseProductImageRecords } from "@/lib/product-images"

type AssignableUser = {
  id: string
  name: string | null
  email: string
  role: string
}

type EditableTask = {
  id: string
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  dueDate: string | null
  relatedProduct: { id: string; title: string; slug: string; sku: string | null; images: string } | null
  assignedToId: string | null
  progressNote: string | null
}

type TaskProductOption = {
  id: string
  title: string
  slug: string
  sku: string | null
  images: string
}

export function TaskForm({
  open,
  onOpenChange,
  users,
  products,
  initialTask,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: AssignableUser[]
  products: TaskProductOption[]
  initialTask?: EditableTask | null
  onSubmit: (payload: {
    title: string
    description: string
    priority: TaskPriority
    status: TaskStatus
    dueDate: string
    relatedProductId: string
    assignedToId: string
    progressNote: string
  }) => Promise<void>
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM")
  const [status, setStatus] = useState<TaskStatus>("TODO")
  const [dueDate, setDueDate] = useState("")
  const [relatedProductId, setRelatedProductId] = useState("")
  const [assignedToId, setAssignedToId] = useState("")
  const [progressNote, setProgressNote] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(initialTask?.title || "")
    setDescription(initialTask?.description || "")
    setPriority(initialTask?.priority || "MEDIUM")
    setStatus(initialTask?.status || "TODO")
    setDueDate(initialTask?.dueDate ? initialTask.dueDate.slice(0, 10) : "")
    setRelatedProductId(initialTask?.relatedProduct?.id || "")
    setAssignedToId(initialTask?.assignedToId || "")
    setProgressNote(initialTask?.progressNote || "")
  }, [initialTask, open])

  const selectedProduct = products.find((product) => product.id === relatedProductId) || null
  const selectedProductImages = selectedProduct ? parseProductImageRecords(selectedProduct.images) : []
  const selectedProductCandidates = selectedProduct ? getProductImageUrlCandidates(selectedProductImages[0], "thumb") : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#dce3ed] bg-white sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{initialTask ? "Edit Task" : "Create Task"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            setSaving(true)
            try {
              await onSubmit({ title, description, priority, status, dueDate, relatedProductId, assignedToId, progressNote })
              onOpenChange(false)
            } finally {
              setSaving(false)
            }
          }}
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Task</p>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title" required />
          </div>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" className="min-h-[120px]" />
          <div className="grid gap-4 sm:grid-cols-2">
            <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} className="h-10 rounded-md border border-[#dce3ed] px-3 text-sm">
              {TASK_PRIORITIES.map((item) => (
                <option key={item} value={item}>{item.replace("_", " ")}</option>
              ))}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)} className="h-10 rounded-md border border-[#dce3ed] px-3 text-sm">
              {TASK_STATUSES.map((item) => (
                <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Related product</p>
              <select value={relatedProductId} onChange={(event) => setRelatedProductId(event.target.value)} className="h-10 w-full rounded-md border border-[#dce3ed] px-3 text-sm">
                <option value="">No linked product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku ? `${product.sku} · ` : ""}{product.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-[#e5ebf3] bg-slate-50 p-3">
              {selectedProduct ? (
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#dce3ed] bg-white">
                    {selectedProductCandidates.length > 0 ? (
                      <StorefrontProductImage
                        candidates={selectedProductCandidates}
                        alt={buildProductImageAlt({ title: selectedProduct.title, fallbackAlt: selectedProductImages[0]?.alt })}
                        fill
                        sizes="56px"
                        className="object-cover object-center"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{selectedProduct.title}</p>
                    {selectedProduct.sku ? <p className="text-xs text-slate-500">{selectedProduct.sku}</p> : null}
                    <Link href={`/dashboard/products/${selectedProduct.id}`} className="text-xs font-medium text-slate-700 underline underline-offset-4">
                      Open product
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Link a product to anchor this task to real catalog work.</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            <select value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)} className="h-10 rounded-md border border-[#dce3ed] px-3 text-sm">
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {(user.name || user.email)} ({user.role})
                </option>
              ))}
            </select>
          </div>
          <Textarea value={progressNote} onChange={(event) => setProgressNote(event.target.value)} placeholder="Progress note" className="min-h-[90px]" />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : initialTask ? "Save changes" : "Create task"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
