"use client"

import Link from "next/link"
import { useSyncExternalStore } from "react"
import {
  ArrowRight,
  FolderTree,
  ImageIcon,
  MessageSquare,
  Newspaper,
  Package2,
  Settings,
  ShoppingBag,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type DashboardCard = {
  title: string
  titleTr: string
  description: string
  descriptionTr: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const DASHBOARD_CARD =
  "rounded-[28px] border border-[#dce3ed] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.05)]"

const quickActions: DashboardCard[] = [
  {
    title: "Add product",
    titleTr: "Ürün ekle",
    description: "Create a new rug listing and manage SKU, images, and pricing.",
    descriptionTr: "Yeni bir ürün oluştur, SKU, görseller ve fiyatı yönet.",
    href: "/dashboard/products/new",
    icon: ShoppingBag,
  },
  {
    title: "Manage media",
    titleTr: "Medyayı yönet",
    description: "Upload assets, organize folders, and assign images safely.",
    descriptionTr: "Dosya yükle, klasörleri düzenle ve görselleri güvenli şekilde ata.",
    href: "/dashboard/media",
    icon: ImageIcon,
  },
  {
    title: "Edit categories",
    titleTr: "Kategorileri düzenle",
    description: "Maintain the rug taxonomy, hierarchy, and category imagery.",
    descriptionTr: "Kategori ağacını, hiyerarşiyi ve kategori görsellerini yönet.",
    href: "/dashboard/products/categories",
    icon: FolderTree,
  },
]

const managementAreas: DashboardCard[] = [
  {
    title: "Products",
    titleTr: "Ürünler",
    description: "Review the catalog, stock, drafts, featured products, and imports.",
    descriptionTr: "Kataloğu, stokları, taslakları, öne çıkan ürünleri ve importları kontrol et.",
    href: "/dashboard/products",
    icon: Package2,
  },
  {
    title: "Orders",
    titleTr: "Siparişler",
    description: "Track order flow, reports, coupons, and operational follow-up.",
    descriptionTr: "Sipariş akışını, raporları, kuponları ve operasyon takibini yönet.",
    href: "/dashboard/orders",
    icon: ShoppingBag,
  },
  {
    title: "Messages",
    titleTr: "Mesajlar",
    description: "Monitor customer communication without leaving the admin workflow.",
    descriptionTr: "Müşteri iletişimini admin akışından çıkmadan takip et.",
    href: "/dashboard/messages",
    icon: MessageSquare,
  },
  {
    title: "Blog",
    titleTr: "Blog",
    description: "Publish editorial content that supports storytelling and SEO.",
    descriptionTr: "Hikaye anlatımını ve SEO’yu destekleyen blog içeriklerini yayınla.",
    href: "/dashboard/blog",
    icon: Newspaper,
  },
  {
    title: "Pages",
    titleTr: "Sayfalar",
    description: "Maintain storefront content pages and static brand sections.",
    descriptionTr: "Site içerik sayfalarını ve marka bölümlerini düzenle.",
    href: "/dashboard/pages",
    icon: FolderTree,
  },
  {
    title: "Settings",
    titleTr: "Ayarlar",
    description: "Control storefront behavior, payment settings, and global configuration.",
    descriptionTr: "Storefront davranışını, ödeme ayarlarını ve genel yapılandırmayı kontrol et.",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

function subscribeToLang() {
  return () => {}
}

function getLangSnapshot() {
  if (typeof document === "undefined") return "en"
  return document.documentElement.lang.toLowerCase().startsWith("tr") ? "tr" : "en"
}

function DashboardLinkCard({
  item,
  lang,
  priority = false,
}: {
  item: DashboardCard
  lang: "tr" | "en"
  priority?: boolean
}) {
  const Icon = item.icon
  const title = lang === "tr" ? item.titleTr : item.title
  const description = lang === "tr" ? item.descriptionTr : item.description

  return (
    <Link
      href={item.href}
      className={`group block rounded-[28px] border border-[#dce3ed] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_36px_rgba(15,23,42,0.08)] ${
        priority ? "bg-[#0f172a] text-white" : "bg-white text-slate-900"
      }`}
    >
      <div className="flex h-full flex-col justify-between p-6">
        <div className="space-y-4">
          <div
            className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${
              priority ? "bg-white/10 text-white" : "bg-[#f4f7fb] text-[#0f766e]"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h2 className={`text-xl font-semibold ${priority ? "text-white" : "text-slate-900"}`}>{title}</h2>
            <p className={`text-sm leading-6 ${priority ? "text-slate-200" : "text-slate-600"}`}>{description}</p>
          </div>
        </div>
        <div
          className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold ${
            priority ? "text-white" : "text-[#0f766e]"
          }`}
        >
          <span>{lang === "tr" ? "Aç" : "Open"}</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  )
}

export default function AdminDashboardPage() {
  const lang = useSyncExternalStore(subscribeToLang, getLangSnapshot, () => "en") as "tr" | "en"

  return (
    <div className="min-h-full bg-[#f4f7fb] px-6 py-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <Card className={DASHBOARD_CARD}>
          <CardHeader className="space-y-3 pb-2">
            <div className="inline-flex w-fit items-center rounded-full border border-[#dce3ed] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#0f766e]">
              Turkish Rug House
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl font-semibold tracking-tight text-slate-900">
                {lang === "tr" ? "Yönetim Merkezi" : "Admin Operations Hub"}
              </CardTitle>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                {lang === "tr"
                  ? "Ürün, kategori, medya ve içerik operasyonlarını tek yerden yönetin. Bu ekran hızlı başlangıç ve günlük yönetim için sade tutuldu."
                  : "Manage products, categories, media, and content from one place. This dashboard is intentionally kept focused for daily operations."}
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {quickActions.map((item, index) => (
              <DashboardLinkCard key={item.href} item={item} lang={lang} priority={index === 0} />
            ))}
          </CardContent>
        </Card>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
          <Card className={DASHBOARD_CARD}>
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-slate-900">
                {lang === "tr" ? "Yönetim Alanları" : "Management Areas"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {managementAreas.map((item) => (
                <DashboardLinkCard key={item.href} item={item} lang={lang} />
              ))}
            </CardContent>
          </Card>

          <Card className={DASHBOARD_CARD}>
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-slate-900">
                {lang === "tr" ? "Çalışma Notu" : "Workspace Note"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-slate-600">
              <p>
                {lang === "tr"
                  ? "Eski genel dashboard metrik kartları ve canlı harita kaldırıldı. Bu alan artık sahte enterprise widget yerine doğrudan operasyon akışına giriş sağlar."
                  : "The previous generic KPI cards and live map were removed. This page now acts as a focused entry point into real admin operations instead of showing placeholder enterprise widgets."}
              </p>
              <div className="rounded-2xl border border-dashed border-[#dce3ed] bg-[#f8fafc] p-4">
                <p className="font-medium text-slate-900">
                  {lang === "tr" ? "Önerilen akış" : "Recommended flow"}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>{lang === "tr" ? "1. Yeni ürünleri Ürünler bölümünden oluşturun." : "1. Create new rugs from Products."}</li>
                  <li>{lang === "tr" ? "2. Görsel düzenini Medya bölümünden yönetin." : "2. Manage imagery from Media."}</li>
                  <li>{lang === "tr" ? "3. Kategori ve içerik yapısını ilgili panellerden koruyun." : "3. Maintain category and content structure from the dedicated panels."}</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
