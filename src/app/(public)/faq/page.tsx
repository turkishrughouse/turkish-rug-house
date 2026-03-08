import { HelpCenterPage } from "@/components/storefront/support/help-center-page"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function FaqPage() {
  const faqPage = await prisma.page.findFirst({
    where: {
      status: "PUBLISHED",
      slug: { in: ["faq", "help-center", "help"] },
    },
    select: {
      title: true,
      excerpt: true,
      featuredImage: true,
    },
    orderBy: {
      slug: "asc",
    },
  })

  return (
    <HelpCenterPage
      bannerTitle={faqPage?.title || "Help Center"}
      bannerSubtitle={faqPage?.excerpt || "Find quick answers to common questions."}
      bannerImage={faqPage?.featuredImage || null}
    />
  )
}
