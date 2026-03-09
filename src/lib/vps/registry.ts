import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import type { VpsSite } from "@/lib/vps/types"

const DATA_FILE = path.join(process.cwd(), "data", "vps-sites.json")

type RegistryShape = {
  sites: VpsSite[]
}

function nowIso() {
  return new Date().toISOString()
}

async function ensureRegistryFile() {
  const dir = path.dirname(DATA_FILE)
  await mkdir(dir, { recursive: true })
  try {
    await readFile(DATA_FILE, "utf8")
  } catch {
    const initial: RegistryShape = { sites: [] }
    await writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8")
  }
}

async function readRegistry(): Promise<RegistryShape> {
  await ensureRegistryFile()
  const raw = await readFile(DATA_FILE, "utf8")
  try {
    const parsed = JSON.parse(raw) as RegistryShape
    if (!Array.isArray(parsed.sites)) return { sites: [] }
    return { sites: parsed.sites }
  } catch {
    return { sites: [] }
  }
}

async function writeRegistry(value: RegistryShape) {
  await ensureRegistryFile()
  await writeFile(DATA_FILE, JSON.stringify(value, null, 2), "utf8")
}

export async function listVpsSites() {
  const registry = await readRegistry()
  return registry.sites.sort((a, b) => a.name.localeCompare(b.name))
}

export async function getVpsSite(id: string) {
  const registry = await readRegistry()
  return registry.sites.find((site) => site.id === id) || null
}

export async function createVpsSite(input: Omit<VpsSite, "id" | "createdAt" | "updatedAt">) {
  const registry = await readRegistry()
  const site: VpsSite = {
    id: randomUUID(),
    ...input,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  registry.sites.push(site)
  await writeRegistry(registry)
  return site
}

export async function updateVpsSite(id: string, patch: Partial<Omit<VpsSite, "id" | "createdAt">>) {
  const registry = await readRegistry()
  const index = registry.sites.findIndex((site) => site.id === id)
  if (index < 0) return null
  const next: VpsSite = {
    ...registry.sites[index],
    ...patch,
    updatedAt: nowIso(),
  }
  registry.sites[index] = next
  await writeRegistry(registry)
  return next
}

export async function deleteVpsSite(id: string) {
  const registry = await readRegistry()
  const sizeBefore = registry.sites.length
  registry.sites = registry.sites.filter((site) => site.id !== id)
  const deleted = registry.sites.length !== sizeBefore
  if (deleted) await writeRegistry(registry)
  return deleted
}
