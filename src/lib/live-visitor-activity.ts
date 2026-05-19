import { prisma } from "@/lib/db"

type LiveVisitorInput = {
  actorKey: string
  countryCode?: string | null
  customerName?: string | null
  path?: string | null
  action?: string
  userAgent?: string | null
  pageTitle?: string | null
  hoverLabel?: string | null
  hoverType?: string | null
  at?: Date
}

type LivePageVisit = {
  path: string
  count: number
  lastAt: string
  firstAt: string
  totalMs: number
  title?: string
  lastHoverLabel?: string
  lastHoverType?: string
}

type LiveVisitorRecord = {
  actorKey: string
  countryCode: string
  countryName: string
  customerName: string
  action: string
  lastAt: string
  browser: string
  device: string
  currentPath?: string
  currentPageTitle?: string
  lastHoverLabel?: string
  lastHoverType?: string
  pages: Map<string, LivePageVisit>
}

type LiveStore = {
  visitors: Map<string, LiveVisitorRecord>
}

type LiveEvent = {
  id: string
  actorKey: string
  orderNumber: string
  customerName: string
  countryCode: string
  countryName: string
  action: string
  currentPath?: string
  createdAt: string
}

type LiveVisitorDeviceEvent = {
  id: string
  actorKey: string
  customerName: string
  browser: string
  device: string
  countryName: string
  currentPath?: string
  createdAt: string
}

const UNKNOWN_COUNTRY = "Unknown"
const DEFAULT_ACTION = "Site visit"
const ACTIVE_WINDOW_MS = 60 * 60 * 1000   // 1 hour — long enough for abandoned-cart 30-min threshold
const DB_TTL_MS = 30 * 60 * 1000           // 30-min DB TTL for cold-start recovery

const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  TR: "Turkey",
  US: "United States",
  CA: "Canada",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  GB: "United Kingdom",
  AU: "Australia",
  JP: "Japan",
  CN: "China",
  IN: "India",
  BR: "Brazil",
  MX: "Mexico",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
}

type GlobalWithStore = typeof globalThis & {
  __rughouseLiveVisitorStore?: LiveStore
  __rughouseLiveVisitorHydration?: Promise<void>
}

function getStore(): LiveStore {
  const g = globalThis as GlobalWithStore
  if (!g.__rughouseLiveVisitorStore) {
    g.__rughouseLiveVisitorStore = { visitors: new Map<string, LiveVisitorRecord>() }
  }
  return g.__rughouseLiveVisitorStore
}

function normalizeCountryCode(value: string | null | undefined) {
  if (!value) return null
  const code = value.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return null
  return code
}

function normalizePath(path: string | null | undefined) {
  if (!path) return null
  const raw = path.trim()
  if (!raw || raw.toLowerCase() === "unknown") return null

  if (raw.startsWith("/")) {
    return raw.split(/[?#]/)[0] || null
  }

  try {
    const url = new URL(raw)
    return url.pathname || null
  } catch {
    return null
  }
}

function cleanupExpired(nowMs = Date.now(), activeWindowMs = ACTIVE_WINDOW_MS) {
  const store = getStore()
  const cutoff = nowMs - activeWindowMs
  for (const [actorKey, record] of store.visitors.entries()) {
    if (new Date(record.lastAt).getTime() < cutoff) {
      store.visitors.delete(actorKey)
    }
  }
}

function normalizeUserAgent(value: string | null | undefined) {
  if (!value) return ""
  return value.trim()
}

function detectBrowser(userAgent: string) {
  const ua = userAgent.toLowerCase()
  if (!ua) return "Other"
  if (ua.includes("samsungbrowser")) return "Samsung Internet"
  if (ua.includes("miuibrowser") || ua.includes("xiaomi")) return "MIUI"
  if (ua.includes("edg/")) return "Edge"
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera"
  if (ua.includes("firefox/")) return "Firefox"
  if (ua.includes("chrome/") && !ua.includes("edg/") && !ua.includes("opr/")) return "Chrome"
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari"
  return "Other"
}

function detectDevice(userAgent: string) {
  const ua = userAgent.toLowerCase()
  if (!ua) return "Other"
  if (ua.includes("iphone")) return "iPhone"
  if (ua.includes("ipad")) return "iPad"
  if (ua.includes("macintosh") || ua.includes("mac os x")) return "Mac"
  if (ua.includes("sm-") || ua.includes("samsung")) return "Samsung"
  if (ua.includes("miui") || ua.includes("redmi") || ua.includes("xiaomi")) return "MIUI"
  if (ua.includes("android")) return "Android"
  if (ua.includes("windows")) return "Windows"
  return "Other"
}

async function hydrateFromDb(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - DB_TTL_MS)
    const rows = await prisma.liveVisitorRecord.findMany({
      where: { updatedAt: { gte: cutoff } },
    })
    const store = getStore()
    for (const row of rows) {
      if (store.visitors.has(row.actorKey)) continue
      store.visitors.set(row.actorKey, {
        actorKey: row.actorKey,
        countryCode: row.countryCode,
        countryName: row.countryName,
        customerName: row.customerName,
        action: row.action,
        lastAt: row.updatedAt.toISOString(),
        browser: row.browser,
        device: row.device,
        currentPath: row.currentPath ?? undefined,
        currentPageTitle: undefined,
        lastHoverLabel: undefined,
        lastHoverType: undefined,
        pages: new Map(),
      })
    }
  } catch {
    // DB errors must not break the in-memory store
  }
}

