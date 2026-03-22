import Link from "next/link"

import { FooterRecentlyViewed } from "@/components/storefront/footer-recently-viewed"
import { getSiteSettings, type FooterSocialLink } from "@/lib/site-settings"
import { getPublicMenu, type PublicMenuNode } from "@/lib/storefront/public-menu"

type FooterLink = {
  label: string
  href: string
  children?: FooterLink[]
}

type FooterSection = {
  title: string
  links: FooterLink[]
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

function isSocialLabelOrUrl(label?: string, url?: string) {
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

function mapFooterLinks(items?: PublicMenuNode[]): FooterLink[] {
  if (!Array.isArray(items)) return []
  return items
    .filter((item) => item?.label && item?.url && !isSocialLabelOrUrl(item.label, item.url))
    .map((item) => ({
      label: item.label,
      href: item.url,
      children: mapFooterLinks(item.children),
    }))
}

export async function Footer() {
  const [settings, footerMenu] = await Promise.all([
    getSiteSettings(),
    getPublicMenu("INFORMATION_FOOTER"),
  ])

  const footerSections = footerMenu
    .filter((root) => !isSocialLabelOrUrl(root.label, root.url))
    .map((root) => ({
      title: root.label || "Section",
      links: Array.isArray(root.children) && root.children.length > 0
        ? mapFooterLinks(root.children)
        : (root.url && !isSocialLabelOrUrl(root.label, root.url) ? [{ label: root.label || "Link", href: root.url }] : []),
    }))
    .filter((section) => section.title && section.links.length > 0)

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
  const paymentBadges = ["VISA", "MASTERCARD", "AMEX", "DISCOVER", "PAYPAL", "GPAY", "STRIPE", "APPLEPAY"] as const

  const renderLinks = (links: FooterLink[], level = 0): React.ReactNode => (
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
            <h3 className="font-serif text-xl font-bold text-slate-900">{settings.siteName}</h3>
            <p className="max-w-xs text-[13px] leading-6 text-slate-600">
              {settings.siteTagline}
            </p>
            <a href={`mailto:${settings.supportEmail}`} className="inline-block text-[13px] text-slate-600 transition-colors hover:text-red-600">
              {settings.supportEmail}
            </a>
            {settings.footerSocialLinks.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {settings.footerSocialLinks.map((item) => (
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
            <FooterRecentlyViewed />
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
                  <span className="text-[12px] font-semibold tracking-tight">G Pay</span>
                ) : null}
                {badge === "STRIPE" ? (
                  <span className="text-[12px] font-black tracking-[0.06em]">stripe</span>
                ) : null}
                {badge === "APPLEPAY" ? (
                  <span className="text-[11px] font-semibold tracking-tight">Apple Pay</span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
