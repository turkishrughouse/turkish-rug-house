import { redirect } from "next/navigation"
import { getPasswordResetUrl } from "@/lib/password-reset-routes"

type ResetPasswordAliasPageProps = {
  searchParams?: Promise<{
    token?: string | string[]
  }>
}

function getToken(token: string | string[] | undefined) {
  return typeof token === "string" ? token : Array.isArray(token) ? token[0] || "" : ""
}

export default async function ResetPasswordAliasPage({ searchParams }: ResetPasswordAliasPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  redirect(getPasswordResetUrl(getToken(resolvedSearchParams?.token)))
}
