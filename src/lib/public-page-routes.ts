function normalizeSlug(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase()
}

export function resolvePublicPageHref(slug: string | null | undefined) {
  const safeSlug = normalizeSlug(slug)
  if (!safeSlug) return "/"

  if (safeSlug === "about" || safeSlug === "about-us") return "/info/about"
  if (safeSlug === "faq" || safeSlug === "help" || safeSlug === "help-center") return "/faq"
  if (safeSlug === "privacy-policy") return "/privacy-policy"
  if (safeSlug === "terms-and-conditions" || safeSlug === "terms-conditions") return "/terms-and-conditions"
  if (safeSlug === "returns" || safeSlug === "return-policy") return "/returns"

  return `/info/${safeSlug}`
}

