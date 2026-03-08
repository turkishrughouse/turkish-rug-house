type EmbedOptions = {
  autoplay?: boolean
  muted?: boolean
}

export function extractYouTubeVideoId(input: string | null | undefined): string | null {
  const value = (input || "").trim()
  if (!value) return null

  const clean = value.replace(/^@/, "").trim()

  // Direct ID support
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return clean
  }

  try {
    const url = new URL(clean)
    const host = url.hostname.replace(/^www\./, "").toLowerCase()

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] || ""
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = url.searchParams.get("v") || ""
      if (/^[a-zA-Z0-9_-]{11}$/.test(v)) return v

      const parts = url.pathname.split("/").filter(Boolean)
      const markerIndex = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live")
      if (markerIndex >= 0 && parts[markerIndex + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[markerIndex + 1])) {
        return parts[markerIndex + 1]
      }
    }
  } catch {
    return null
  }

  return null
}

export function buildYouTubeEmbedUrl(input: string | null | undefined, options: EmbedOptions = {}): string | null {
  const id = extractYouTubeVideoId(input)
  if (!id) return null

  const autoplay = options.autoplay ? "1" : "0"
  const muted = options.muted ?? options.autoplay ? "1" : "0"
  const params = new URLSearchParams({
    autoplay,
    mute: muted,
    rel: "0",
    playsinline: "1",
    modestbranding: "1",
    controls: "0",
    iv_load_policy: "3",
    fs: "0",
    disablekb: "1",
    cc_load_policy: "0",
    loop: "1",
    playlist: id,
  })

  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`
}
