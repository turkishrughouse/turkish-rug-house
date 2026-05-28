import { NextResponse } from "next/server"
import { getSupplierIdentityKey, normalizeSupplierRecord } from "@/lib/supplier-prefix"
import { requireAdminApiAuth } from "@/lib/admin-guard"
import {
  ensureSupplierRegistrySeeded,
  getSupplierSummaries,
  saveSupplierRegistry,
  syncAllProductSuppliersFromRegistry,
} from "@/lib/supplier-registry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAdminApiAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const suppliers = await getSupplierSummaries()
    return NextResponse.json({ suppliers })
  } catch (error) {
    console.error("GET /api/admin/suppliers error:", error)
    return NextResponse.json({ error: "Failed to load suppliers" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdminApiAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json().catch(() => ({}))
    const original = normalizeSupplierRecord(body?.original)
    const updated = normalizeSupplierRecord(body?.updated)

    if (!updated) {
      return NextResponse.json({ error: "Invalid supplier payload" }, { status: 400 })
    }

    if (!updated.number) {
      return NextResponse.json({ error: "Supplier number/prefix is required" }, { status: 400 })
    }

    const { suppliers: currentSuppliers } = await ensureSupplierRegistrySeeded()
    const nextSuppliers = [...currentSuppliers]
    const originalKey = original ? getSupplierIdentityKey(original) : ""
    const currentIndex = originalKey
      ? nextSuppliers.findIndex((supplier) => getSupplierIdentityKey(supplier) === originalKey)
      : -1

    const duplicatePrefixIndex = nextSuppliers.findIndex(
      (supplier, index) => supplier.number === updated.number && index !== currentIndex
    )

    if (duplicatePrefixIndex !== -1) {
      return NextResponse.json({ error: "Supplier prefix already exists" }, { status: 409 })
    }

    if (currentIndex === -1) {
      nextSuppliers.push(updated)
    } else {
      nextSuppliers[currentIndex] = updated
    }

    const savedSuppliers = await saveSupplierRegistry(nextSuppliers)
    const syncResult = await syncAllProductSuppliersFromRegistry(savedSuppliers)
    const suppliers = await getSupplierSummaries()

    return NextResponse.json({
      success: true,
      updatedProducts: syncResult.updatedProducts,
      suppliers,
    })
  } catch (error) {
    console.error("PATCH /api/admin/suppliers error:", error)
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 })
  }
}
