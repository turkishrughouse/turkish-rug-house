import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const countryCode = (searchParams.get("countryCode") || "").toUpperCase()
  return NextResponse.json({
    cities: [],
    mode: "manual",
    countryCode,
  })
}