function ensureHydrated(): Promise<void> {
  const g = globalThis as GlobalWithStore
  if (!g.__rughouseLiveVisitorHydration) {
    g.__rughouseLiveVisitorHydration = hydrateFromDb()
  }
  return g.__rughouseLiveVisitorHydration
}

function persistToDb(record: LiveVisitorRecord): void {
  const cutoff = new Date(Date.now() - DB_TTL_MS)
  void Promise.all([
    prisma.liveVisitorRecord.upsert({
      where: { actorKey: record.actorKey },
      update: {
        countryCode: record.countryCode,
        countryName: record.countryName,
        customerName: record.customerName,
        action: record.action,
        browser: record.browser,
        device: record.device,
        currentPath: record.currentPath ?? null,
      },
      create: {
        actorKey: record.actorKey,
        countryCode: record.countryCode,
        countryName: record.countryName,
        customerName: record.customerName,
        action: record.action,
        browser: record.browser,
        device: record.device,
        currentPath: record.currentPath ?? null,
      },
    }),
    prisma.liveVisitorRecord.deleteMany({ where: { updatedAt: { lt: cutoff } } }),
  ]).catch(() => {})
}

const isCartAction = (a: string) => a.toLowerCase().startsWith("added to cart")

export function trackLiveVisitorActivity(input: LiveVisitorInput) {
  if (!input.actorKey) return
  const now = input.at || new Date()
  const countryCode = normalizeCountryCode(input.countryCode)
  const path = normalizePath(input.path)
  const userAgent = normalizeUserAgent(input.userAgent)
  const store = getStore()
  cleanupExpired(now.getTime())

  const existing = store.visitors.get(input.actorKey)
  const resolvedCountryCode = countryCode || existing?.countryCode || "ZZ"
  const countryName = COUNTRY_CODE_TO_NAME[resolvedCountryCode] || UNKNOWN_COUNTRY

  const record: LiveVisitorRecord =
    existing ||
    {
      actorKey: input.actorKey,
      countryCode: resolvedCountryCode,
      countryName,
      customerName: input.customerName?.trim() || "Guest",
      action: input.action || DEFAULT_ACTION,
      lastAt: now.toISOString(),
      browser: detectBrowser(userAgent),
      device: detectDevice(userAgent),
      currentPath: undefined,
      currentPageTitle: undefined,
      lastHoverLabel: undefined,
      lastHoverType: undefined,
      pages: new Map<string, LivePageVisit>(),
    }

  record.countryCode = resolvedCountryCode
  record.countryName = countryName
  if (input.customerName?.trim()) record.customerName = input.customerName.trim()

  // Preserve "Added to cart" action — only a new cart action or a non-cart current action allows overwrite
  const newAction = input.action?.trim()
  if (newAction && (isCartAction(newAction) || !isCartAction(record.action))) {
    record.action = newAction
  }

  if (userAgent) {
    record.browser = detectBrowser(userAgent)
    record.device = detectDevice(userAgent)
  }

  const nowIso = now.toISOString()
  const previousAtMs = existing ? new Date(existing.lastAt).getTime() : null
  const elapsedMs =
    previousAtMs && now.getTime() > previousAtMs
      ? Math.min(now.getTime() - previousAtMs, 30_000)
      : 0

  if (elapsedMs > 0 && record.currentPath) {
    const previousPage = record.pages.get(record.currentPath)
    if (previousPage) {
      previousPage.totalMs += elapsedMs
      previousPage.lastAt = nowIso
    }
  }

  record.lastAt = now.toISOString()
  if (input.pageTitle?.trim()) record.currentPageTitle = input.pageTitle.trim()
  if (input.hoverLabel?.trim()) record.lastHoverLabel = input.hoverLabel.trim()
  if (input.hoverType?.trim()) record.lastHoverType = input.hoverType.trim()

  if (path) {
    record.currentPath = path
    const page = record.pages.get(path)
    if (!page) {
      record.pages.set(path, {
        path,
        count: 1,
        firstAt: nowIso,
        lastAt: nowIso,
        totalMs: 0,
        title: input.pageTitle?.trim() || undefined,
        lastHoverLabel: input.hoverLabel?.trim() || undefined,
        lastHoverType: input.hoverType?.trim() || undefined,
      })
    } else {
      page.count += 1
      page.lastAt = nowIso
      if (input.pageTitle?.trim()) page.title = input.pageTitle.trim()
      if (input.hoverLabel?.trim()) page.lastHoverLabel = input.hoverLabel.trim()
      if (input.hoverType?.trim()) page.lastHoverType = input.hoverType.trim()
    }
  }

  store.visitors.set(input.actorKey, record)
  persistToDb(record)
}

