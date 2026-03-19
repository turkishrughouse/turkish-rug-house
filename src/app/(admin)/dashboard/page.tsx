import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth-server"
import { requireAdminSection } from "@/lib/admin-guard"
import LegacySuperuserDashboard from "@/components/admin/dashboard/legacy-superuser-dashboard"
import { RoleBasedDashboard } from "@/components/admin/dashboard/role-based-dashboard"
import { getRoleDashboardData } from "@/lib/admin-role-dashboard"

export default async function DashboardPage() {
  await requireAdminSection("dashboard")
  const user = await getSessionUser("admin")
  if (!user) {
    redirect("/rughouse/login")
  }
  if (user.role === "SUPER_USER") {
    return <LegacySuperuserDashboard />
  }
  const dashboardData = await getRoleDashboardData({
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: user.role,
  })
  return <RoleBasedDashboard data={dashboardData} lang="en" />
}
