import Link from "next/link"
import { notFound } from "next/navigation"
import { Download, Images } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { InventoryPortalShell } from "@/components/inventory/inventory-portal-shell"
import { getInventoryProductBySlug } from "@/lib/admin-inventory"
import { requireInventoryUser } from "@/lib/inventory-auth"
import { parseProductSpecs } from "@/lib/inventory-specs"
import { normalizeRichTextHtml } from "@/lib/rich-text"

export const dynamic = "force-dynamic"
export const revalidate = 0
const INVENTORY_FALLBACK_IMAGE = "/uploads/oushak-rugs/large-oushak/beige-floral-oushak-rug-4x6-handmade-turkish-rug-1-large.webp"



function specValue(value: string | null | undefined) {
  const normalized = String(value || "").trim()
  return normalized || "-"
}

export default async function InventoryProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  await requireInventoryUser()
  const { slug } = await params
  const product = await getInventoryProductBySlug(slug, { includeSoldData: false })

  if (!product) {
    notFound()
  }

  const galleryImages = product.imageUrls.length > 0 ? product.imageUrls : [INVENTORY_FALLBACK_IMAGE]
  const imageSrc = galleryImages[0]
  const detailImages = galleryImages.slice(1, 5)
  const descriptionHtml = normalizeRichTextHtml(product.shortDescription?.trim()) || ""

  const parsedSpecs = parseProductSpecs(product.description)
  const origin = parsedSpecs.origin
  const material = parsedSpecs.material || product.materialLabels[0]
  const size = parsedSpecs.size || product.sizeLabels[0]
  const age = parsedSpecs.age || product.ageLabels[0]
  const condition = parsedSpecs.condition
  const pile = parsedSpecs.pile
  const knotDensity = parsedSpecs.knotDensity

  const specs = [
    { label: "Origin", value: specValue(origin) },
    { label: "Material", value: specValue(material) },
    { label: "Size", value: specValue(size) },
    { label: "Age", value: specValue(age) },
    { label: "Condition", value: specValue(condition) },
    { label: "Pile", value: specValue(pile) },
    { label: "Knot Density", value: specValue(knotDensity) },
    { label: "SKU", value: specValue(parsedSpecs.sku || product.sku) },
  ].filter((item) => item.value !== "-")

  const actions = (
    <>
      <Button
        asChild
        variant="outline"
        className="h-10 rounded-sm border-[#c3c4c7] bg-[#f6f7f7] px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
      >
        <a href="/api/inventory/export">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </a>
      </Button>
      <Button
        asChild
        variant="outline"
        className="h-10 rounded-sm border-[#c3c4c7] bg-[#f6f7f7] px-3 text-[12px] font-semibold text-slate-800 hover:bg-white"
      >
        <a href="/api/inventory/images">
          <Images className="mr-2 h-4 w-4" />
          Download Product Images
        </a>
      </Button>
    </>
  )

  return (
    <InventoryPortalShell
      title={product.title}
      description={`Stock Code ${product.sku || "-"}`}
      actions={actions}
    >
      <div className="mb-5">
        <Link href="/inventory" className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
          Back to Inventory
        </Link>
      </div>

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
          <div className="overflow-hidden rounded-sm border border-[#dcdcde] bg-white p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-[#f4efe8]">
                <ResponsiveImage
                  src={imageSrc}
                  alt={product.title}
                  fill
                  sizes="(min-width: 1024px) 500px, 100vw"
                  className="object-cover"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-2 lg:content-start">
                {detailImages.map((image, index) => (
                  <div
                    key={`${image}-${index}`}
                    className="relative aspect-square overflow-hidden rounded-sm border border-[#ece6dc] bg-[#f4efe8]"
                  >
                    <ResponsiveImage
                      src={image}
                      alt={`${product.title} detail ${index + 1}`}
                      fill
                      sizes="220px"
                      className="object-cover"
                    />
                  </div>
                ))}
                {detailImages.length === 0 ? (
                  <div className="col-span-2 flex min-h-[140px] items-center justify-center rounded-sm border border-dashed border-[#ece6dc] bg-[#fcfaf7] text-sm text-slate-500">
                    No detail images available.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-sm border border-[#dcdcde] bg-white p-5 lg:h-full">
            <div className="flex h-full flex-col">
              <h2 className="text-base font-medium text-slate-900">Product Specs</h2>
              <div className="mt-4 divide-y divide-[#ece6dc]">
                {specs.length > 0 ? (
                  specs.map((item) => (
                    <div key={item.label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-2 text-sm">
                      <div className="text-slate-500">{item.label}</div>
                      <div className="text-slate-900">{item.value}</div>
                    </div>
                  ))
                ) : (
                  <div className="py-2 text-sm text-slate-500">No technical details available.</div>
                )}
              </div>
              <div className="mt-auto" />
            </div>
          </div>
        </div>

        <div className="rounded-sm border border-[#dcdcde] bg-white p-6">
          <h2 className="text-base font-medium text-slate-900">Product Short Description</h2>
          {descriptionHtml ? (
            <div
              className="mt-4 text-sm leading-6 text-slate-700 [&_p]:mb-3 [&_p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          ) : (
            <p className="mt-4 text-sm text-slate-500">No short description available.</p>
          )}
        </div>
      </div>
    </InventoryPortalShell>
  )
}
