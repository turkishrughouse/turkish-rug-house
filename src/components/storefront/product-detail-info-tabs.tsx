"use client"

import { useState } from "react"

import { richContentClassName, type ProductDetailData } from "@/components/storefront/product-detail-shared"

export function ProductDetailInfoTabs({
  product,
  bottomDescriptionHtml,
  canExpandBottomDescription,
  shippingText,
  canExpandShipping,
}: {
  product: ProductDetailData
  bottomDescriptionHtml: string
  canExpandBottomDescription: boolean
  shippingText: string
  canExpandShipping: boolean
}) {
  void product
  const [expandedBottomDesc, setExpandedBottomDesc] = useState(false)
  const [expandedShipping, setExpandedShipping] = useState(false)
  const [activeInfoTab, setActiveInfoTab] = useState<"description" | "shipping">("description")

  return (
    <section className="mt-10 border-t border-[#e6edf5] pt-8">
      <div className="rounded-xl border border-[#dce3ed] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[#e6edf5] p-3">
          <div className="grid w-full grid-cols-2 overflow-hidden rounded-lg border border-[#dce3ed] bg-white">
            <button type="button" onClick={() => setActiveInfoTab("description")} className={`h-11 border-r border-[#dce3ed] px-4 text-sm font-semibold transition-colors ${activeInfoTab === "description" ? "bg-[#3f4b63] text-white" : "bg-transparent text-slate-700 hover:bg-slate-100"}`}>Description</button>
            <button type="button" onClick={() => setActiveInfoTab("shipping")} className={`h-11 px-4 text-sm font-semibold transition-colors ${activeInfoTab === "shipping" ? "bg-[#3f4b63] text-white" : "bg-transparent text-slate-700 hover:bg-slate-100"}`}>Shipping & Returns</button>
          </div>
        </div>

        <div className="p-5">
          {activeInfoTab === "description" ? (
            <div>
              <div className={`${richContentClassName} ${!expandedBottomDesc && canExpandBottomDescription ? "line-clamp-7" : ""}`} dangerouslySetInnerHTML={{ __html: bottomDescriptionHtml }} />
              {canExpandBottomDescription ? (
                <button type="button" onClick={() => setExpandedBottomDesc((prev) => !prev)} className="mt-2 text-sm font-medium text-emerald-700 hover:underline">
                  {expandedBottomDesc ? "Show less" : "See more"}
                </button>
              ) : null}
            </div>
          ) : null}

          {activeInfoTab === "shipping" ? (
            <div>
              <p className={`text-slate-600 leading-6 text-sm ${!expandedShipping && canExpandShipping ? "line-clamp-10" : ""}`}>{shippingText}</p>
              {canExpandShipping ? (
                <button type="button" onClick={() => setExpandedShipping((prev) => !prev)} className="mt-2 text-sm font-medium text-emerald-700 hover:underline">
                  {expandedShipping ? "Show less" : "See more"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
