import type { FooterSocialLink } from "@/lib/site-settings"

type MaintenanceScreenProps = {
  title: string
  message: string
  imageUrl: string
  socialLinks?: FooterSocialLink[]
}

const socialIconMap: Record<string, string> = {
  instagram: "ig",
  linkedin: "in",
  youtube: "yt",
  facebook: "f",
  x: "x",
  tiktok: "tt",
  pinterest: "p",
}

export function MaintenanceScreen({ title, message, imageUrl, socialLinks = [] }: MaintenanceScreenProps) {
  const visibleLinks = socialLinks.slice(0, 4)

  return (
    <section className="min-h-screen w-full bg-[#f3f4f6]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <div className="relative min-h-[340px] bg-slate-900">
          <img src={imageUrl || "/placeholder.jpg"} alt="Maintenance" className="h-full w-full object-cover" />
        </div>

        <div className="flex items-center bg-[#f3f4f6] px-8 py-12 lg:px-16">
          <div className="w-full max-w-[640px]">
            <span className="inline-flex rounded-full border border-amber-300 px-4 py-1 text-xs font-semibold tracking-[0.12em] text-amber-700">
              MAINTENANCE
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-slate-900 lg:text-5xl">{title}</h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">{message}</p>

            <div className="mt-7 border-t border-slate-200 pt-6">
              <div className="flex flex-wrap items-center gap-3">
                {visibleLinks.length > 0 ? (
                  visibleLinks.map((link) => (
                    <a
                      key={`${link.platform}-${link.url}`}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-sm font-semibold uppercase text-slate-500 transition hover:bg-white"
                    >
                      {socialIconMap[link.platform] || "o"}
                    </a>
                  ))
                ) : (
                  <>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-sm font-semibold uppercase text-slate-500">ig</span>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-sm font-semibold uppercase text-slate-500">in</span>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-sm font-semibold uppercase text-slate-500">yt</span>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-sm font-semibold uppercase text-slate-500">f</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
