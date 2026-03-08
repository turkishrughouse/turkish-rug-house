export type CartItem = {
  productId: string
  slug: string
  title: string
  sku?: string | null
  price: number
  compareAtPrice: number | null
  image: string
  quantity: number
  stockCount: number
}

const CART_KEY = "rughouse_cart_v1"
const CART_EVENT = "rughouse:cart-updated"

export function getCartUpdateEventName() {
  return CART_EVENT
}

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CART_KEY, JSON.stringify(items))
  window.dispatchEvent(new CustomEvent(CART_EVENT))
}

export function getCartSummary(items = readCart()) {
  const count = items.reduce((acc, item) => acc + item.quantity, 0)
  const total = items.reduce((acc, item) => acc + item.quantity * item.price, 0)
  return { count, total }
}

function pingCartAdd(input: { slug: string; title: string }) {
  if (typeof window === "undefined") return
  const path = input.slug ? `/product/${input.slug}` : window.location.pathname
  const label = input.title?.trim() || "Product"
  const action = `Added to cart • ${label}`
  void fetch("/api/account/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      href: window.location.origin + path,
      action,
    }),
    credentials: "include",
    cache: "no-store",
  }).catch(() => {})
}

export function addToCart(input: Omit<CartItem, "quantity"> & { quantity: number }) {
  const current = readCart()
  const existingIndex = current.findIndex((item) => item.productId === input.productId)

  if (existingIndex === -1) {
    if (input.quantity > input.stockCount) {
      return { ok: false as const, message: `Only ${input.stockCount} item(s) in stock.` }
    }
    writeCart([...current, { ...input }])
    pingCartAdd({ slug: input.slug, title: input.title })
    return { ok: true as const }
  }

  const existing = current[existingIndex]
  const nextQty = existing.quantity + input.quantity
  if (nextQty > existing.stockCount) {
    return { ok: false as const, message: `You can add up to ${existing.stockCount} item(s) for this product.` }
  }

  const next = [...current]
  next[existingIndex] = {
    ...existing,
    quantity: nextQty,
    price: input.price,
    compareAtPrice: input.compareAtPrice,
    image: input.image,
    stockCount: input.stockCount,
    slug: input.slug,
    title: input.title,
    sku: input.sku ?? existing.sku ?? null,
  }
  writeCart(next)
  pingCartAdd({ slug: input.slug, title: input.title })
  return { ok: true as const }
}

export function updateCartItemQuantity(productId: string, quantity: number) {
  const current = readCart()
  const idx = current.findIndex((item) => item.productId === productId)
  if (idx === -1) return { ok: false as const, message: "Item not found." }
  const item = current[idx]

  if (quantity < 1) quantity = 1
  if (quantity > item.stockCount) {
    return { ok: false as const, message: `Only ${item.stockCount} item(s) in stock.` }
  }

  const next = [...current]
  next[idx] = { ...item, quantity }
  writeCart(next)
  return { ok: true as const }
}

export function removeCartItem(productId: string) {
  const current = readCart()
  writeCart(current.filter((item) => item.productId !== productId))
}

export function clearCart() {
  writeCart([])
}
