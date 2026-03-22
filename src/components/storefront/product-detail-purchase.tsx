"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { addToCart } from "@/lib/storefront/cart"
import { toAbsoluteSiteUrl } from "@/lib/site-url"
import type { ProductDetailData } from "@/components/storefront/product-detail-shared"

export function ProductDetailPurchase({
  product,
  image,
}: {
  product: ProductDetailData
  image: string
}) {
  const router = useRouter()
  const [qty, setQty] = useState(1)
  const [askQuestionOpen, setAskQuestionOpen] = useState(false)
  const [askSubmitting, setAskSubmitting] = useState(false)
  const [askForm, setAskForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  })

  const stockLimit = Math.max(0, product.stockCount)
  const safeQty = Math.min(Math.max(0, qty), stockLimit)

  const addBasket = (navigateToBasket = false) => {
    if (product.stockCount <= 0 || !product.isStock) {
      toast.error("This product is out of stock.")
      return false
    }
    if (safeQty <= 0) {
      toast.error("Quantity must be at least 1.")
      return false
    }
    const result = addToCart({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      sku: product.sku,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      image,
      stockCount: product.stockCount,
      quantity: safeQty,
    })
    if (!result.ok) {
      toast.error(result.message)
      return false
    }
    toast.success(navigateToBasket ? `Added ${safeQty} item(s) to basket` : `Added ${safeQty} item(s) to basket`)
    if (navigateToBasket) {
      router.push("/basket")
    }
    return true
  }

  const submitAskQuestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = askForm.name.trim()
    const email = askForm.email.trim()
    const messageBody = askForm.message.trim()
    if (!name || !email || messageBody.length < 10) {
      toast.error("Please fill required fields. Message must be at least 10 characters.")
      return
    }

    const productUrl = toAbsoluteSiteUrl(`/product/${product.slug}`)
    const composedMessage = [
      `Product: ${product.title}`,
      `Product URL: ${productUrl}`,
      "",
      messageBody,
    ].join("\n")

    try {
      setAskSubmitting(true)
      const response = await fetch("/api/messages/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: askForm.phone.trim(),
          subject: `Product question - ${product.title}`,
          message: composedMessage,
        }),
      })
      const payload = await response.json().catch(() => null as null | { error?: string })
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to send your question.")
      }
      toast.success("Your question has been sent.")
      setAskQuestionOpen(false)
      setAskForm({ name: "", email: "", phone: "", message: "" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send your question.")
    } finally {
      setAskSubmitting(false)
    }
  }

  return (
    <>
      <div className="mt-8">
        <div className="grid grid-cols-1 gap-3 md:hidden">
          <div className="grid grid-cols-[auto_1fr] items-start gap-3">
            <div>
              <div className="inline-flex items-center rounded-md border border-[#dce3ed]">
                <button type="button" className="h-10 w-10 text-base text-slate-600 hover:bg-slate-50" onClick={() => setQty((prev) => Math.max(0, prev - 1))}>-</button>
                <input
                  type="number"
                  min={0}
                  max={stockLimit}
                  value={safeQty}
                  onChange={(e) => {
                    const raw = Number(e.target.value)
                    const next = Number.isFinite(raw) ? raw : 0
                    setQty(Math.min(Math.max(0, next), stockLimit))
                  }}
                  className="h-10 w-12 border-x border-[#dce3ed] bg-white text-center text-sm"
                />
                <button type="button" className="h-10 w-10 text-base text-slate-600 hover:bg-slate-50" onClick={() => setQty((prev) => Math.min(prev + 1, stockLimit))}>+</button>
              </div>
              <div className="mt-2 text-xs font-medium text-slate-500">
                Quantity - {safeQty} - SKU - {product.sku || "-"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="h-10 rounded-md bg-emerald-600 px-2 text-xs font-semibold text-white hover:bg-emerald-700" onClick={() => addBasket(false)}>Add to Basket</button>
              <button type="button" className="h-10 rounded-md border border-slate-800 bg-slate-900 px-2 text-xs font-semibold text-white hover:bg-slate-800" onClick={() => addBasket(true)}>Buy Now</button>
            </div>
          </div>
          <button type="button" className="h-10 w-full rounded-md border border-emerald-700 bg-white text-sm font-semibold text-emerald-700 hover:bg-emerald-50" onClick={() => setAskQuestionOpen(true)}>
            Ask Question
          </button>
        </div>

        <div className="hidden md:block">
          <div className="flex flex-wrap items-start gap-2">
            <div className="inline-flex items-center rounded-md border border-[#dce3ed]">
              <button type="button" className="h-10 w-10 text-base text-slate-600 hover:bg-slate-50" onClick={() => setQty((prev) => Math.max(0, prev - 1))}>-</button>
              <input
                type="number"
                min={0}
                max={stockLimit}
                value={safeQty}
                onChange={(e) => {
                  const raw = Number(e.target.value)
                  const next = Number.isFinite(raw) ? raw : 0
                  setQty(Math.min(Math.max(0, next), stockLimit))
                }}
                className="h-10 w-12 border-x border-[#dce3ed] bg-white text-center text-sm"
              />
              <button type="button" className="h-10 w-10 text-base text-slate-600 hover:bg-slate-50" onClick={() => setQty((prev) => Math.min(prev + 1, stockLimit))}>+</button>
            </div>

            <button type="button" className="h-10 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700" onClick={() => addBasket(false)}>
              Add to Basket
            </button>
            <button type="button" className="h-10 rounded-md border border-slate-800 bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800" onClick={() => addBasket(true)}>
              Buy Now
            </button>
            <button type="button" className="h-10 rounded-md border border-emerald-700 bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50" onClick={() => setAskQuestionOpen(true)}>
              Ask Question
            </button>
          </div>
          <div className="mt-2 text-xs font-medium text-slate-500">
            Quantity - {safeQty} - SKU - {product.sku || "-"}
          </div>
        </div>
      </div>

      {askQuestionOpen ? (
        <div className="fixed inset-0 z-[1250] bg-black/45 p-4" onClick={() => setAskQuestionOpen(false)}>
          <div className="mx-auto mt-[8vh] w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Ask a Question</h3>
                <p className="mt-1 text-sm text-slate-600">Product: <span className="font-medium text-slate-800">{product.title}</span></p>
              </div>
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => setAskQuestionOpen(false)} aria-label="Close ask question form">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-3" onSubmit={submitAskQuestion}>
              <input value={askForm.name} onChange={(event) => setAskForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Your name" className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500" required />
              <input type="email" value={askForm.email} onChange={(event) => setAskForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Your email" className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500" required />
              <input value={askForm.phone} onChange={(event) => setAskForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Phone (optional)" className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500" />
              <textarea value={askForm.message} onChange={(event) => setAskForm((prev) => ({ ...prev, message: event.target.value }))} placeholder="Write your question..." className="min-h-[130px] w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500" required />
              <p className="text-xs text-slate-500">Product link will be included automatically in your message.</p>
              <button type="submit" disabled={askSubmitting} className="inline-flex h-11 w-full items-center justify-center rounded-md bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
                {askSubmitting ? "Sending..." : "Send Question"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
