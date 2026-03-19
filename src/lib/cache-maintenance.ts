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
    const code = typeof error === "object" && error && "code" in error ? (error as { code?: unknown }).code : undefined
    // Next may still be writing into these directories; avoid noisy logs for known races.
    if (code === "ENOTEMPTY" || code === "EBUSY") return
    if (process.env.NODE_ENV !== "production") {
      console.error("[cache-cleaner] failed:", path, error)
    }
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
  // Never run automatically in production builds; enable explicitly when debugging.
  if (process.env.NODE_ENV === "production" && process.env.RUGHOUSE_CACHE_CLEANER !== "1") return
  if (globalThis.__rughouseCacheCleanerStarted) return

  globalThis.__rughouseCacheCleanerStarted = true

  void runCacheCleanup()
  setInterval(() => {
    void runCacheCleanup()
  }, CLEAN_INTERVAL_MS)
}
