import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { isAdminRole } from "@/lib/rbac"
import { prisma } from "@/lib/db"
import { AdminProfileForm } from "@/components/admin/profile/admin-profile-form"

function splitNamePieces(input: string | null | undefined) {
  const safe = (input || "").trim()
  if (!safe) return { firstName: "", lastName: "" }
  const parts = safe.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: safe, lastName: "" }
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  }
}

export default async function AdminProfilePage() {
  const user = await getSessionUser("admin")
  if (!user || !isAdminRole(user.role)) {
    redirect("/rughouse/login")
  }

  const foundProfile = await prisma.customerProfile.findUnique({
    where: { userId: user.id },
    select: {
      avatarUrl: true,
      firstName: true,
      lastName: true,
      nickname: true,
      displayName: true,
      website: true,
      bioEn: true,
      bioTr: true,
      locale: true,
      disableSyntaxHighlighting: true,
      enableKeyboardShortcuts: true,
      showToolbar: true,
      adminColorScheme: true,
    },
  })

  const fallbackUserName = user.name?.trim() || user.email.split("@")[0]
  const fallbackNames = splitNamePieces(user.name || fallbackUserName)
  const profile = foundProfile
    ? foundProfile
    : await prisma.customerProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          firstName: fallbackNames.firstName || undefined,
          lastName: fallbackNames.lastName || undefined,
          nickname: fallbackUserName,
          displayName: fallbackUserName,
          locale: "en_US",
          disableSyntaxHighlighting: false,
          enableKeyboardShortcuts: false,
          showToolbar: true,
          adminColorScheme: "default",
        },
        update: {},
        select: {
          avatarUrl: true,
          firstName: true,
          lastName: true,
          nickname: true,
          displayName: true,
          website: true,
          bioEn: true,
          bioTr: true,
          locale: true,
          disableSyntaxHighlighting: true,
          enableKeyboardShortcuts: true,
          showToolbar: true,
          adminColorScheme: true,
        },
      })

  const username = user.name?.trim() || user.email.split("@")[0]
  const defaultNames = splitNamePieces(user.name || username)
  const nickname = profile?.nickname || username
  const displayName = profile?.displayName || user.name || nickname

  return (
    <div className="flex-1 p-8 pt-6">
      <AdminProfileForm
        initialProfile={{
          id: user.id,
          username,
          name: user.name || username,
          email: user.email,
          firstName: profile?.firstName || defaultNames.firstName || "",
          lastName: profile?.lastName || defaultNames.lastName || "",
          nickname,
          displayName,
          website: profile?.website || "",
          bioEn: profile?.bioEn || "",
          bioTr: profile?.bioTr || "",
          avatarUrl: profile?.avatarUrl || "",
          locale: profile?.locale || "en_US",
          disableSyntaxHighlighting: profile?.disableSyntaxHighlighting ?? false,
          enableKeyboardShortcuts: profile?.enableKeyboardShortcuts ?? false,
          showToolbar: profile?.showToolbar ?? true,
          adminColorScheme:
            (profile?.adminColorScheme as
              | "default"
              | "light"
              | "modern"
              | "blue"
              | "coffee"
              | "ectoplasm"
              | "midnight"
              | "ocean"
              | "sunrise"
              | undefined) || "default",
        }}
      />
    </div>
  )
}
