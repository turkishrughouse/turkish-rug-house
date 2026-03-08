import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname === "/rughouse" || pathname.startsWith("/rughouse/")) {
    if (pathname === "/rughouse/login" || pathname.startsWith("/rughouse/login/")) {
      return NextResponse.next()
    }

    const rewritten = req.nextUrl.clone()
    rewritten.pathname = pathname.replace(/^\/rughouse/, "/dashboard") || "/dashboard"
    return NextResponse.rewrite(rewritten)
  }

  if (pathname === "/admin/login") {
    const url = req.nextUrl.clone()
    url.pathname = "/rughouse/login"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/rughouse",
    "/rughouse/:path*",
    "/admin/login",
  ],
}
