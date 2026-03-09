import { VpsControlPanel } from "@/components/admin/vps/vps-control-panel"
import { listVpsSites } from "@/lib/vps/registry"

export const dynamic = "force-dynamic"

export default async function VpsControlPage() {
  const sites = await listVpsSites()
  return <VpsControlPanel initialSites={sites} />
}
