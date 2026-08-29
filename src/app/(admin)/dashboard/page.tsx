import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth-server"
import { requireAdminSection } from "@/lib/admin-guard"
import { CommerceDashboard } from "@/components/admin/dashboard/commerce-dashboard"
import { RoleBasedDashboard } from "@/components/admin/dashboard/role-based-dashboard"
import { getRoleDashboardData } from "@/lib/admin-role-dashboard"
import { getDashboardSnapshot, resolveDashboardRangeKey } from "@/lib/admin/dashboard-metrics"
import { TasksDashboardCard } from "@/components/admin/tasks/task-dashboard-card"
import { getTaskDashboardSummary, getTasksForViewer } from "@/lib/actions/task-actions"

type DashboardPageProps = {
  searchParams?: Promise<{ range?: string | string[] }>
}

// Metrics are read live on every request; caching them would show stale revenue.
export const dynamic = "force-dynamic"

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireAdminSection("dashboard")
  const user = await getSessionUser("admin")
  if (!user) {
    redirect("/rughouse/login")
  }
  const [taskSummary, taskItems] = await Promise.all([
    getTaskDashboardSummary(user),
    getTasksForViewer(user, { limit: 6, scope: user.role === "SUPER_USER" ? "all" : "open" }),
  ])
  const tasksCard = (
    <div className="bg-[#f6f8fb]">
      <div className="mx-auto w-full max-w-7xl px-6 pt-8">
        <TasksDashboardCard currentUser={user} initialSummary={taskSummary} initialTasks={taskItems} />
      </div>
    </div>
  )
  if (user.role === "SUPER_USER") {
    const params = (await searchParams) ?? {}
    const rawRange = Array.isArray(params.range) ? params.range[0] : params.range
    const snapshot = await getDashboardSnapshot(resolveDashboardRangeKey(rawRange))
    return (
      <>
        <CommerceDashboard snapshot={snapshot} />
        {tasksCard}
      </>
    )
  }
  const dashboardData = await getRoleDashboardData({
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: user.role,
  })
  return (
    <>
      <RoleBasedDashboard data={dashboardData} lang="en" />
      {tasksCard}
    </>
  )
}
