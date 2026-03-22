import Image from "next/image"

type ResponsiveImageProps = {
  src: string
  alt: string
  sizes: string
  className?: string
  fill?: boolean
  width?: number
  height?: number
  priority?: boolean
  quality?: number
  unoptimized?: boolean
}

function isRemoteSource(src: string) {
  return /^https?:\/\//i.test(src)
}

export function ResponsiveImage({
  src,
  alt,
  sizes,
  className,
  fill = false,
  width,
  height,
  priority = false,
  quality = 80,
  unoptimized,
}: ResponsiveImageProps) {
  const resolvedSrc = src && src.trim().length > 0 ? src : "/placeholder.jpg"
  const shouldSkipOptimization = unoptimized ?? (isRemoteSource(resolvedSrc) || resolvedSrc.startsWith("/uploads/"))

  if (fill) {
    return (
      <Image
        src={resolvedSrc}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        priority={priority}
        quality={quality}
        unoptimized={shouldSkipOptimization}
      />
    )
  }

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      width={width || 1200}
      height={height || 1200}
      sizes={sizes}
      className={className}
      priority={priority}
      quality={quality}
      unoptimized={shouldSkipOptimization}
    />
  )
}
