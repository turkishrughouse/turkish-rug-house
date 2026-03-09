"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  clearCart,
  getCartSummary,
  getCartUpdateEventName,
  readCart,
  removeCartItem,
  updateCartItemQuantity,
  type CartItem,
} from "@/lib/storefront/cart"
import { formatCurrency, type CurrencySettings } from "@/lib/storefront/currency"
import { parseProductImages, pickPrimaryImage } from "@/lib/product-images"

type ExpandKey = "coupon" | "shipping" | "gift"
type SuggestedProduct = {
  id: string
  slug: string
  title: string
  price: number
  images: string
}

function parseImages(images: string): string[] {
  return parseProductImages(images)
}

export default function BasketPage() {
  const [items, setItems] = useState<CartItem[]>([])
  const [currencySettings, setCurrencySettings] = useState<CurrencySettings>({
    defaultCurrency: "USD",
    currencyPosition: "left",
    thousandSeparator: ".",
    decimalSeparator: ",",
    numberOfDecimals: 2,
  })
  const [selectedShippingId, setSelectedShippingId] = useState("flat")
  const [flatShippingRate, setFlatShippingRate] = useState(20)
  const [localPickupRate, setLocalPickupRate] = useState(25)
  const [enableTaxes, setEnableTaxes] = useState(false)
  const [expanded, setExpanded] = useState<Record<ExpandKey, boolean>>({
    coupon: false,
    shipping: false,
    gift: false,
  })
  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedProduct[]>([])
  const [fallbackBannerImage, setFallbackBannerImage] = useState("")

  const refresh = () => setItems(readCart())

  useEffect(() => {
    const eventName = getCartUpdateEventName()
    const onUpdate = () => refresh()
    window.addEventListener(eventName, onUpdate)
    window.addEventListener("storage", onUpdate)
    const timer = window.setTimeout(onUpdate, 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(eventName, onUpdate)
      window.removeEventListener("storage", onUpdate)
    }
  }, [])

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/public/settings", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (typeof data.flatShippingRate === "number") setFlatShippingRate(Math.max(0, data.flatShippingRate))
        if (typeof data.localPickupRate === "number") setLocalPickupRate(Math.max(0, data.localPickupRate))
        setEnableTaxes(Boolean(data.enableTaxes))
        setCurrencySettings({
          defaultCurrency: data.defaultCurrency || "USD",
          currencyPosition: data.currencyPosition || "left",
          thousandSeparator: data.thousandSeparator || ".",
          decimalSeparator: data.decimalSeparator || ",",
          numberOfDecimals: typeof data.numberOfDecimals === "number" ? data.numberOfDecimals : 2,
        })
      } catch {
        // keep defaults
      }
    }
    void loadSettings()
  }, [])

  useEffect(() => {
    const loadSuggestions = async () => {
      if (items.length === 0) {
        setSuggestedProducts([])
        return
      }
      const slugs = Array.from(new Set(items.map((item) => item.slug).filter(Boolean)))
      if (slugs.length === 0) {
        setSuggestedProducts([])
        return
      }

      try {
        const res = await fetch(`/api/public/cart/recommendations?slugs=${encodeURIComponent(slugs.join(","))}`, {
          cache: "no-store",
        })
        if (!res.ok) {
          setSuggestedProducts([])
          return
        }
        const data = await res.json()
        const list = Array.isArray(data?.products) ? data.products : []
        setSuggestedProducts(
          list.slice(0, 5).map((product: { id: string; slug: string; title: string; price: number; images: string }) => ({
            id: String(product.id),
            slug: String(product.slug),
            title: String(product.title),
            price: Number(product.price || 0),
            images: String(product.images || "[]"),
          }))
        )
      } catch {
        setSuggestedProducts([])
      }
    }

    void loadSuggestions()
  }, [items])

  useEffect(() => {
    const loadFallbackBanner = async () => {
      try {
        const res = await fetch("/api/v1/public/products?limit=1&sort=latest", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json().catch(() => ({}))) as {
          products?: Array<{ image?: string; featuredImage?: string; images?: unknown }>
        }
        const product = Array.isArray(data.products) ? data.products[0] : null
        if (!product) return
        const image =
          (typeof product.image === "string" ? product.image : "") ||
          pickPrimaryImage(product.featuredImage ?? "", product.images)
        if (image) setFallbackBannerImage(image)
      } catch {
        // keep placeholder fallback
      }
    }

    void loadFallbackBanner()
  }, [])

  const summary = useMemo(() => getCartSummary(items), [items])
  const heroImage = items[0]?.image || fallbackBannerImage || "/placeholder.jpg"
  const shippingOptions = useMemo(
    () => [
      { id: "flat", label: "Flat rate", amount: flatShippingRate },
      { id: "pickup", label: "Local pickup", amount: localPickupRate },
    ],
    [flatShippingRate, localPickupRate]
  )
  const selectedShipping = shippingOptions.find((opt) => opt.id === selectedShippingId) || shippingOptions[0]
  const taxAmount = enableTaxes ? (summary.total + selectedShipping.amount) * 0.1 : 0
  const total = summary.total + selectedShipping.amount + taxAmount

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <section className="relative overflow-hidden border-b border-[#e2e2e2]">
        <img src={heroImage} alt="Shopping cart banner" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative mx-auto flex w-full max-w-[1880px] flex-col items-center justify-center px-4 py-10 text-center sm:px-6 sm:py-12 md:px-8">
          <h1 className="text-3xl font-semibold text-white sm:text-[42px]">Shopping Cart</h1>
          <p className="mt-2 text-base text-slate-100 sm:text-[19px]">Home / Shopping Cart</p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1880px] px-3 py-6 sm:px-4 sm:py-8 lg:px-8">
        {items.length === 0 ? (
          <>
            <div className="rounded-md border border-slate-200 bg-white p-10 text-center">
              <p className="text-slate-600">Your cart is empty.</p>
              <Link
                href="/shop"
                className="mt-4 inline-flex h-10 items-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
              >
                Continue Shopping
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1.7fr_0.83fr] xl:gap-8">
              <section className="overflow-hidden self-start border border-[#d8d8d8] bg-white xl:sticky xl:top-6">
                <div className="hidden md:block">
                  <div className="grid grid-cols-[150px_1.35fr_0.85fr_1fr_0.75fr] border-b border-[#d8d8d8] bg-[#f7f7f7] px-4 py-2.5 text-center text-[14px] font-semibold text-[#4b5563]">
                    <span>Image</span>
                    <span className="text-left">Product Name</span>
                    <span>SKU</span>
                    <span>Quantity</span>
                    <span>Total</span>
                  </div>

                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="grid min-h-[116px] grid-cols-[150px_1.35fr_0.85fr_1fr_0.75fr] items-center border-b border-[#dfdfdf] px-4 py-2.5"
                    >
                      <div className="mx-auto h-20 w-20 overflow-hidden border border-[#d8d8d8] bg-white">
                        <img src={item.image || "/placeholder.jpg"} alt={item.title} className="h-full w-full object-cover" />
                      </div>

                      <div className="min-w-0 pr-3 text-left">
                        <Link href={`/product/${item.slug}`} className="line-clamp-2 text-[14px] font-medium leading-6 text-slate-900 hover:text-teal-700">
                          {item.title}
                        </Link>
                      </div>

                      <p className="text-center text-[13px] text-slate-500">{item.sku || "-"}</p>

                      <div className="flex items-center justify-center gap-2">
                        <div className="inline-grid grid-cols-3 items-center overflow-hidden rounded-md border border-[#6b7280]">
                          <button
                            type="button"
                            className="h-8 w-8 cursor-pointer text-[15px] text-slate-600 hover:bg-slate-50"
                            onClick={() => {
                              const nextQty = item.quantity - 1
                              if (nextQty < 1) return
                              const result = updateCartItemQuantity(item.productId, nextQty)
                              if (!result.ok) toast.error(result.message)
                              refresh()
                            }}
                          >
                            -
                          </button>
                          <span className="inline-flex h-8 w-8 items-center justify-center border-x border-[#6b7280] text-[14px]">{item.quantity}</span>
                          <button
                            type="button"
                            className="h-8 w-8 cursor-pointer text-[15px] text-slate-600 hover:bg-slate-50"
                            onClick={() => {
                              const result = updateCartItemQuantity(item.productId, item.quantity + 1)
                              if (!result.ok) toast.error(result.message)
                              refresh()
                            }}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#6b7280] text-slate-600 hover:bg-slate-50"
                          onClick={refresh}
                          aria-label="Refresh item"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#6b7280] text-slate-600 hover:bg-slate-50"
                          onClick={() => {
                            removeCartItem(item.productId)
                            refresh()
                          }}
                          aria-label="Delete item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <p className="text-center text-[20px] font-semibold text-slate-900">
                        {formatCurrency(item.price * item.quantity, currencySettings)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 p-3 md:hidden">
                  {items.map((item) => (
                    <div key={item.productId} className="rounded-md border border-[#dfdfdf] p-3">
                      <div className="flex gap-3">
                        <div className="h-20 w-20 shrink-0 overflow-hidden border border-[#d8d8d8] bg-white">
                          <img src={item.image || "/placeholder.jpg"} alt={item.title} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link href={`/product/${item.slug}`} className="line-clamp-2 text-sm font-medium leading-5 text-slate-900 hover:text-teal-700">
                            {item.title}
                          </Link>
                          <p className="mt-1 text-xs text-slate-500">SKU: {item.sku || "-"}</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(item.price * item.quantity, currencySettings)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="inline-grid grid-cols-3 items-center overflow-hidden rounded-md border border-[#6b7280]">
                          <button
                            type="button"
                            className="h-8 w-8 cursor-pointer text-[15px] text-slate-600 hover:bg-slate-50"
                            onClick={() => {
                              const nextQty = item.quantity - 1
                              if (nextQty < 1) return
                              const result = updateCartItemQuantity(item.productId, nextQty)
                              if (!result.ok) toast.error(result.message)
                              refresh()
                            }}
                          >
                            -
                          </button>
                          <span className="inline-flex h-8 w-8 items-center justify-center border-x border-[#6b7280] text-[14px]">{item.quantity}</span>
                          <button
                            type="button"
                            className="h-8 w-8 cursor-pointer text-[15px] text-slate-600 hover:bg-slate-50"
                            onClick={() => {
                              const result = updateCartItemQuantity(item.productId, item.quantity + 1)
                              if (!result.ok) toast.error(result.message)
                              refresh()
                            }}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#6b7280] text-slate-600 hover:bg-slate-50"
                          onClick={refresh}
                          aria-label="Refresh item"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#6b7280] text-slate-600 hover:bg-slate-50"
                          onClick={() => {
                            removeCartItem(item.productId)
                            refresh()
                          }}
                          aria-label="Delete item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <aside className="h-fit border border-[#d8d8d8] bg-[#f7f7f7] p-4 sm:p-6 lg:p-7">
              <h2 className="text-[22px] font-semibold leading-[1.25] text-[#111827]">What would you like to do next?</h2>

              {(["coupon", "shipping", "gift"] as ExpandKey[]).map((key) => {
                const titleMap: Record<ExpandKey, string> = {
                  coupon: "Use Coupon Code",
                  shipping: "Estimate Shipping & Taxes",
                  gift: "Use Gift Certificate",
                }
                return (
                  <div key={key} className="border-b border-[#dedede] py-3">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-[14px] font-medium text-[#111827]"
                      onClick={() => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}
                    >
                      <span>{titleMap[key]}</span>
                      {expanded[key] ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                    {expanded[key] ? (
                      <div className="mt-3">
                        <input className="h-10 w-full border border-[#d4d4d4] bg-white px-3 text-[13px]" placeholder={`${titleMap[key]}...`} />
                      </div>
                    ) : null}
                  </div>
                )
              })}

              <div className="mt-6 overflow-hidden border border-[#d4d4d4]">
                <div className="flex items-center justify-between border-b border-[#d4d4d4] px-4 py-2.5 text-[14px]">
                  <span className="text-slate-700">Sub-Total:</span>
                  <span className="font-medium">{formatCurrency(summary.total, currencySettings)}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#d4d4d4] px-4 py-2.5 text-[14px]">
                  <span className="text-slate-700">Shipping:</span>
                  <select
                    className="h-8 border border-[#d1d5db] bg-white px-2 text-[13px]"
                    value={selectedShippingId}
                    onChange={(e) => setSelectedShippingId(e.target.value)}
                  >
                    {shippingOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label} ({formatCurrency(opt.amount, currencySettings)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-[15px] font-semibold">
                  <span>Total:</span>
                  <span>{formatCurrency(total, currencySettings)}</span>
                </div>
              </div>

              <div className="mt-6 space-y-2.5">
                <Link
                  href="/shop"
                  className="inline-flex h-10 w-full items-center justify-center rounded-full border border-[#6b7280] text-[14px] font-medium text-[#374151] hover:bg-slate-50"
                >
                  Continue Shopping
                </Link>
                <Link
                  href="/checkout"
                  className="inline-flex h-10 w-full items-center justify-center rounded-full bg-[#1f6d6a] text-[14px] font-semibold text-white hover:bg-[#185f5c]"
                >
                  Checkout
                </Link>
                <button
                  type="button"
                  className="inline-flex h-9 w-full cursor-pointer items-center justify-center border border-[#d4d4d4] text-[12px] text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    clearCart()
                    refresh()
                  }}
                >
                  Clear Cart
                </button>
              </div>
              </aside>
            </div>

            {suggestedProducts.length > 0 ? (
              <section className="mt-12 border-t border-[#d8d8d8] pt-8">
                <h2 className="text-[28px] font-semibold text-slate-900">You May Also Like</h2>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {suggestedProducts.map((product) => {
                    const image = parseImages(product.images)[0] || "/placeholder.jpg"
                    return (
                      <Link
                        key={product.id}
                        href={`/product/${product.slug}`}
                        className="group overflow-hidden border border-[#d8d8d8] bg-white p-3 transition-all hover:shadow-md"
                      >
                        <div className="aspect-square overflow-hidden border border-slate-200">
                          <img src={image} alt={product.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        </div>
                        <p className="mt-3 line-clamp-2 text-[14px] font-medium text-slate-900">{product.title}</p>
                        <p className="mt-1 text-[16px] font-semibold text-emerald-700">
                          {formatCurrency(product.price, currencySettings)}
                        </p>
                      </Link>
                    )
                  })}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
