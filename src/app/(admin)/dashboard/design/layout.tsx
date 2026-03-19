import { requireAdminSection } from "@/lib/admin-guard"

export default async function DesignLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSection("design")
  return children
}
