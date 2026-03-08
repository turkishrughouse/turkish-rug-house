import { requireAdminRoles } from "@/lib/admin-guard"

export default async function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  await requireAdminRoles(["SUPER_USER"])
  return children
}
