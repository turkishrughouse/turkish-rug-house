import type { FooterSocialLink } from "@/lib/site-settings"

type MaintenanceScreenProps = {
  title: string
  message: string
  imageUrl: string
  socialLinks?: FooterSocialLink[]
}

function SocialBrandIcon({ platform }: { platform: FooterSocialLink["platform"] }) {
  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-[#E4405F]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  if (platform === "youtube") {
    return (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-[#FF0000]" fill="currentColor" aria-hidden="true">
        <path d="M23 12s0-3.4-.43-5.03a2.6 2.6 0 0 0-1.84-1.84C19.1 4.7 12 4.7 12 4.7s-7.1 0-8.73.43A2.6 2.6 0 0 0 1.43 6.97C1 8.6 1 12 1 12s0 3.4.43 5.03a2.6 2.6 0 0 0 1.84 1.84c1.63.43 8.73.43 8.73.43s7.1 0 8.73-.43a2.6 2.6 0 0 0 1.84-1.84C23 15.4 23 12 23 12z" />
        <path d="M10 15.5v-7l6 3.5-6 3.5z" fill="#fff" />
      </svg>
    )
  }

  const styleByPlatform: Record<FooterSocialLink["platform"], string> = {
    facebook: "text-[#1877F2]",
    x: "text-[#111111]",
    instagram: "",
    youtube: "",
    tiktok: "text-[#00F2EA]",
    linkedin: "text-[#0A66C2]",
    pinterest: "text-[#E60023]",
  }

  const textByPlatform: Record<FooterSocialLink["platform"], string> = {
    facebook: "f",
    x: "X",
    instagram: "",
    youtube: "",
    tiktok: "♪",
    linkedin: "in",
    pinterest: "P",
  }

  return <span className={`text-lg font-bold leading-none ${styleByPlatform[platform]}`}>{textByPlatform[platform]}</span>
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
                      <SocialBrandIcon platform={link.platform} />
                    </a>
                  ))
                ) : (
                  <>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 transition hover:bg-white"><SocialBrandIcon platform="instagram" /></span>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 transition hover:bg-white"><SocialBrandIcon platform="linkedin" /></span>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 transition hover:bg-white"><SocialBrandIcon platform="youtube" /></span>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 transition hover:bg-white"><SocialBrandIcon platform="facebook" /></span>
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
