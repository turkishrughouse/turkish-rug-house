"use client"

import { useEffect } from "react"

export function ActivityPing() {
  useEffect(() => {
    let stopped = false
    let lastHoverLabel = ""
    let lastHoverType = ""

    const normalizeText = (value: string) =>
      value.replace(/\s+/g, " ").trim().slice(0, 120)

    const resolveHoverTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return

      const candidate = target.closest<HTMLElement>("[data-rh-track], [data-product-title], [data-category-title], a, button, h1, h2, h3, h4")
      if (!candidate) return

      const dataLabel =
        candidate.dataset.rhTrack ||
        candidate.dataset.productTitle ||
        candidate.dataset.categoryTitle ||
        ""
      const text = normalizeText(dataLabel || candidate.innerText || candidate.textContent || "")
      if (!text) return

      let type = "Text"
      if (candidate.dataset.productTitle) type = "Product"
      else if (candidate.dataset.categoryTitle) type = "Category"
      else if (candidate.tagName === "A") {
        const href = candidate.getAttribute("href") || ""
        if (href.includes("/product/")) type = "Product"
        else if (href.includes("/category/")) type = "Category"
        else type = "Link"
      } else if (candidate.tagName === "BUTTON") type = "Button"
      else if (/^H[1-4]$/.test(candidate.tagName)) type = "Heading"

      lastHoverLabel = text
      lastHoverType = type
    }

    const detectCountryHint = () => {
      try {
        const locale = (navigator.language || "").toLowerCase()
        if (locale.endsWith("-tr")) return "TR"
        if (locale.endsWith("-us")) return "US"

        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""
        if (tz.includes("Istanbul")) return "TR"
        if (
          tz.includes("New_York") ||
          tz.includes("Chicago") ||
          tz.includes("Denver") ||
          tz.includes("Los_Angeles") ||
          tz.includes("Anchorage") ||
          tz.includes("Honolulu")
        ) {
          return "US"
        }
      } catch {
        // ignore client env issues
      }
      return ""
    }

    const ping = async () => {
      try {
        const countryHint = detectCountryHint()
        await fetch("/api/account/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            country: countryHint || undefined,
            path: window.location.pathname,
            href: window.location.href,
            pageTitle: document.title || undefined,
            hoverLabel: lastHoverLabel || undefined,
            hoverType: lastHoverType || undefined,
          }),
          credentials: "include",
          cache: "no-store",
        })
      } catch {
        // ignore ping errors
      }
    }

    const run = () => {
      if (stopped) return
      if (document.visibilityState !== "visible") return
      ping()
    }

    run()
    const timer = setInterval(run, 8000)
    const onVisible = () => {
      if (document.visibilityState === "visible") run()
    }

    const onMouseOver = (event: MouseEvent) => resolveHoverTarget(event.target)
    document.addEventListener("visibilitychange", onVisible)
    document.addEventListener("mouseover", onMouseOver, { passive: true })
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      document.removeEventListener("mouseover", onMouseOver)
    }
  }, [])

  return null
}
