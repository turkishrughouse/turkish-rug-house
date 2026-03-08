import { requireAdminRoles } from "@/lib/admin-guard"

export default async function DesignLayout({ children }: { children: React.ReactNode }) {
  await requireAdminRoles(["SUPER_USER"])
  return children
}
