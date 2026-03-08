
import { NextResponse } from "next/server";

export function GET() {
    return NextResponse.json({ status: "ok", service: "backend-api" }, { status: 200 });
}
