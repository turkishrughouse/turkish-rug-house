import { redirect } from "next/navigation"
import { getPasswordResetUrl } from "@/lib/password-reset-routes"

type AccountPasswordResetAliasPageProps = {
  searchParams?: Promise<{
    token?: string | string[]
  }>
}

function getToken(token: string | string[] | undefined) {
  return typeof token === "string" ? token : Array.isArray(token) ? token[0] || "" : ""
}

export default async function AccountPasswordResetAliasPage({ searchParams }: AccountPasswordResetAliasPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  redirect(getPasswordResetUrl(getToken(resolvedSearchParams?.token)))
}
