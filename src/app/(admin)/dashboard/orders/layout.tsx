import { requireAdminRoles } from "@/lib/admin-guard"

export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  await requireAdminRoles(["SUPER_USER", "ADMIN"])
  return children
}
