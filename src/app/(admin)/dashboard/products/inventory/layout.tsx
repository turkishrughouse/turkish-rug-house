import { requireAdminSection } from "@/lib/admin-guard"

export default async function ProductInventoryLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSection("inventory")
  return children
}
