import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"
import { reconcileReviewAccessForUser } from "@/lib/review-access"

const PURCHASE_REQUIRED_MESSAGE = "You should buy a product to write a review"

function normalizeEmail(input: string) {
  return String(input || "").trim().toLowerCase()
}

export async function GET() {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const email = normalizeEmail(user.email)

  const [orders, profile] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { notIn: ["CANCELLED", "REFUNDED"] },
        OR: [{ userId: user.id }, { customerEmail: { equals: email } }],
      },
      orderBy: { createdAt: "desc" },
      include: { items: true },
      take: 100,
    }),
    prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { displayName: true, nickname: true, firstName: true, lastName: true },
    }),
  ])

  const productMap = new Map<string, { productId: string; orderNumber: string; purchasedAt: string }>()
  orders.forEach((order) => {
    order.items.forEach((item) => {
      if (!item.productId) return
      if (productMap.has(item.productId)) return
      productMap.set(item.productId, {
        productId: item.productId,
        orderNumber: order.orderNumber,
        purchasedAt: order.createdAt.toISOString(),
      })
    })
  })

  const productIds = Array.from(productMap.keys())
  const [products] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, title: true, slug: true, images: true },
        })
      : Promise.resolve([]),
  ])

  const purchasedProducts = products.map((product) => {
    const purchased = productMap.get(product.id)
    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      images: product.images,
      orderNumber: purchased?.orderNumber || "",
      purchasedAt: purchased?.purchasedAt || null,
      review: null,
    }
  })

  const accessState = await reconcileReviewAccessForUser(user.id, email)
  const remainingReviews = accessState.approved ? accessState.remainingReviews : 0
  const canReview = purchasedProducts.length > 0 && remainingReviews > 0
  const customerName =
    profile?.displayName?.trim() ||
    profile?.nickname?.trim() ||
    `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() ||
    user.name ||
    user.email.split("@")[0]

  return NextResponse.json({
    canReview,
    remainingReviews,
    approved: accessState.approved,
    message:
      purchasedProducts.length < 1
        ? PURCHASE_REQUIRED_MESSAGE
        : accessState.approved
          ? "You can write a review from this page."
          : "Your review access is pending admin approval.",
    customerName,
    customerEmail: email,
    products: purchasedProducts,
  })
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser("customer")
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const productId = String(body.productId || "").trim()
    const rating = Math.min(5, Math.max(1, Math.round(Number(body.rating || 5))))
    const comment = String(body.comment || "").trim()
    const photoUrl = String(body.photoUrl || "").trim() || null
    const name = String(body.name || "").trim() || user.name || user.email.split("@")[0]
    const email = normalizeEmail(user.email)

    if (!productId || comment.length < 3) {
      return NextResponse.json({ error: "Invalid review payload" }, { status: 400 })
    }

    const [productExists, purchased] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId }, select: { id: true, title: true, slug: true } }),
      prisma.orderItem.findFirst({
        where: {
          productId,
          order: {
            status: { notIn: ["CANCELLED", "REFUNDED"] },
            OR: [{ userId: user.id }, { customerEmail: { equals: email } }],
          },
        },
        select: { id: true },
      }),
    ])

    if (!productExists) return NextResponse.json({ error: "Product not found" }, { status: 404 })
    if (!purchased) {
      return NextResponse.json({ error: PURCHASE_REQUIRED_MESSAGE }, { status: 403 })
    }

    const accessState = await reconcileReviewAccessForUser(user.id, email)
    if (!accessState.approved || accessState.remainingReviews < 1) {
      return NextResponse.json({ error: "You are not allowed to write a review yet." }, { status: 403 })
    }

    const access = await prisma.reviewAccess.findUnique({ where: { email } })
    if (!access) {
      return NextResponse.json({ error: "Review access could not be resolved." }, { status: 500 })
    }

    const [created] = await prisma.$transaction([
      prisma.productReview.create({
        data: {
          productId,
          name,
          email,
          rating,
          comment,
          photoUrl,
        },
      }),
      prisma.reviewAccess.update({
        where: { id: access.id },
        data: { remainingReviews: { decrement: 1 } },
      }),
      prisma.customerMessage.create({
        data: {
          userId: user.id,
          kind: "SYSTEM",
          title: "Review submitted",
          content: `Thanks for your review on ${productExists.title}.`,
          ctaLabel: "View product",
          ctaUrl: `/product/${productExists.slug}`,
          metadata: JSON.stringify({ productId, productSlug: productExists.slug, source: "ACCOUNT_REVIEW" }),
        },
      }),
    ])

    return NextResponse.json({ success: true, reviewId: created.id })
  } catch (error) {
    console.error("POST /api/account/reviews error", error)
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 })
  }
}
