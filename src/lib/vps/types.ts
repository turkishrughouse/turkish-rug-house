export type VpsSite = {
  id: string
  name: string
  domain: string
  rootPath: string
  uploadsPath: string
  dbPath?: string
  processName?: string
  sslEnabled: boolean
  stagingBranch: string
  liveBranch: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export type VpsActionName =
  | "enable_ssl"
  | "delete_site"
  | "backup_site"
  | "optimize_media"
  | "deploy_staging"
  | "promote_live"
  | "scan_media"

export type VpsActionResult = {
  ok: boolean
  action: VpsActionName
  message: string
  output?: string
}
