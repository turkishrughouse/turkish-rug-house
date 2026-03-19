import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"
import { isAdminRole } from "@/lib/rbac"
import { getLiveVisitorDetail } from "@/lib/live-visitor-activity"

type VisitSource = "Checkout" | "Order activity" | "Customer login" | "Contact message" | "Live visit"

function parseMetadata(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function normalizePath(input: string): string | null {
  const value = input.trim()
  if (!value || value.toLowerCase() === "unknown") return null

  if (value.startsWith("/")) {
    const [pathOnly] = value.split(/[?#]/)
    return pathOnly || null
  }

  try {
    const url = new URL(value)
    return url.pathname || null
  } catch {
    return null
  }
}

function asIso(date: Date | null | undefined) {
  return date ? date.toISOString() : null
}

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser("admin")
    if (!sessionUser || !isAdminRole(sessionUser.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const actorKey = req.nextUrl.searchParams.get("actorKey")?.trim() || ""
    if (!actorKey) {
      return NextResponse.json({ error: "actorKey is required" }, { status: 400 })
    }
    const liveDetail = getLiveVisitorDetail(actorKey)

    const actorEmail = actorKey.includes("@") ? actorKey.toLowerCase() : null

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: actorKey }, ...(actorEmail ? [{ email: actorEmail }] : [])],
      },
      select: {
        id: true,
        name: true,
        email: true,
        lastLoginAt: true,
        customerProfile: {
          select: {
            country: true,
          },
        },
      },
    })

    const userId = user?.id || null
    const email = user?.email?.toLowerCase() || actorEmail

    if (!userId && !email) {
      if (liveDetail) {
        const longestPage = [...liveDetail.pages].sort((a, b) => b.totalMs - a.totalMs)[0] || null
        return NextResponse.json({
          customer: {
            actorKey,
            userId: null,
            name: liveDetail.customerName || "Guest",
            email: null,
            country: liveDetail.country || null,
            lastActiveAt: liveDetail.lastActiveAt,
            currentPath: liveDetail.currentPath || null,
            currentPageTitle: liveDetail.currentPageTitle || null,
            lastAction: liveDetail.action || null,
            lastHoverLabel: liveDetail.lastHoverLabel || null,
            lastHoverType: liveDetail.lastHoverType || null,
            longestStayPath: longestPage?.path || null,
            longestStayTitle: longestPage?.title || null,
            longestStayMs: Number(longestPage?.totalMs || 0),
          },
          pages: liveDetail.pages.map((page) => ({
            path: page.path,
            source: "Live visit",
            count: page.count,
            lastAt: page.lastAt,
            totalMs: page.totalMs,
            title: page.title || null,
            lastHoverLabel: page.lastHoverLabel || null,
            lastHoverType: page.lastHoverType || null,
          })),
        })
      }
      return NextResponse.json({
        customer: {
          actorKey,
          userId: null,
          name: "Customer",
          email: null,
          country: null,
          lastActiveAt: null,
          currentPath: null,
          currentPageTitle: null,
          lastAction: null,
          lastHoverLabel: null,
          lastHoverType: null,
          longestStayPath: null,
          longestStayTitle: null,
          longestStayMs: 0,
        },
        pages: [],
      })
    }

    const [orders, messages] = await Promise.all([
      prisma.order.findMany({
        where: {
          OR: [
            ...(userId ? [{ userId }] : []),
            ...(email ? [{ customerEmail: email }] : []),
          ],
        },
        select: {
          createdAt: true,
          updatedAt: true,
          status: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
      email
        ? prisma.message.findMany({
            where: {
              email,
              deletedAt: null,
            },
            select: {
              source: true,
              metadata: true,
              receivedAt: true,
            },
            orderBy: { receivedAt: "desc" },
            take: 200,
          })
        : Promise.resolve([]),
    ])

    const pagesMap = new Map<string, { path: string; source: VisitSource; count: number; lastAt: string }>()

    const addPageVisit = (path: string | null, source: VisitSource, when: Date | null | undefined) => {
      if (!path || !when) return
      const key = `${path}::${source}`
      const lastAt = when.toISOString()
      const existing = pagesMap.get(key)
      if (!existing) {
        pagesMap.set(key, { path, source, count: 1, lastAt })
        return
      }
      existing.count += 1
      if (new Date(existing.lastAt).getTime() < when.getTime()) {
        existing.lastAt = lastAt
      }
    }

    for (const order of orders) {
      addPageVisit("/checkout", "Checkout", order.createdAt)
      addPageVisit("/account/orders", "Order activity", order.updatedAt)
    }

    for (const message of messages) {
      const meta = parseMetadata(message.metadata)
      const candidates = [
        meta.pageUrl,
        meta.referer,
        meta.referrer,
        meta.page,
        meta.path,
        meta.pathname,
        meta.url,
      ]
      let used = false
      for (const candidate of candidates) {
        if (typeof candidate !== "string") continue
        const normalized = normalizePath(candidate)
        if (!normalized) continue
        addPageVisit(normalized, "Contact message", message.receivedAt)
        used = true
      }
      if (!used && message.source === "CONTACT") {
        addPageVisit("/contact", "Contact message", message.receivedAt)
      }
    }

    addPageVisit("/account", "Customer login", user?.lastLoginAt)
    if (liveDetail) {
      for (const page of liveDetail.pages) {
        addPageVisit(page.path, "Live visit", new Date(page.lastAt))
      }
    }

    const pages = Array.from(pagesMap.values()).sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    )

    const lastActiveDate = [
      liveDetail?.lastActiveAt ? new Date(liveDetail.lastActiveAt) : null,
      user?.lastLoginAt || null,
      orders[0]?.updatedAt || null,
      messages[0]?.receivedAt || null,
    ]
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => b.getTime() - a.getTime())[0] || null

    const longestPage = [...(liveDetail?.pages || [])].sort((a, b) => b.totalMs - a.totalMs)[0] || null

    return NextResponse.json({
      customer: {
        actorKey,
        userId,
        name: user?.name?.trim() || liveDetail?.customerName || email?.split("@")[0] || "Customer",
        email: email || null,
        country: user?.customerProfile?.country || liveDetail?.country || null,
        lastActiveAt: asIso(lastActiveDate),
        currentPath: liveDetail?.currentPath || null,
        currentPageTitle: liveDetail?.currentPageTitle || null,
        lastAction: liveDetail?.action || null,
        lastHoverLabel: liveDetail?.lastHoverLabel || null,
        lastHoverType: liveDetail?.lastHoverType || null,
        longestStayPath: longestPage?.path || null,
        longestStayTitle: longestPage?.title || null,
        longestStayMs: Number(longestPage?.totalMs || 0),
      },
      pages: pages.map((page) => {
        const livePage = liveDetail?.pages.find((item) => item.path === page.path)
        return {
          ...page,
          totalMs: Number(livePage?.totalMs || 0),
          title: livePage?.title || null,
          lastHoverLabel: livePage?.lastHoverLabel || null,
          lastHoverType: livePage?.lastHoverType || null,
        }
      }),
    })
  } catch (error) {
    console.error("Customer activity detail error:", error)
    return NextResponse.json({ error: "Failed to fetch customer detail" }, { status: 500 })
  }
}
