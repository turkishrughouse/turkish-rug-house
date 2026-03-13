import { readdir, rm, stat } from "fs/promises"
import path from "path"
import { parseProductImageRecords } from "@/lib/product-images"
import { getStorageProvider } from "@/lib/storage/provider"
import { getPersistentUploadsRoot, resolveUploadAbsolutePath } from "@/lib/upload-paths"

type ProductLike = {
  id: string
  images: unknown
}

async function listRecursive(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listRecursive(full)))
    } else {
      files.push(full)
    }
  }
  return files
}

export async function folderContainsFiles(folder: string) {
  const absolute = resolveUploadAbsolutePath(folder)
  const info = await stat(absolute).catch(() => null)
  if (!info?.isDirectory()) return false
  const files = await listRecursive(absolute)
  return files.length > 0
}

export async function deleteManagedUploadsForProducts(products: ProductLike[], reason: string) {
  const storage = getStorageProvider()
  const uploadRoot = getPersistentUploadsRoot()

  for (const product of products) {
    const records = parseProductImageRecords(product.images)
    for (const record of records) {
      const candidates = [
        record.image_url,
        record.variants?.thumb,
        record.variants?.large,
        record.variants?.master,
      ].filter(Boolean) as string[]

      for (const candidate of candidates) {
        const relative = storage.toRelativePath(candidate)
        if (!relative) continue
        const absolute = resolveUploadAbsolutePath(relative)
        if (!absolute.startsWith(uploadRoot)) continue
        await rm(absolute, { force: true }).catch(() => {})
        console.log(`MEDIA DELETE: ${absolute}`, { reason, productId: product.id })
      }
    }
  }
}
