"use client"

import Link from "next/link"
import { Activity, CheckCircle2, PauseCircle, TimerReset, TriangleAlert, UserMinus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type TaskSummary = {
  backlog: number
  inProgress: number
  paused: number
  completedToday: number
  unassigned: number
  highPriority: number
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
  relatedProducts?: Array<{ id: string; title: string; slug: string; sku: string | null; images: string }>
}

export function TasksDashboardCard({
  currentUser,
  initialSummary,
  initialTasks,
}: {
  currentUser: { id: string; role: string }
  initialSummary: TaskSummary
  initialTasks: TaskRecord[]
}) {
  const summary = initialSummary
  const tasks = initialTasks

  const items = [
    { label: "Backlog", value: summary.backlog, icon: TimerReset, tone: "border-slate-200 bg-slate-50" },
    { label: "In Progress", value: summary.inProgress, icon: Activity, tone: "border-sky-200 bg-sky-50" },
    { label: "Paused", value: summary.paused, icon: PauseCircle, tone: "border-amber-200 bg-amber-50" },
    { label: "Completed Today", value: summary.completedToday, icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50" },
    { label: "Unassigned", value: summary.unassigned, icon: UserMinus, tone: "border-violet-200 bg-violet-50" },
    { label: "High Priority", value: summary.highPriority, icon: TriangleAlert, tone: "border-rose-200 bg-rose-50" },
  ]

  return (
    <Card className="rounded-[28px] border border-[#dce3ed] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-slate-950">Tasks</CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              {currentUser.role === "SUPER_USER" ? "Run upload operations across the team." : "Track and move your assigned upload workflow."}
            </p>
          </div>
          <Link href="/dashboard/tasks" className="inline-flex h-10 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800">
            Open Board
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className={`rounded-2xl border px-4 py-4 ${item.tone}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  <Icon className="h-4 w-4 text-slate-500" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{item.value}</p>
              </div>
            )
          })}
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-950">{task.title}</p>
              {task.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{task.description}</p> : null}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{task.assignedTo ? (task.assignedTo.name || task.assignedTo.email) : "Unassigned"}</span>
                <span>{task.status}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