export async function getLiveVisitorDeviceEvents(windowMs = ACTIVE_WINDOW_MS, limit = 120): Promise<LiveVisitorDeviceEvent[]> {
  await ensureHydrated()
  cleanupExpired(Date.now(), windowMs)
  const now = Date.now()
  const store = getStore()

  return Array.from(store.visitors.values())
    .filter((record) => now - new Date(record.lastAt).getTime() <= windowMs)
    .map((record) => {
      const latestPage = Array.from(record.pages.values()).sort(
        (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
      )[0]
      return {
        id: `live-device-${record.actorKey}-${new Date(record.lastAt).getTime()}`,
        actorKey: record.actorKey,
        customerName: record.customerName,
        browser: record.browser || "Other",
        device: record.device || "Other",
        countryName: record.countryName || UNKNOWN_COUNTRY,
        currentPath: latestPage?.path ?? record.currentPath,
        createdAt: record.lastAt,
      }
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

export async function getLiveVisitorEvents(windowMs = ACTIVE_WINDOW_MS, limit = 120): Promise<LiveEvent[]> {
  await ensureHydrated()
  cleanupExpired(Date.now(), windowMs)
  const now = Date.now()
  const store = getStore()

  return Array.from(store.visitors.values())
    .filter((record) => now - new Date(record.lastAt).getTime() <= windowMs)
    .map((record) => {
      const latestPage = Array.from(record.pages.values()).sort(
        (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
      )[0]
      return {
        id: `live-${record.actorKey}-${new Date(record.lastAt).getTime()}`,
        actorKey: record.actorKey,
        orderNumber: "LIVE",
        customerName: record.customerName,
        countryCode: record.countryCode,
        countryName: record.countryName,
        action: record.action || DEFAULT_ACTION,
        currentPath: latestPage?.path ?? record.currentPath,
        createdAt: record.lastAt,
      }
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

export function getLiveVisitorDetail(actorKey: string) {
  cleanupExpired()
  const record = getStore().visitors.get(actorKey)
  if (!record) return null
  return {
    actorKey: record.actorKey,
    customerName: record.customerName,
    country: record.countryCode,
    action: record.action || DEFAULT_ACTION,
    currentPath: record.currentPath,
    currentPageTitle: record.currentPageTitle,
    lastHoverLabel: record.lastHoverLabel,
    lastHoverType: record.lastHoverType,
    lastActiveAt: record.lastAt,
    pages: Array.from(record.pages.values()).sort(
      (a, b) => b.totalMs - a.totalMs || new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    ),
  }
}
