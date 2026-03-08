"use client"

import Link from "next/link"

type PageBannerProps = {
  title: string
  subtitle?: string
  image?: string | null
  className?: string
  size?: "default" | "tall"
  imageClassName?: string
}

export function PageBanner({ title, subtitle, image, className = "", size = "tall", imageClassName = "object-center" }: PageBannerProps) {
  const bannerImage = image && image.trim().length > 0 ? image : "/placeholder.jpg"
  const contentPaddingClass = size === "tall" ? "py-20 md:py-24" : "py-14 md:py-16"

  return (
    <section className={`relative overflow-hidden border-b border-slate-200 ${className}`}>
      <img src={bannerImage} alt={title} className={`absolute inset-0 h-full w-full object-cover ${imageClassName}`} />
      <div className="absolute inset-0 bg-black/40" />
      <div className={`relative z-10 container mx-auto px-6 ${contentPaddingClass}`}>
        <h1 className="text-3xl font-bold text-white md:text-4xl">{title}</h1>
        {subtitle ? (
          <p className="mt-3 max-w-3xl text-sm text-white/90 md:text-base">{subtitle}</p>
        ) : null}
        <div className="mt-4 flex items-center gap-2 text-sm text-white/85">
          <Link href="/" className="hover:text-white">
            Home
          </Link>
          <span>/</span>
          <span className="font-medium text-white">{title}</span>
        </div>
      </div>
    </section>
  )
}
