import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

function withOriginalPath(req: NextRequest, res: NextResponse) {
  res.headers.set("x-original-pathname", req.nextUrl.pathname)
  return res
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname === "/placeholder.jpg") {
    const rewritten = req.nextUrl.clone()
    rewritten.pathname = "/placeholder.svg"
    return withOriginalPath(req, NextResponse.rewrite(rewritten))
  }

  if (pathname === "/rughouse" || pathname.startsWith("/rughouse/")) {
    if (pathname === "/rughouse/login" || pathname.startsWith("/rughouse/login/")) {
      return withOriginalPath(req, NextResponse.next())
    }

    const rewritten = req.nextUrl.clone()
    rewritten.pathname = pathname.replace(/^\/rughouse/, "/admin") || "/admin"
    return withOriginalPath(req, NextResponse.rewrite(rewritten))
  }

  if (pathname === "/admin/login") {
    const url = req.nextUrl.clone()
    url.pathname = "/rughouse/login"
    return withOriginalPath(req, NextResponse.redirect(url))
  }

  return withOriginalPath(req, NextResponse.next())
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/rughouse",
    "/rughouse/:path*",
    "/admin",
    "/admin/:path*",
    "/superuser",
    "/superuser/:path*",
    "/admin/login",
    "/placeholder.jpg",
  ],
}
