import { requireAdminSection } from "@/lib/admin-guard"

export default async function ProductIntegrationLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSection("inventory")
  return children
}
