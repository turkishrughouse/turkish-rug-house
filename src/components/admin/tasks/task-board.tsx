"use client"

import { useState } from "react"
import { DndContext, DragOverlay, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { CalendarClock, CirclePause, User2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getTaskPriorityLabel, getTaskStatusLabel, TASK_BOARD_COLUMNS, type TaskStatus } from "@/lib/tasks"
import type { TaskRecord } from "@/components/admin/tasks/task-board-types"

const COLUMN_META: Record<TaskStatus, { label: string; tone: string }> = {
  BACKLOG: { label: "Backlog", tone: "border-slate-200 bg-slate-50/70" },
  IN_PROGRESS: { label: "In Progress", tone: "border-sky-200 bg-sky-50/80" },
  PAUSED: { label: "Paused", tone: "border-amber-200 bg-amber-50/80" },
  COMPLETED: { label: "Completed", tone: "border-emerald-200 bg-emerald-50/80" },
}

function TaskCard({
  task,
  dragging = false,
  onOpen,
  onQuickAction,
}: {
  task: TaskRecord
  dragging?: boolean
  onOpen: (task: TaskRecord) => void
  onQuickAction: (task: TaskRecord, nextStatus: TaskStatus) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: {
      taskId: task.id,
      status: task.status,
      canDrag: task.permissions.canDrag,
    },
    disabled: !task.permissions.canDrag,
  })

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const quickActions = [
    task.permissions.canStart ? { label: "Start", status: "IN_PROGRESS" as TaskStatus } : null,
    task.permissions.canPause ? { label: "Pause", status: "PAUSED" as TaskStatus } : null,
    task.permissions.canResume ? { label: "Resume", status: "IN_PROGRESS" as TaskStatus } : null,
    task.permissions.canComplete ? { label: "Complete", status: "COMPLETED" as TaskStatus } : null,
  ].filter(Boolean) as Array<{ label: string; status: TaskStatus }>

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-2xl border border-white/70 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition",
        task.permissions.canDrag && "cursor-grab active:cursor-grabbing",
        (dragging || isDragging) && "opacity-70 shadow-[0_18px_40px_rgba(15,23,42,0.14)]",
      )}
    >
      <button type="button" onClick={() => onOpen(task)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">{task.title}</p>
            {task.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{task.description}</p> : null}
          </div>
          <span className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
            task.priority === "URGENT" && "bg-rose-100 text-rose-800",
            task.priority === "HIGH" && "bg-amber-100 text-amber-800",
            task.priority === "MEDIUM" && "bg-sky-100 text-sky-800",
            task.priority === "LOW" && "bg-slate-100 text-slate-700",
          )}>
            {getTaskPriorityLabel(task.priority)}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {task.relatedCategory ? (
            <div className="inline-flex max-w-full rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
              {task.relatedCategory.title}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1"><User2 className="h-3.5 w-3.5" />{task.assignedTo ? (task.assignedTo.name || task.assignedTo.email) : "Unassigned"}</span>
            {task.dueDate ? <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{new Date(task.dueDate).toLocaleDateString("en-US")}</span> : null}
            <span className="inline-flex items-center gap-1"><CirclePause className="h-3.5 w-3.5" />{getTaskStatusLabel(task.status)}</span>
          </div>
          {task.categoryContext ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              {task.categoryContext.uploadedProducts}/{task.categoryContext.totalProducts} uploaded
            </div>
          ) : null}
        </div>
      </button>
      {quickActions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => onQuickAction(task, action.status)}
              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function TaskColumn({
  status,
  tasks,
  onOpen,
  onQuickAction,
}: {
  status: TaskStatus
  tasks: TaskRecord[]
  onOpen: (task: TaskRecord) => void
  onQuickAction: (task: TaskRecord, nextStatus: TaskStatus) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status } })
  return (
    <section className={cn("min-h-[620px] rounded-[28px] border p-4", COLUMN_META[status].tone, isOver && "ring-2 ring-slate-900/10")}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">{COLUMN_META[status].label}</h3>
          <p className="mt-1 text-xs text-slate-500">{tasks.length} tasks</p>
        </div>
      </div>
      <div ref={setNodeRef} className="space-y-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onOpen={onOpen} onQuickAction={onQuickAction} />
        ))}
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-10 text-center text-sm text-slate-400">
            Drop tasks here
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function TaskBoard({
  tasks,
  onOpen,
  onStatusChange,
}: {
  tasks: TaskRecord[]
  onOpen: (task: TaskRecord) => void
  onStatusChange: (task: TaskRecord, nextStatus: TaskStatus) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const grouped = Object.fromEntries(TASK_BOARD_COLUMNS.map((status) => [status, tasks.filter((task) => task.status === status)])) as Record<TaskStatus, TaskRecord[]>
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const activeTask = tasks.find((task) => task.id === activeTaskId) || null

  const handleDragEnd = (event: DragEndEvent) => {
    const sourceTask = tasks.find((task) => task.id === event.active.id)
    const overStatus = event.over?.data.current?.status as TaskStatus | undefined || (typeof event.over?.id === "string" ? event.over.id as TaskStatus : undefined)
    setActiveTaskId(null)
    if (!sourceTask || !overStatus || sourceTask.status === overStatus) return
    onStatusChange(sourceTask, overStatus)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) => setActiveTaskId(String(event.active.id))}
      onDragCancel={() => setActiveTaskId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="grid gap-4 xl:grid-cols-4">
        {TASK_BOARD_COLUMNS.map((status) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={grouped[status]}
            onOpen={onOpen}
            onQuickAction={onStatusChange}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} dragging onOpen={onOpen} onQuickAction={onStatusChange} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
