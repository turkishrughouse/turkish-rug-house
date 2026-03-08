import { getEnv } from "@/lib/env"
import { LocalStorageProvider } from "@/lib/storage/local-provider"
import type { StorageProvider } from "@/lib/storage/types"

let provider: StorageProvider | null = null

export function getStorageProvider(): StorageProvider {
  if (provider) return provider
  const env = getEnv()
  switch (env.STORAGE_PROVIDER) {
    case "local":
    default:
      provider = new LocalStorageProvider()
      return provider
  }
}

