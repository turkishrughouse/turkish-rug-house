import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth-server"
import { requireAdminSection } from "@/lib/admin-guard"
import LegacySuperuserDashboard from "@/components/admin/dashboard/legacy-superuser-dashboard"
import { RoleBasedDashboard } from "@/components/admin/dashboard/role-based-dashboard"
import { getRoleDashboardData } from "@/lib/admin-role-dashboard"
import { TasksDashboardCard } from "@/components/admin/tasks/task-dashboard-card"
import { getTaskDashboardSummary, getTasksForViewer } from "@/lib/actions/task-actions"

export default async function DashboardPage() {
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
    return (
      <>
        <LegacySuperuserDashboard />
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
