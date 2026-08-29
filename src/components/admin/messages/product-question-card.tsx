"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, ExternalLink, ImageOff, MessageSquare } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { StorefrontProductImage } from "@/components/storefront/storefront-product-image"
import { splitProductQuestionBody } from "@/lib/product-question-message"

type ResolvedProduct = {
    id: string
    slug: string
    title: string
    sku?: string | null
    isPublished: boolean
    thumbnailCandidates: string[]
    previewCandidates: string[]
    imageAlt: string
}

const linkClass =
    "rounded-sm text-sm font-medium text-slate-700 underline-offset-4 transition-colors hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"

/**
 * Product-question view of a storefront "Ask Question" message: the product it
 * was asked about, the two actions an admin actually needs, and the customer's
 * own words. The product is resolved server-side by slug; when that fails the
 * card degrades to a neutral notice and still shows the message.
 */
export function ProductQuestionCard({
    messageId,
    subjectTitle,
    content,
}: {
    messageId: string
    subjectTitle: string
    content: string
}) {
    const [product, setProduct] = useState<ResolvedProduct | null>(null)
    const [resolving, setResolving] = useState(true)
    const [previewOpen, setPreviewOpen] = useState(false)

    useEffect(() => {
        let cancelled = false
        setResolving(true)
        setProduct(null)
        setPreviewOpen(false)

        const run = async () => {
            try {
                const response = await fetch(`/api/admin/messages/${messageId}/product`, { cache: "no-store" })
                if (!response.ok) throw new Error("Failed to resolve product")
                const data = (await response.json()) as { product?: ResolvedProduct | null }
                if (cancelled) return
                setProduct(data.product && typeof data.product.id === "string" ? data.product : null)
            } catch {
                // Product context is an enhancement - the message itself still renders.
                if (!cancelled) setProduct(null)
            } finally {
                if (!cancelled) setResolving(false)
            }
        }

        void run()
        return () => {
            cancelled = true
        }
    }, [messageId])

    const { body } = splitProductQuestionBody(content)
    const displayTitle = product?.title || subjectTitle || "Product"
    const adminHref = product ? `/dashboard/products/${product.id}` : ""
    const publicHref = product ? `/product/${product.slug}` : ""

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Product Question
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        {product ? (
                            <button
                                type="button"
                                onClick={() => setPreviewOpen(true)}
                                aria-label={`Enlarge the image of ${displayTitle}`}
                                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[#dce3ed] bg-white transition-colors hover:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:h-24 sm:w-24"
                            >
                                <StorefrontProductImage
                                    candidates={product.thumbnailCandidates}
                                    alt={product.imageAlt || displayTitle}
                                    fill
                                    sizes="96px"
                                    className="object-center"
                                />
                            </button>
                        ) : (
                            <div
                                aria-hidden="true"
                                className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-[#dce3ed] bg-slate-50 sm:h-24 sm:w-24 ${
                                    resolving ? "animate-pulse" : ""
                                }`}
                            >
                                {resolving ? null : <ImageOff className="h-6 w-6 text-slate-400" />}
                            </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-2">
                            {product ? (
                                <Link
                                    href={adminHref}
                                    className="block break-words rounded-sm text-base font-semibold text-slate-900 underline-offset-4 transition-colors hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                                >
                                    {displayTitle}
                                </Link>
                            ) : (
                                <p className="break-words text-base font-semibold text-slate-900">{displayTitle}</p>
                            )}

                            {product ? (
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                    <a href={publicHref} target="_blank" rel="noopener noreferrer" className={linkClass}>
                                        View Product
                                        <ExternalLink className="ml-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
                                    </a>
                                    <Link href={adminHref} className={linkClass}>
                                        Edit Product
                                        <ArrowRight className="ml-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
                                    </Link>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {resolving
                                        ? "Looking up this product..."
                                        : "This product is no longer available in the catalog."}
                                </p>
                            )}

                            {product && !product.isPublished ? (
                                <p className="text-xs text-amber-700">This product is currently unpublished.</p>
                            ) : null}
                        </div>
                    </div>

                    <div className="border-t border-[#e5ebf3] pt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Customer Message
                        </p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-900">{body}</p>
                    </div>
                </CardContent>
            </Card>

            {product ? (
                <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                    <DialogContent
                        aria-describedby={undefined}
                        className="w-[calc(100%-2rem)] max-w-sm gap-3 border-[#dce3ed] bg-white p-4 sm:max-w-md"
                    >
                        <DialogTitle className="sr-only">{displayTitle}</DialogTitle>
                        <a
                            href={publicHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${displayTitle} on the storefront in a new tab`}
                            className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        >
                            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-[#dce3ed] bg-white">
                                <StorefrontProductImage
                                    candidates={product.previewCandidates}
                                    alt={product.imageAlt || displayTitle}
                                    fill
                                    sizes="(max-width: 640px) 90vw, 420px"
                                    className="object-center"
                                />
                            </div>
                        </a>
                        <p className="text-center text-xs text-slate-500">
                            Click the image to open the product page in a new tab.
                        </p>
                    </DialogContent>
                </Dialog>
            ) : null}
        </>
    )
}
