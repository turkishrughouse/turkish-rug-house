import "server-only"

import { mkdir, rm } from "fs/promises"
import { join } from "path"

const CLEAN_INTERVAL_MS = 5 * 60 * 1000

declare global {
  var __rughouseCacheCleanerStarted: boolean | undefined
}

async function clearDirectory(path: string) {
  try {
    await rm(path, { recursive: true, force: true })
    await mkdir(path, { recursive: true })
  } catch (error) {
    console.error("[cache-cleaner] failed:", path, error)
  }
}

export async function runCacheCleanup() {
  const nextImageCache = join(process.cwd(), ".next", "cache", "images")
  const nextDataCache = join(process.cwd(), ".next", "cache", "fetch-cache")
  const appTempCache = join(process.cwd(), "public", "uploads", ".cache")

  await Promise.all([
    clearDirectory(nextImageCache),
    clearDirectory(nextDataCache),
    clearDirectory(appTempCache),
  ])
}

export function ensureCacheCleanerStarted() {
  if (typeof window !== "undefined") return
  if (globalThis.__rughouseCacheCleanerStarted) return

  globalThis.__rughouseCacheCleanerStarted = true

  void runCacheCleanup()
  setInterval(() => {
    void runCacheCleanup()
  }, CLEAN_INTERVAL_MS)
}
