"use client"

import * as React from "react"
import Link from "next/link"

type FooterLink = {
    label: string
    href: string
    children?: FooterLink[]
}

type FooterSection = {
    title: string
    links: FooterLink[]
}

type RecentProduct = {
    id: string
    slug: string
    title: string
    image: string
    price: number
}

type FooterSocialLink = {
    platform: "facebook" | "x" | "instagram" | "youtube" | "tiktok" | "linkedin" | "pinterest"
    label: string
    url: string
}

function SocialBrandIcon({ platform }: { platform: FooterSocialLink["platform"] }) {
    if (platform === "instagram") {
        return (
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#E4405F]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
        )
    }
    if (platform === "youtube") {
        return (
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#FF0000]" fill="currentColor" aria-hidden="true">
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
    return <span className={`text-xl font-bold leading-none ${styleByPlatform[platform]}`}>{textByPlatform[platform]}</span>
}

const normalizeMenuHref = (input?: string) => {
    const value = (input || "").trim()
    if (!value) return "#"
    if (value === "https://" || value === "http://") return "#"
    if (value.startsWith("#")) return value
    if (value.startsWith("/")) return value
    if (value.startsWith("http://") || value.startsWith("https://")) {
        try {
            // Validate absolute URL to prevent Link prefetch runtime crash.
            new URL(value)
            return value
        } catch {
            return "#"
        }
    }
    return `/${value.replace(/^\/+/, "")}`
}

const isSocialLabelOrUrl = (label?: string, url?: string) => {
    const l = (label || "").toLowerCase()
    const u = (url || "").toLowerCase()
    return (
        l.includes("facebook") ||
        l.includes("instagram") ||
        l === "x" ||
        l.includes("twitter") ||
        l.includes("youtube") ||
        l.includes("tiktok") ||
        l.includes("linkedin") ||
        l.includes("pinterest") ||
        u.includes("facebook.com") ||
        u.includes("instagram.com") ||
        u.includes("x.com") ||
        u.includes("twitter.com") ||
        u.includes("youtube.com") ||
        u.includes("youtu.be") ||
        u.includes("tiktok.com") ||
        u.includes("linkedin.com") ||
        u.includes("pinterest.com")
    )
}

type FooterMenuNode = { label?: string; url?: string; children?: FooterMenuNode[] }

const mapFooterLinks = (items?: FooterMenuNode[]): FooterLink[] => {
    if (!Array.isArray(items)) return []
    return items
        .filter((item) => item?.label && item?.url && !isSocialLabelOrUrl(item.label, item.url))
        .map((item) => ({
            label: String(item.label),
            href: normalizeMenuHref(String(item.url)),
            children: mapFooterLinks(item.children),
        }))
}

export function Footer() {
    const [siteName, setSiteName] = React.useState("Turkish Rug House")
    const [tagline, setTagline] = React.useState("Authentic, hand-knotted rugs from the heart of Anatolia. Timeless heritage for your modern home.")
    const [supportEmail, setSupportEmail] = React.useState("info@turkishrughouse.com")
    const [footerSections, setFooterSections] = React.useState<FooterSection[]>([])
    const [recentlyViewed, setRecentlyViewed] = React.useState<RecentProduct[]>([])
    const [footerSocialLinks, setFooterSocialLinks] = React.useState<FooterSocialLink[]>([])

    React.useEffect(() => {
        fetch("/api/public/settings", { cache: "no-store" })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (!data) return
                if (data.siteName) setSiteName(data.siteName)
                if (data.siteTagline) setTagline(data.siteTagline)
                if (data.supportEmail) setSupportEmail(data.supportEmail)
                if (Array.isArray(data.footerSocialLinks)) {
                    const links = data.footerSocialLinks
                        .filter((item: { platform?: string; label?: string; url?: string }) =>
                            item &&
                            typeof item.platform === "string" &&
                            typeof item.label === "string" &&
                            typeof item.url === "string"
                        )
                        .map((item: { platform: string; label: string; url: string }) => ({
                            platform: item.platform as FooterSocialLink["platform"],
                            label: item.label,
                            url: item.url,
                        }))
                    setFooterSocialLinks(links)
                }
            })
            .catch(() => { })
    }, [])

    React.useEffect(() => {
        fetch("/api/public/menus/INFORMATION_FOOTER", { cache: "no-store" })
            .then((res) => (res.ok ? res.json() : null))
            .then((menu) => {
                if (!menu || !Array.isArray(menu.items)) return
                const sections = menu.items
                    .filter((root: { label?: string; url?: string }) => !isSocialLabelOrUrl(root.label, root.url))
                    .map((root: FooterMenuNode) => ({
                        title: root.label || "Section",
                        links: Array.isArray(root.children) && root.children.length > 0
                            ? mapFooterLinks(root.children)
                            : (root.url && !isSocialLabelOrUrl(root.label, root.url) ? [{ label: root.label || "Link", href: normalizeMenuHref(root.url) }] : []),
                    }))
                    .filter((section: FooterSection) => section.title && section.links.length > 0)
                setFooterSections(sections)
            })
            .catch(() => { })
    }, [])

    React.useEffect(() => {
        const readRecentlyViewed = () => {
            if (typeof window === "undefined") return
            try {
                const raw = window.localStorage.getItem("rughouse_recently_viewed_products")
                const parsed = raw ? JSON.parse(raw) : []
                const safe = Array.isArray(parsed) ? parsed : []
                setRecentlyViewed(
                    safe
                        .filter((item) => item && typeof item.slug === "string" && typeof item.title === "string")
                        .slice(0, 3)
                        .map((item) => ({
                            id: String(item.id || item.slug),
                            slug: String(item.slug),
                            title: String(item.title),
                            image: String(item.image || "/placeholder.jpg"),
                            price: Number(item.price || 0),
                        }))
                )
            } catch {
                setRecentlyViewed([])
            }
        }

        readRecentlyViewed()
        window.addEventListener("focus", readRecentlyViewed)
        window.addEventListener("storage", readRecentlyViewed)
        window.addEventListener("pageshow", readRecentlyViewed)
        window.addEventListener("rughouse:recently-viewed-updated", readRecentlyViewed)
        return () => {
            window.removeEventListener("focus", readRecentlyViewed)
            window.removeEventListener("storage", readRecentlyViewed)
            window.removeEventListener("pageshow", readRecentlyViewed)
            window.removeEventListener("rughouse:recently-viewed-updated", readRecentlyViewed)
        }
    }, [])

    const paymentBadges = ["VISA", "MASTERCARD", "AMEX", "DISCOVER", "PAYPAL", "GPAY", "STRIPE", "APPLEPAY"] as const

    const fallbackSections: FooterSection[] = [
        {
            title: "Shop",
            links: [
                { label: "Shop All", href: "/shop" },
                { label: "Shipping", href: "/info/shipping" },
                { label: "Returns", href: "/info/returns" },
                { label: "Collections", href: "/products" },
                { label: "Wholesale", href: "/support" },
            ],
        },
        {
            title: "About",
            links: [
                { label: "Our story", href: "/info/about" },
                { label: "Blog", href: "/info/blog" },
                { label: "Jobs", href: "/support" },
                { label: "Privacy policy", href: "/info/privacy-policy" },
                { label: "Terms and conditions", href: "/info/terms-and-conditions" },
            ],
        },
        {
            title: "Help",
            links: [
                { label: "Tutorials", href: "/support" },
                { label: "Office hours", href: "/info/contact" },
                { label: "FAQ", href: "/faq" },
                { label: "Contact us", href: "/info/contact" },
            ],
        },
    ]
    const renderedSections = footerSections.length > 0 ? footerSections : fallbackSections
    const desktopColumnCount = renderedSections.length + 2
    const renderLinks = (links: FooterLink[], level = 0) => (
        <ul className={level === 0 ? "mt-3 space-y-1.5 text-sm text-slate-700" : "mt-1 space-y-1 pl-3 text-xs text-slate-600"}>
            {links.map((link, index) => (
                <li key={`${link.href}-${link.label}-${level}-${index}`}>
                    <Link href={link.href} className="transition-colors hover:text-red-600">
                        {link.label}
                    </Link>
                    {Array.isArray(link.children) && link.children.length > 0 ? renderLinks(link.children, level + 1) : null}
                </li>
            ))}
        </ul>
    )

    return (
        <footer className="mt-10 border-t border-slate-200 bg-[#f3f5f8] text-slate-800">
            <div className="w-full px-[3vw] py-10">
                <div
                    className="grid grid-cols-2 gap-x-6 gap-y-8 lg:gap-y-0 lg:[grid-template-columns:repeat(var(--footer-cols),minmax(0,1fr))]"
                    style={{ ["--footer-cols" as string]: String(desktopColumnCount) }}
                >
                    <div className="col-span-2 w-full space-y-4 border-b border-slate-200 pb-5 text-left lg:col-span-1 lg:border-b-0 lg:pb-0 lg:pr-6 lg:border-r">
                        <h3 className="font-serif text-xl font-bold text-slate-900">{siteName}</h3>
                        <p className="max-w-xs text-[13px] leading-6 text-slate-600">
                            {tagline}
                        </p>
                        <a href={`mailto:${supportEmail}`} className="inline-block text-[13px] text-slate-600 transition-colors hover:text-red-600">
                            {supportEmail}
                        </a>
                        {footerSocialLinks.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-3 pt-1">
                                {footerSocialLinks.map((item) => (
                                    <a
                                        key={`${item.platform}-${item.url}`}
                                        href={item.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-transparent transition-colors hover:border-red-300 hover:bg-white"
                                        aria-label={item.label}
                                        title={item.label}
                                    >
                                        <SocialBrandIcon platform={item.platform} />
                                    </a>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    {renderedSections.map((section, index) => (
                        <div key={`${section.title}-${index}`} className="w-full border-b border-slate-200 pb-4 text-center lg:border-b-0 lg:pb-0 lg:px-4 lg:border-r">
                            <h4 className="text-sm font-semibold tracking-wide text-slate-700">{section.title}</h4>
                            {renderLinks(section.links)}
                        </div>
                    ))}

                    <div className="col-span-2 w-full border-b border-slate-200 pb-4 text-left lg:col-span-1 lg:border-b-0 lg:pb-0 lg:pl-6">
                        <h4 className="text-center text-sm font-semibold tracking-wide text-slate-700 lg:text-left">Recently Viewed</h4>
                        {recentlyViewed.length === 0 ? (
                            <p className="mt-3 text-xs text-slate-500">No viewed products yet.</p>
                        ) : (
                            <div className="mt-3 space-y-1.5 lg:ml-auto lg:max-w-[230px]">
                                {recentlyViewed.map((item) => (
                                    <Link key={item.id} href={`/product/${item.slug}`} className="flex items-center justify-start gap-2 rounded-md border border-slate-200 bg-white p-1.5 transition-colors hover:border-red-200 hover:bg-red-50/40">
                                        <img src={item.image || "/placeholder.jpg"} alt={item.title} className="h-8 w-8 rounded object-cover border border-slate-200" />
                                        <div className="min-w-0 text-left">
                                            <p className="line-clamp-1 text-[11px] font-medium text-slate-800 hover:text-red-600">{item.title}</p>
                                            <p className="text-[10px] text-emerald-700">${item.price.toFixed(2)}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-200">
                <div className="w-full flex flex-col gap-3 px-[3vw] py-4 md:flex-row md:items-center md:justify-between">
                    <p className="text-[11px] text-slate-600">&copy; 2026, Turkish Rug House</p>
                    <div className="flex flex-wrap items-center justify-start gap-1.5 md:ml-auto md:justify-end">
                        {paymentBadges.map((badge) => (
                            <span
                                key={badge}
                                className="inline-flex h-10 min-w-[78px] items-center justify-center rounded-[4px] border border-slate-300 bg-[#eef1f4] px-2 text-[#1f2937]"
                            >
                                {badge === "VISA" ? (
                                    <span className="text-[16px] font-black tracking-tight italic">VISA</span>
                                ) : null}
                                {badge === "MASTERCARD" ? (
                                    <span className="inline-flex flex-col items-center justify-center leading-none">
                                        <span className="relative inline-flex h-5 w-10 items-center justify-center">
                                            <span className="absolute left-1 h-5 w-5 rounded-full bg-[#111827]/90" />
                                            <span className="absolute right-1 h-5 w-5 rounded-full bg-[#111827]/70" />
                                        </span>
                                        <span className="mt-0.5 text-[7px] font-semibold lowercase tracking-tight">mastercard</span>
                                    </span>
                                ) : null}
                                {badge === "AMEX" ? (
                                    <span className="inline-flex flex-col items-center text-[9px] font-black leading-[0.9] tracking-tight">
                                        <span>AMERICAN</span>
                                        <span>EXPRESS</span>
                                    </span>
                                ) : null}
                                {badge === "DISCOVER" ? (
                                    <span className="relative inline-flex flex-col items-center text-[11px] font-black tracking-tight leading-none">
                                        <span>DISCOVER</span>
                                        <span className="mt-0.5 h-[2px] w-10 rounded-full bg-gradient-to-r from-[#f59e0b] via-[#fb923c] to-[#f97316]" />
                                    </span>
                                ) : null}
                                {badge === "PAYPAL" ? (
                                    <span className="text-[12px] font-black italic tracking-tight">PayPal</span>
                                ) : null}
                                {badge === "GPAY" ? (
                                    <span className="inline-flex items-center text-[11px] font-black tracking-tight">
                                        <span className="text-[#4285F4]">G</span>
                                        <span className="text-[#DB4437]">P</span>
                                        <span className="text-[#F4B400]">a</span>
                                        <span className="text-[#0F9D58]">y</span>
                                    </span>
                                ) : null}
                                {badge === "STRIPE" ? (
                                    <span className="text-[12px] font-black lowercase tracking-tight">stripe</span>
                                ) : null}
                                {badge === "APPLEPAY" ? (
                                    <span className="text-[11px] font-black tracking-tight">Apple Pay</span>
                                ) : null}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    )
}
