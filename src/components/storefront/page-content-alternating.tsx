import { parsePageLayout } from "@/lib/page-layout"
import { buildYouTubeEmbedUrl } from "@/lib/youtube"

type PageContentAlternatingProps = {
  html: string
  fallbackImage?: string | null
}

function withFallback(image: string, fallback?: string | null) {
  if (image && image.trim().length > 0) return image
  if (fallback && fallback.trim().length > 0) return fallback
  return "/placeholder.jpg"
}

function sectionImages(
  section: { image: string; images?: string[]; imageItems?: Array<{ url: string; title?: string }> },
  fallback?: string | null
): Array<{ url: string; title: string }> {
  const itemList = Array.isArray(section.imageItems)
    ? section.imageItems
      .filter((item): item is { url: string; title?: string } => Boolean(item && typeof item.url === "string" && item.url.trim().length > 0))
      .map((item) => ({ url: item.url, title: typeof item.title === "string" ? item.title : "" }))
    : []

  if (itemList.length > 0) return itemList

  const list = Array.isArray(section.images)
    ? section.images.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : []
  if (list.length > 0) return list.map((url) => ({ url, title: "" }))
  if (section.image && section.image.trim().length > 0) return [{ url: section.image, title: "" }]
  return [{ url: withFallback("", fallback), title: "" }]
}

function imageGridClass(count: number): string {
  if (count <= 1) return "grid grid-cols-1"
  if (count === 2) return "grid grid-cols-2"
  return "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
}

export function PageContentAlternating({ html, fallbackImage }: PageContentAlternatingProps) {
  const parsed = parsePageLayout(html)
  const layout = parsed.layout
  const bodyHtml = (parsed.content || "").trim()

  if (!layout) {
    return (
      <div className="container mx-auto px-6 py-10">
        <div
          className="prose prose-lg prose-slate mx-auto max-w-none prose-headings:font-serif prose-a:text-teal-700 hover:prose-a:text-teal-800"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </div>
    )
  }

  const sections = layout.sections.filter((item) => item.enabled)
  const firstContentSectionId = sections.find((item) => item.type === "content")?.id || null
  const pageVideoEmbedUrl = buildYouTubeEmbedUrl(layout.youtubeUrl, { autoplay: true, muted: true })

  return (
    <div className="container mx-auto px-6 py-10 space-y-2 md:space-y-3">
      {sections.map((section) => {
        if (section.type === "title") {
          if (section.title.trim().length === 0) return null
          return (
            <section key={section.id}>
              <h2 className="font-serif text-2xl font-semibold text-slate-900 md:text-[30px]">{section.title}</h2>
            </section>
          )
        }

        if (section.type === "description") {
          return (
            <section key={section.id} className="rounded-xl border border-slate-100 bg-white p-5 md:p-6">
              <div className="prose prose-slate max-w-none prose-headings:font-serif prose-a:text-teal-700 hover:prose-a:text-teal-800">
                {section.description ? (
                  <div className="whitespace-pre-line">{section.description}</div>
                ) : (
                  <p>Description is empty.</p>
                )}
              </div>
            </section>
          )
        }

        if (section.type === "image") {
          const images = sectionImages(section, fallbackImage)
          return (
            <section key={section.id} className="rounded-xl border border-slate-200 bg-white p-2">
              <div className={`${imageGridClass(images.length)} gap-1`}>
                {images.map((img, imgIndex) => (
                  <div key={`${img.url}-${imgIndex}`} className="flex flex-col">
                    <div className="aspect-square overflow-hidden rounded-md">
                      <img src={img.url} alt={img.title || section.title || "Section image"} className="h-full w-full object-cover" />
                    </div>
                    {img.title.trim().length > 0 ? (
                      <>
                        <div className="mx-[10px] mt-1 border-t border-slate-200" />
                        <p className="pt-0.5 text-[11px] font-medium leading-tight text-slate-700">{img.title}</p>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          )
        }

        const selectedImages = sectionImages(section, fallbackImage)
        const selectedDescription = section.description || ""
        const imageFirst = section.layout === "image-description"
        const sectionVideoEmbedUrl =
          section.mediaType === "video" ? buildYouTubeEmbedUrl(section.videoUrl, { autoplay: true, muted: true }) : null

        return (
          <section key={section.id} className="grid grid-cols-1 gap-1 md:gap-2 lg:grid-cols-2">
            <div className={imageFirst ? "order-2 lg:order-2 rounded-xl border border-slate-100 bg-white p-5 md:p-6" : "order-1 lg:order-1 rounded-xl border border-slate-100 bg-white p-5 md:p-6"}>
              <div className="prose prose-slate max-w-none prose-headings:font-serif prose-a:text-teal-700 hover:prose-a:text-teal-800">
                {selectedDescription ? (
                  <div className="whitespace-pre-line">{selectedDescription}</div>
                ) : (
                  <p>Description is empty.</p>
                )}
              </div>
            </div>
            <div className={imageFirst ? "order-1 lg:order-1 space-y-1" : "order-2 lg:order-2 space-y-1"}>
              {sectionVideoEmbedUrl ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
                  <div className="aspect-video w-full">
                    <iframe
                      src={sectionVideoEmbedUrl}
                      title="Page section video"
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                    />
                  </div>
                </div>
              ) : (
                <div className={`${imageGridClass(selectedImages.length)} gap-1`}>
                  {selectedImages.map((img, imgIndex) => (
                    <div key={`${img.url}-${imgIndex}`} className="flex flex-col">
                      <div className="aspect-square overflow-hidden rounded-md">
                        <img src={img.url} alt={img.title || "Page section image"} className="h-full w-full object-cover" />
                      </div>
                      {img.title.trim().length > 0 ? (
                        <>
                          <div className="mx-[10px] mt-1 border-t border-slate-200" />
                          <p className="pt-0.5 text-[11px] font-medium leading-tight text-slate-700">{img.title}</p>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              {pageVideoEmbedUrl && section.id === firstContentSectionId ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
                  <div className="aspect-video w-full">
                    <iframe
                      src={pageVideoEmbedUrl}
                      title="Page video"
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        )
      })}

      {bodyHtml ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 md:p-8">
          <div
            className="prose prose-lg prose-slate mx-auto max-w-none prose-headings:font-serif prose-a:text-teal-700 hover:prose-a:text-teal-800"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </section>
      ) : null}
    </div>
  )
}
