import { requireAdminSection } from "@/lib/admin-guard"

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSection("analytics")
  return children
}
