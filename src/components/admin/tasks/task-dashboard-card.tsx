"use client"

import { useState } from "react"
import { CheckCircle2, Clock3, ListTodo, TriangleAlert } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TaskDashboardModal } from "@/components/admin/tasks/task-dashboard-modal"

type TaskSummary = {
  open: number
  overdue: number
  dueToday: number
  completed: number
  unassigned: number
  urgent: number
}

type TaskRecord = {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  dueDate: string | null
  assignedToId: string | null
  progressNote: string | null
  assignedTo: { id: string; name: string | null; email: string } | null
  relatedProduct: { id: string; title: string; slug: string; sku: string | null; images: string } | null
}

type AssignableUser = {
  id: string
  name: string | null
  email: string
  role: string
}

type TaskProductOption = {
  id: string
  title: string
  slug: string
  sku: string | null
  images: string
}

export function TasksDashboardCard({
  currentUser,
  initialSummary,
  initialTasks,
  users,
  products,
}: {
  currentUser: { id: string; role: string }
  initialSummary: TaskSummary
  initialTasks: TaskRecord[]
  users: AssignableUser[]
  products: TaskProductOption[]
}) {
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState(initialSummary)
  const [tasks, setTasks] = useState(initialTasks)

  const refresh = async () => {
    const params = new URLSearchParams()
    params.set("limit", "6")
    if (currentUser.role !== "SUPER_USER") params.set("scope", "open")
    const res = await fetch(`/api/admin/tasks?${params.toString()}`, { cache: "no-store" })
    const json = await res.json()
    setSummary(json.summary)
    setTasks(json.tasks)
  }

  const items = currentUser.role === "SUPER_USER"
    ? [
        { label: "Open", value: summary.open, icon: ListTodo },
        { label: "Overdue", value: summary.overdue, icon: TriangleAlert },
        { label: "Urgent", value: summary.urgent, icon: CheckCircle2 },
        { label: "Unassigned", value: summary.unassigned, icon: Clock3 },
      ]
    : [
        { label: "Open tasks", value: summary.open, icon: ListTodo },
        { label: "Overdue tasks", value: summary.overdue, icon: TriangleAlert, tone: "alert" },
        { label: "Due today", value: summary.dueToday, icon: Clock3 },
      ]

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="w-full text-left">
        <Card className="rounded-[28px] border border-[#dce3ed] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)] transition-transform duration-200 hover:-translate-y-0.5">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-semibold text-slate-950">Tasks</CardTitle>
            <p className="text-sm text-slate-500">
              {currentUser.role === "SUPER_USER" ? "Create, assign and manage all tasks." : "Track and update your assigned tasks."}
            </p>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-3 ${currentUser.role === "SUPER_USER" ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className={`rounded-2xl border px-4 py-4 ${item.label.includes("Overdue") ? "border-rose-200 bg-rose-50" : item.label === "Urgent" ? "border-amber-200 bg-amber-50" : "border-[#e5ebf3] bg-slate-50"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${item.label.includes("Overdue") ? "text-rose-700" : item.label === "Urgent" ? "text-amber-700" : "text-slate-600"}`}>{item.label}</span>
                      <Icon className={`h-4 w-4 ${item.label.includes("Overdue") ? "text-rose-600" : item.label === "Urgent" ? "text-amber-600" : "text-slate-500"}`} />
                    </div>
                    <p className={`mt-3 text-3xl font-semibold ${item.label.includes("Overdue") ? "text-rose-700" : item.label === "Urgent" ? "text-amber-700" : "text-slate-950"}`}>{item.value}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </button>

      <TaskDashboardModal
        open={open}
        onOpenChange={setOpen}
        currentUser={currentUser}
        tasks={tasks}
        users={users}
        products={products}
        onRefresh={refresh}
      />
    </>
  )
}
