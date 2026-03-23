"use client"

import { useState } from "react"
import Image from "next/image"

type StorefrontProductImageProps = {
  candidates: string[]
  alt: string
  className?: string
  fill?: boolean
  width?: number
  height?: number
  sizes: string
  priority?: boolean
}

export function StorefrontProductImage({
  candidates,
  alt,
  className,
  fill = false,
  width,
  height,
  sizes,
  priority = false,
}: StorefrontProductImageProps) {
  const sources = Array.from(new Set(candidates.map((value) => value.trim()).filter(Boolean)))
  const [index, setIndex] = useState(0)
  const src = sources[index] || "/placeholder.jpg"

  const handleError = () => {
    setIndex((prev) => (prev + 1 < sources.length ? prev + 1 : prev))
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        priority={priority}
        quality={75}
        unoptimized={src.startsWith("/uploads/") || /^https?:\/\//i.test(src)}
        onError={handleError}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width || 1200}
      height={height || 1200}
      sizes={sizes}
      className={className}
      priority={priority}
      quality={75}
      unoptimized={src.startsWith("/uploads/") || /^https?:\/\//i.test(src)}
      onError={handleError}
    />
  )
}
