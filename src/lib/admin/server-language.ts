import { getSessionUser } from "@/lib/auth-server"
import { prisma } from "@/lib/db"
import { adminText, resolveAdminLanguage, type AdminLanguage } from "@/lib/admin/i18n"

export async function getAdminLanguage(): Promise<AdminLanguage> {
  const user = await getSessionUser("admin")
  if (!user) return "en"

  const profile = await prisma.customerProfile
    .findUnique({
      where: { userId: user.id },
      select: { locale: true },
    })
    .catch(() => null)

  return resolveAdminLanguage(profile?.locale)
}

export async function getAdminI18n() {
  const lang = await getAdminLanguage()
  return { lang, t: adminText[lang] }
}
