"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { PLACEHOLDER_IMAGE_URL, safeImages } from "@/lib/product-images"

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
  const sources = useMemo(() => {
    const normalized = safeImages(candidates)
    return normalized.length > 0 ? normalized : [PLACEHOLDER_IMAGE_URL]
  }, [candidates])
  const sourceKey = sources.join("|")
  const [failedBySourceKey, setFailedBySourceKey] = useState<Record<string, number>>({})
  const index = failedBySourceKey[sourceKey] ?? 0
  const src = sources[index] || PLACEHOLDER_IMAGE_URL

  const handleError = () => {
    setFailedBySourceKey((prev) => {
      const currentIndex = prev[sourceKey] ?? 0
      const nextIndex = currentIndex + 1 < sources.length ? currentIndex + 1 : currentIndex
      if (nextIndex === currentIndex) return prev
      return { ...prev, [sourceKey]: nextIndex }
    })
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
        unoptimized={src.startsWith("/uploads/") || src === PLACEHOLDER_IMAGE_URL || /^https?:\/\//i.test(src)}
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
      unoptimized={src.startsWith("/uploads/") || src === PLACEHOLDER_IMAGE_URL || /^https?:\/\//i.test(src)}
      onError={handleError}
    />
  )
}
