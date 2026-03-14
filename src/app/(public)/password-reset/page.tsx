import { redirect } from "next/navigation"
import { getPasswordResetUrl } from "@/lib/password-reset-routes"

type PasswordResetAliasPageProps = {
  searchParams?: Promise<{
    token?: string | string[]
  }>
}

function getToken(token: string | string[] | undefined) {
  return typeof token === "string" ? token : Array.isArray(token) ? token[0] || "" : ""
}

export default async function PasswordResetAliasPage({ searchParams }: PasswordResetAliasPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  redirect(getPasswordResetUrl(getToken(resolvedSearchParams?.token)))
}
