import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises"
import path from "path"
import { execFile } from "child_process"
import { promisify } from "util"
import { processUploadImage } from "@/lib/storage/image-pipeline"
import type { VpsActionName, VpsActionResult, VpsSite } from "@/lib/vps/types"

const execFileAsync = promisify(execFile)
const SCRIPT_DIR = path.join(process.cwd(), "scripts", "vps-control")

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "")
}

async function runScript(scriptName: string, site: VpsSite, extraArgs: string[] = []) {
  const scriptPath = path.join(SCRIPT_DIR, scriptName)
  const args = [
    site.id,
    site.domain,
    site.rootPath,
    site.uploadsPath,
    site.dbPath || "",
    site.processName || "",
    site.stagingBranch,
    site.liveBranch,
    ...extraArgs,
  ]
  const { stdout, stderr } = await execFileAsync("bash", [scriptPath, ...args], {
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  })
  return [stdout, stderr].filter(Boolean).join("\n").trim()
}

async function collectImages(root: string, relative = ""): Promise<string[]> {
  const current = path.join(root, relative)
  const entries = await readdir(current, { withFileTypes: true }).catch(() => [])
  const files: string[] = []
  for (const entry of entries) {
    const child = relative ? `${relative}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...(await collectImages(root, child)))
      continue
    }
    if (!entry.isFile()) continue
    const lower = entry.name.toLowerCase()
    if (!(/\.(jpg|jpeg|png|webp|avif)$/).test(lower)) continue
    files.push(child)
  }
  return files
}

export async function optimizeSiteMedia(site: VpsSite) {
  const uploadsRoot = site.uploadsPath
  const sourceFiles = await collectImages(uploadsRoot)
  const optimizedRoot = path.join(uploadsRoot, "_optimized")
  await mkdir(optimizedRoot, { recursive: true })

  let optimized = 0
  for (const rel of sourceFiles) {
    const absolute = path.join(uploadsRoot, rel)
    const data = await readFile(absolute)
    const processed = await processUploadImage(data, process.env.UPLOAD_ENABLE_AVIF === "true")
    const base = path.basename(rel, path.extname(rel)).replace(/[^a-zA-Z0-9_-]/g, "_")
    for (const variant of processed.variants) {
      const destName = `${base}-${variant.variant}.${variant.ext}`
      const destPath = path.join(optimizedRoot, destName)
      await writeFile(destPath, variant.buffer)
    }
    optimized += 1
  }

  return {
    scanned: sourceFiles.length,
    optimized,
    outputFolder: optimizedRoot,
  }
}

export async function processUploadedImageForSite(site: VpsSite, fileName: string, payload: Buffer, folder = "manual") {
  const processed = await processUploadImage(payload, process.env.UPLOAD_ENABLE_AVIF === "true")
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "") || "manual"
  const targetRoot = path.join(site.uploadsPath, safeFolder)
  await mkdir(targetRoot, { recursive: true })

  const base = `${Date.now()}-${safeId(path.basename(fileName, path.extname(fileName)) || "image")}`
  const written: Array<{ variant: string; path: string; width?: number; height?: number }> = []

  for (const variant of processed.variants) {
    const outName = `${base}-${variant.variant}.${variant.ext}`
    const outPath = path.join(targetRoot, outName)
    await writeFile(outPath, variant.buffer)
    written.push({
      variant: variant.variant,
      path: outPath,
      width: variant.width,
      height: variant.height,
    })
  }

  const primary = written.find((item) => item.variant === "master") || written[0]
  return {
    width: processed.width,
    height: processed.height,
    checksum: processed.checksum,
    saved: written,
    primary,
  }
}

export async function runVpsAction(site: VpsSite, action: VpsActionName): Promise<VpsActionResult> {
  if (action === "scan_media" || action === "optimize_media") {
    const media = await optimizeSiteMedia(site)
    return {
      ok: true,
      action,
      message: `Scanned ${media.scanned}, optimized ${media.optimized}.`,
      output: media.outputFolder,
    }
  }

  const map: Record<Exclude<VpsActionName, "scan_media" | "optimize_media">, string> = {
    enable_ssl: "enable-ssl.sh",
    delete_site: "delete-site.sh",
    backup_site: "backup-site.sh",
    deploy_staging: "deploy-staging.sh",
    promote_live: "promote-live.sh",
  }

  try {
    const output = await runScript(map[action], site)
    return {
      ok: true,
      action,
      message: `${action} completed`,
      output,
    }
  } catch (error) {
    return {
      ok: false,
      action,
      message: error instanceof Error ? error.message : "Action failed",
    }
  }
}

export async function assertSitePaths(site: VpsSite) {
  const checks = await Promise.all([
    stat(site.rootPath).then(() => true).catch(() => false),
    stat(site.uploadsPath).then(() => true).catch(() => false),
    site.dbPath ? stat(site.dbPath).then(() => true).catch(() => false) : Promise.resolve(true),
  ])
  return {
    rootExists: checks[0],
    uploadsExists: checks[1],
    dbExists: checks[2],
  }
}
