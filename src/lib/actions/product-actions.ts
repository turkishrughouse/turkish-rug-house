"use server"

import { prisma as db } from "@/lib/db"
import { productFormSchema, ProductFormValues } from "@/lib/validations/product"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { notifyNewProduct, notifyProductDiscount } from "@/lib/customer-messaging"
import { getSessionUser } from "@/lib/auth"
import { syncProductToInventory } from "@/lib/inventory-sync"
import { normalizeProductImageRecords } from "@/lib/product-images"
import { ensureProductSkuFolders, migrateAllProductsToCanonicalMediaFolders } from "@/lib/media-folders"
import { addColumnIfMissing } from "@/lib/db-compat"

type MaterialDelegate = {
    findMany: (...args: any[]) => Promise<any[]>
}

function getMaterialDelegate() {
    return (db as unknown as { material?: MaterialDelegate }).material
}

async function findMaterials(args?: Parameters<MaterialDelegate["findMany"]>[0]) {
    const delegate = getMaterialDelegate()
    if (!delegate?.findMany) return []
    return delegate.findMany(args)
}

let productMediaMigrationPromise: Promise<void> | null = null
let skuColumnReadyPromise: Promise<void> | null = null
let featuredColumnReadyPromise: Promise<void> | null = null
let deletedAtColumnReadyPromise: Promise<void> | null = null
let productCreatorColumnsReadyPromise: Promise<void> | null = null
let lastTrashPurgeAt = 0

async function ensureCanonicalProductMediaMigration() {
    if (!productMediaMigrationPromise) {
        productMediaMigrationPromise = migrateAllProductsToCanonicalMediaFolders().catch((error) => {
            productMediaMigrationPromise = null
            throw error
        })
    }
    await productMediaMigrationPromise
}

async function ensureSkuColumn() {
    if (!skuColumnReadyPromise) {
        skuColumnReadyPromise = (async () => {
            await addColumnIfMissing(db, "Product", "sku", "TEXT")
        })().catch((error) => {
            skuColumnReadyPromise = null
            throw error
        })
    }
    await skuColumnReadyPromise
}

async function getSkuByProductId(productId: string) {
    await ensureSkuColumn()
    const rows = await db.$queryRaw<Array<{ sku: string | null }>>`SELECT "sku" FROM "Product" WHERE "id" = ${productId} LIMIT 1`
    return rows[0]?.sku ?? null
}

async function setSkuByProductId(productId: string, sku: string | null | undefined) {
    await ensureSkuColumn()
    const normalizedSku = sku && sku.trim().length > 0 ? sku.trim() : null
    await db.$executeRaw`UPDATE "Product" SET "sku" = ${normalizedSku} WHERE "id" = ${productId}`
}

async function ensureFeaturedColumn() {
    if (!featuredColumnReadyPromise) {
        featuredColumnReadyPromise = (async () => {
            await addColumnIfMissing(db, "Product", "isFeatured", "BOOLEAN NOT NULL DEFAULT false")
        })().catch((error) => {
            featuredColumnReadyPromise = null
            throw error
        })
    }
    await featuredColumnReadyPromise
}

function parseSqliteBoolean(value: unknown) {
    if (value === true || value === 1 || value === "1") return true
    if (value === false || value === 0 || value === "0" || value === null || value === undefined) return false
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase()
        return normalized === "true" || normalized === "yes"
    }
    return Boolean(value)
}

async function getFeaturedByProductId(productId: string) {
    await ensureFeaturedColumn()
    const rows = await db.$queryRaw<Array<{ isFeatured: number | boolean | null }>>`SELECT "isFeatured" FROM "Product" WHERE "id" = ${productId} LIMIT 1`
    return parseSqliteBoolean(rows[0]?.isFeatured)
}

async function setFeaturedByProductId(productId: string, featured: boolean) {
    await ensureFeaturedColumn()
    await db.$executeRaw`UPDATE "Product" SET "isFeatured" = ${featured} WHERE "id" = ${productId}`
}

async function ensureDeletedAtColumn() {
    if (!deletedAtColumnReadyPromise) {
        deletedAtColumnReadyPromise = (async () => {
            await addColumnIfMissing(db, "Product", "deletedAt", "TIMESTAMP(3)")
        })().catch((error) => {
            deletedAtColumnReadyPromise = null
            throw error
        })
    }
    await deletedAtColumnReadyPromise
}

async function ensureProductCreatorColumns() {
    if (!productCreatorColumnsReadyPromise) {
        productCreatorColumnsReadyPromise = (async () => {
            await addColumnIfMissing(db, "Product", "createdById", "TEXT")
            await addColumnIfMissing(db, "Product", "createdByName", "TEXT")
        })().catch((error) => {
            productCreatorColumnsReadyPromise = null
            throw error
        })
    }
    await productCreatorColumnsReadyPromise
}

async function setProductCreatorByProductId(productId: string, creator: { id: string | null; name: string | null }) {
    await ensureProductCreatorColumns()
    await db.$executeRaw`UPDATE "Product" SET "createdById" = ${creator.id}, "createdByName" = ${creator.name} WHERE "id" = ${productId}`
}

async function purgeExpiredTrashedProducts() {
    if (Date.now() - lastTrashPurgeAt < 1000 * 60 * 60) return
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    await db.$executeRaw`DELETE FROM "Product" WHERE "deletedAt" IS NOT NULL AND "deletedAt" <= ${cutoff}`
    lastTrashPurgeAt = Date.now()
}

type CustomAttribute = {
    name: string
    values: string[]
    visible: boolean
}

type SupplierRecord = {
    name: string
    number: string
    company: string
    phone: string
    note: string
}

function slugifyText(input: string) {
    const normalized = input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    return normalized || "product"
}

async function ensureUniqueProductSlug(baseSlug: string, productId?: string) {
    const normalizedBase = slugifyText(baseSlug)
    let candidate = normalizedBase
    let index = 2

    while (true) {
        const existing = await db.product.findUnique({
            where: { slug: candidate },
            select: { id: true },
        })
        if (!existing || (productId && existing.id === productId)) {
            return candidate
        }
        candidate = `${normalizedBase}-${index}`
        index += 1
    }
}

function buildSlugBaseWithSku(baseSlug: string, sku?: string | null) {
    let normalizedBase = slugifyText(baseSlug)
    const normalizedSku = sku && sku.trim().length > 0 ? slugifyText(sku) : ""
    if (!normalizedSku) return normalizedBase

    normalizedBase = normalizedBase
        .replace(new RegExp(`(?:-${normalizedSku})+$`), "")
        .replace(/-(?:[a-z]+[a-z0-9]*\d[a-z0-9]*)(?:-\d+)?$/, "")
        .replace(/-+$/g, "")

    if (!normalizedBase) {
        return normalizedSku
    }

    if (normalizedBase === normalizedSku || normalizedBase.endsWith(`-${normalizedSku}`)) {
        return normalizedBase
    }
    return `${normalizedBase}-${normalizedSku}`
}

function stripHtml(input: string) {
    return input
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function buildSeoFields(input: {
    title: string
    description?: string
    seoTitle?: string
    seoDescription?: string
    seoKeywords?: string
    categoryTitles?: string[]
}) {
    const title = input.title.trim()
    const plainDescription = stripHtml(input.description || "")
    const providedSeoTitle = (input.seoTitle || "").trim()
    const providedSeoDescription = (input.seoDescription || "").trim()
    const providedSeoKeywords = (input.seoKeywords || "").trim()

    const seoTitle = providedSeoTitle || title
    const seoDescription = providedSeoDescription || plainDescription || `${title} | Turkish Rug House`
    const keywordSeed = input.categoryTitles && input.categoryTitles.length > 0
        ? [title, ...input.categoryTitles]
        : [title]
    const seoKeywords = providedSeoKeywords || Array.from(new Set(keywordSeed)).join(", ")

    return {
        // Keep user-provided content intact. Limit only auto-generated fallbacks.
        seoTitle: providedSeoTitle ? providedSeoTitle : seoTitle.slice(0, 60),
        seoDescription: providedSeoDescription ? providedSeoDescription : seoDescription.slice(0, 160),
        seoKeywords: providedSeoKeywords ? providedSeoKeywords : seoKeywords.slice(0, 300),
    }
}

function normalizeCustomAttributes(input: unknown): CustomAttribute[] {
    if (!Array.isArray(input)) return []
    return input
        .map((item) => {
            if (!item || typeof item !== "object") return null
            const name = typeof (item as { name?: unknown }).name === "string" ? (item as { name: string }).name.trim() : ""
            const rawValues = Array.isArray((item as { values?: unknown }).values) ? (item as { values: unknown[] }).values : []
            const values = rawValues
                .filter((value): value is string => typeof value === "string")
                .map((value) => value.trim())
                .filter(Boolean)
            if (!name || values.length === 0) return null
            const visible = (item as { visible?: unknown }).visible !== false
            return { name, values, visible }
        })
        .filter((value): value is CustomAttribute => Boolean(value))
}

function normalizeSuppliers(input: unknown): SupplierRecord[] {
    if (!Array.isArray(input)) return []
    return input
        .map((item) => {
            if (!item || typeof item !== "object") return null
            const name = typeof (item as { name?: unknown }).name === "string" ? (item as { name: string }).name.trim() : ""
            const number = typeof (item as { number?: unknown }).number === "string" ? (item as { number: string }).number.trim().toUpperCase() : ""
            const company = typeof (item as { company?: unknown }).company === "string" ? (item as { company: string }).company.trim() : ""
            const phone = typeof (item as { phone?: unknown }).phone === "string" ? (item as { phone: string }).phone.trim() : ""
            const note = typeof (item as { note?: unknown }).note === "string" ? (item as { note: string }).note.trim() : ""
            if (!name && !number && !company) return null
            return { name, number, company, phone, note }
        })
        .filter((value): value is SupplierRecord => Boolean(value))
}

async function findConflictingProductSku(sku: string, currentProductId?: string) {
    await ensureSkuColumn()
    await ensureDeletedAtColumn()
    const normalizedSku = (sku || "").trim()
    if (!normalizedSku) return null
    const rows = currentProductId
        ? await db.$queryRaw<Array<{ id: string; title: string }>>`
        SELECT "id", "title"
        FROM "Product"
        WHERE "sku" = ${normalizedSku}
          AND "deletedAt" IS NULL
          AND "id" != ${currentProductId}
        LIMIT 1`
        : await db.$queryRaw<Array<{ id: string; title: string }>>`
        SELECT "id", "title"
        FROM "Product"
        WHERE "sku" = ${normalizedSku}
          AND "deletedAt" IS NULL
        LIMIT 1`
    return rows[0] || null
}

async function ensureShortDescriptionColumn() {
    await addColumnIfMissing(db, "Product", "shortDescription", "TEXT")
}

async function getShortDescriptionByProductId(productId: string) {
    await ensureShortDescriptionColumn()
    const rows = await db.$queryRaw<Array<{ shortDescription: string | null }>>`SELECT "shortDescription" FROM "Product" WHERE "id" = ${productId} LIMIT 1`
    return rows[0]?.shortDescription ?? null
}

async function setShortDescriptionByProductId(productId: string, shortDescription: string | null | undefined) {
    await ensureShortDescriptionColumn()
    const normalized = shortDescription && shortDescription.trim().length > 0 ? shortDescription : null
    await db.$executeRaw`UPDATE "Product" SET "shortDescription" = ${normalized} WHERE "id" = ${productId}`
}

async function ensureCustomAttributesColumn() {
    await addColumnIfMissing(db, "Product", "customAttributes", "TEXT")
}

async function getCustomAttributesByProductId(productId: string): Promise<CustomAttribute[]> {
    await ensureCustomAttributesColumn()
    const rows = await db.$queryRaw<Array<{ customAttributes: string | null }>>`SELECT "customAttributes" FROM "Product" WHERE "id" = ${productId} LIMIT 1`
    const raw = rows[0]?.customAttributes
    if (!raw) return []
    try {
        return normalizeCustomAttributes(JSON.parse(raw))
    } catch {
        return []
    }
}

async function setCustomAttributesByProductId(productId: string, attributes: CustomAttribute[] | undefined) {
    await ensureCustomAttributesColumn()
    const normalized = normalizeCustomAttributes(attributes || [])
    const payload = normalized.length > 0 ? JSON.stringify(normalized) : null
    await db.$executeRaw`UPDATE "Product" SET "customAttributes" = ${payload} WHERE "id" = ${productId}`
}

async function ensureSuppliersColumn() {
    await addColumnIfMissing(db, "Product", "suppliers", "TEXT")
}

async function getSuppliersByProductId(productId: string): Promise<SupplierRecord[]> {
    await ensureSuppliersColumn()
    const rows = await db.$queryRaw<Array<{ suppliers: string | null }>>`SELECT "suppliers" FROM "Product" WHERE "id" = ${productId} LIMIT 1`
    const raw = rows[0]?.suppliers
    if (!raw) return []
    try {
        return normalizeSuppliers(JSON.parse(raw))
    } catch {
        return []
    }
}

async function setSuppliersByProductId(productId: string, suppliers: SupplierRecord[] | undefined) {
    await ensureSuppliersColumn()
    const normalized = normalizeSuppliers(suppliers || [])
    const payload = normalized.length > 0 ? JSON.stringify(normalized) : null
    await db.$executeRaw`UPDATE "Product" SET "suppliers" = ${payload} WHERE "id" = ${productId}`
}

export async function getProducts(
    page = 1,
    limit = 20,
    query = "",
    status?: string, // 'published' | 'draft'
    sort?: 'latest' | 'oldest' | 'price-asc' | 'price-desc', // Add sort option
    categorySlug?: string,
    filters?: {
        types?: string[],
        styles?: string[],
        colors?: string[],
        sizes?: string[],
        ages?: string[],
        materials?: string[],
        categoryIds?: string[],
        priceMin?: number,
        priceMax?: number,
        inStock?: boolean,
        stockStatus?: "instock" | "outofstock",
        productIds?: string[],
        featuredOnly?: boolean,
        trashOnly?: boolean,
        scheduledDate?: string
    }
) {
    await purgeExpiredTrashedProducts()
    const skip = (page - 1) * limit

    const orderBy: Prisma.ProductOrderByWithRelationInput =
        sort === 'latest' ? { createdAt: 'desc' } :
            sort === 'oldest' ? { createdAt: 'asc' } :
                sort === 'price-asc' ? { price: 'asc' } :
                    sort === 'price-desc' ? { price: 'desc' } :
                        { updatedAt: 'desc' } // Default

    const stockFilter =
        filters?.stockStatus === "instock"
            ? true
            : filters?.stockStatus === "outofstock"
                ? false
                : filters?.inStock === true
                    ? true
                    : undefined

    let idFilter = filters?.productIds?.length ? [...filters.productIds] : undefined

    const trashScopedIds = await (filters?.trashOnly
        ? db.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Product" WHERE "deletedAt" IS NOT NULL`
        : db.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Product" WHERE "deletedAt" IS NULL`
    ).then((rows) => rows.map((row) => row.id))
    if (idFilter) {
        const allowed = new Set(trashScopedIds)
        idFilter = idFilter.filter((id) => allowed.has(id))
    } else {
        idFilter = trashScopedIds
    }

    if (filters?.featuredOnly) {
        const featuredIds = await db.$queryRaw<Array<{ id: string }>>`
            SELECT "id"
            FROM "Product"
            WHERE "isFeatured" IS TRUE
              AND "deletedAt" IS NULL
        `.then((rows) => rows.map((row) => row.id))
        if (idFilter) {
            const featuredIdSet = new Set(featuredIds)
            idFilter = idFilter.filter((id) => featuredIdSet.has(id))
        } else {
            idFilter = featuredIds
        }
    }

    const scheduleDateValue = filters?.scheduledDate?.trim()
    const scheduleDateRange =
        scheduleDateValue && /^\d{4}-\d{2}-\d{2}$/.test(scheduleDateValue)
            ? {
                start: new Date(`${scheduleDateValue}T00:00:00.000Z`),
                end: new Date(`${scheduleDateValue}T23:59:59.999Z`),
            }
            : null

    const where: Prisma.ProductWhereInput = {
        OR: query ? [
            { title: { contains: query } },
            { slug: { contains: query } },
        ] : undefined,
        isPublished: status === 'published' ? true : status === 'draft' ? false : undefined,
        categories: filters?.categoryIds?.length ? {
            some: {
                id: { in: filters.categoryIds }
            }
        } : categorySlug ? {
            some: {
                slug: categorySlug
            }
        } : undefined,
        // --- Filters ---
        types: filters?.types?.length ? { some: { slug: { in: filters.types } } } : undefined,
        styles: filters?.styles?.length ? { some: { slug: { in: filters.styles } } } : undefined,
        colors: filters?.colors?.length ? { some: { slug: { in: filters.colors } } } : undefined,
        sizes: filters?.sizes?.length ? { some: { slug: { in: filters.sizes } } } : undefined,
        ages: filters?.ages?.length ? { some: { slug: { in: filters.ages } } } : undefined,
        materials: filters?.materials?.length ? { some: { slug: { in: filters.materials } } } : undefined,
        price: (filters?.priceMin !== undefined || filters?.priceMax !== undefined) ? {
            gte: filters.priceMin,
            lte: filters.priceMax
        } : undefined,
        isStock: stockFilter,
        id: idFilter ? { in: idFilter } : undefined,
        createdAt: scheduleDateRange
            ? {
                gte: scheduleDateRange.start,
                lte: scheduleDateRange.end,
            }
            : undefined,
    }

    const [products, total] = await Promise.all([
        db.product.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            include: {
                categories: {
                    include: {
                        parent: true
                    }
                },
            }
        }),
        db.product.count({ where })
    ])

    const serializedProducts = products.map(product => ({
        ...product,
        sku: product.sku ?? null,
        isFeatured: Boolean(product.isFeatured),
        price: product.price.toNumber(),
        compareAtPrice: product.compareAtPrice ? product.compareAtPrice.toNumber() : null,
    }))

    return {
        products: serializedProducts,
        metadata: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    }
}

export async function getProductAdminStats(query = "") {
    await ensureFeaturedColumn()
    await ensureDeletedAtColumn()
    await purgeExpiredTrashedProducts()
    const baseWhere: Prisma.ProductWhereInput = query
        ? {
            OR: [
                { title: { contains: query } },
                { slug: { contains: query } },
            ],
        }
        : {}

    const likeQuery = `%${query}%`
    const featuredPromise = query
        ? db.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*) as count FROM "Product" WHERE "isFeatured" IS TRUE AND "deletedAt" IS NULL AND ("title" LIKE ${likeQuery} OR "slug" LIKE ${likeQuery})`
        : db.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*) as count FROM "Product" WHERE "isFeatured" IS TRUE AND "deletedAt" IS NULL`

    const trashPromise = query
        ? db.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*) as count FROM "Product" WHERE "deletedAt" IS NOT NULL AND ("title" LIKE ${likeQuery} OR "slug" LIKE ${likeQuery})`
        : db.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*) as count FROM "Product" WHERE "deletedAt" IS NOT NULL`

    const activeIdsPromise = query
        ? db.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Product" WHERE "deletedAt" IS NULL AND ("title" LIKE ${likeQuery} OR "slug" LIKE ${likeQuery})`
        : db.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Product" WHERE "deletedAt" IS NULL`

    const activeIds = (await activeIdsPromise).map((row) => row.id)

    const activeWhere: Prisma.ProductWhereInput = {
        ...baseWhere,
        id: { in: activeIds },
    }

    const [all, published, draft, featuredRows, trashRows] = await Promise.all([
        db.product.count({ where: activeWhere }),
        db.product.count({ where: { ...activeWhere, isPublished: true } }),
        db.product.count({ where: { ...activeWhere, isPublished: false } }),
        featuredPromise,
        trashPromise,
    ])

    return {
        all,
        published,
        draft,
        featured: Number(featuredRows[0]?.count || 0),
        trash: Number(trashRows[0]?.count || 0),
        schedule: all,
        sorting: all,
    }
}

export async function setProductFeatured(productId: string, featured: boolean) {
    try {
        await setFeaturedByProductId(productId, featured)
        revalidatePath("/dashboard/products")
        revalidatePath("/products")
        return { success: true as const }
    } catch (error) {
        console.error("setProductFeatured error:", error)
        return { success: false as const, error: "Failed to update featured flag" }
    }
}

export async function getProduct(id: string) {
    await ensureFeaturedColumn()
    await ensureDeletedAtColumn()
    await ensureCanonicalProductMediaMigration()
    const deletedRows = await db.$queryRaw<Array<{ deletedAt: string | null }>>`SELECT "deletedAt" FROM "Product" WHERE "id" = ${id} LIMIT 1`
    if (deletedRows[0]?.deletedAt) return null

    const product = await (async () => {
        try {
            return await db.product.findUnique({
                where: { id },
                include: {
                    categories: true,
                    types: true,
                    styles: true,
                    colors: true,
                    sizes: true,
                    ages: true,
                    materials: true,
                }
            })
        } catch (error) {
            console.warn("getProduct materials include unavailable, falling back:", error)
            const fallback = await db.product.findUnique({
                where: { id },
                include: {
                    categories: true,
                    types: true,
                    styles: true,
                    colors: true,
                    sizes: true,
                    ages: true,
                }
            })
            return fallback ? { ...fallback, materials: [] } : null
        }
    })()

    if (!product) return null
    const sku = await getSkuByProductId(product.id)
    const isFeatured = await getFeaturedByProductId(product.id)
    const shortDescription = await getShortDescriptionByProductId(product.id)
    const customAttributes = await getCustomAttributesByProductId(product.id)
    const suppliers = await getSuppliersByProductId(product.id)

    return {
        ...product,
        sku,
        isFeatured,
        shortDescription,
        customAttributes,
        suppliers,
        price: product.price.toNumber(),
        compareAtPrice: product.compareAtPrice ? product.compareAtPrice.toNumber() : null,
    }
}

export async function createProduct(data: ProductFormValues) {
    const validated = productFormSchema.parse(data)
    await ensureCanonicalProductMediaMigration()

    // Helper to connect relationships
    const connect = (ids: string[]) => ids.map(id => ({ id }))

    try {
        const actor = await getSessionUser("admin")
        const skuConflict = await findConflictingProductSku(validated.sku)
        if (skuConflict) {
            return { success: false, error: "SKU already exists. Change SKU and save again." }
        }
        const uniqueSlug = await ensureUniqueProductSlug(
            buildSlugBaseWithSku(validated.slug || validated.title, validated.sku)
        )
        // CRITICAL FIX: Use image URLs as-is without path mutation.
        // Persisted image paths may exist under historical category folders.
        // Calling relocateProductImagesToSkuFolders() would mutate URLs based on CURRENT categories,
        // breaking images stored under different historical category paths.
        // Only relocate during initial upload, never during product edits.
        const normalizedImages = validated.images
        const categoryRows = validated.categoryIds.length > 0
            ? await db.category.findMany({
                where: { id: { in: validated.categoryIds } },
                select: { id: true, slug: true, title: true },
            })
            : []
        const seo = buildSeoFields({
            title: validated.title,
            description: validated.description,
            seoTitle: validated.seoTitle,
            seoDescription: validated.seoDescription,
            seoKeywords: validated.seoKeywords,
            categoryTitles: categoryRows.map((item) => item.title),
        })

        const created = await db.product.create({
            data: {
                title: validated.title,
                slug: uniqueSlug,
                description: validated.description,
                price: validated.price,
                compareAtPrice: validated.compareAtPrice,
                stockCount: validated.stockCount,
                isStock: validated.isStock,
                isPublished: validated.isPublished,
                images: JSON.stringify(normalizeProductImageRecords(normalizedImages)),
                seoTitle: seo.seoTitle,
                seoDescription: seo.seoDescription,
                seoKeywords: seo.seoKeywords,
                categories: { connect: connect(validated.categoryIds) },
                types: { connect: connect(validated.typeIds) },
                styles: { connect: connect(validated.styleIds) },
                colors: { connect: connect(validated.colorIds) },
                sizes: { connect: connect(validated.sizeIds) },
                ages: { connect: connect(validated.ageIds) },
                materials: { connect: connect(validated.materialIds) },
            }
        })
        await setSkuByProductId(created.id, validated.sku || null)
        await setFeaturedByProductId(created.id, validated.isFeatured)
        await setShortDescriptionByProductId(created.id, validated.shortDescription)
        await setCustomAttributesByProductId(created.id, validated.customAttributes)
        await setSuppliersByProductId(created.id, validated.suppliers)
        await ensureProductSkuFolders(validated.categoryIds, validated.sku || null)
        await setProductCreatorByProductId(created.id, {
            id: actor?.id || null,
            name: actor?.name || actor?.email || "Unknown",
        })

        if (validated.isPublished) {
            await notifyNewProduct({
                id: created.id,
                title: validated.title,
                slug: uniqueSlug,
            })
            if (validated.compareAtPrice && validated.compareAtPrice > validated.price && validated.compareAtPrice > 0) {
                const discountPercent = Math.max(
                    1,
                    Math.round(((validated.compareAtPrice - validated.price) / validated.compareAtPrice) * 100)
                )
                await notifyProductDiscount({
                    id: created.id,
                    title: validated.title,
                    slug: uniqueSlug,
                    discountPercent,
                })
            }
        }
        try {
            const syncResult = await syncProductToInventory({
                event: "created",
                product: {
                    id: created.id,
                    slug: uniqueSlug,
                    title: validated.title,
                    description: validated.description,
                    sku: validated.sku || null,
                    price: validated.price,
                    compareAtPrice: validated.compareAtPrice ?? null,
                    stockCount: validated.stockCount,
                    isStock: validated.isStock,
                    isPublished: validated.isPublished,
                    isFeatured: validated.isFeatured,
                    seoTitle: seo.seoTitle,
                    seoDescription: seo.seoDescription,
                    seoKeywords: seo.seoKeywords,
                    images: normalizedImages,
                    customAttributes: validated.customAttributes,
                    suppliers: validated.suppliers,
                    categories: categoryRows.map((c) => ({ id: c.id, slug: c.slug, title: c.title })),
                },
            })
            if (!syncResult.skipped && syncResult.success === false) {
                console.warn("Inventory sync (create) skipped safely:", syncResult.error)
            }
        } catch (syncError) {
            console.error("Inventory sync (create) failed:", syncError)
        }
        revalidatePath("/dashboard/products")
        revalidatePath(`/product/${uniqueSlug}`)
        return { success: true }
    } catch (error) {
        console.error("Create Product Error:", error)
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues.map((issue) => issue.message).join(", ") }
        }
        return { success: false, error: (error as Error).message || "Failed to create product" }
    }
}

export async function updateProduct(id: string, data: ProductFormValues) {
    const validated = productFormSchema.parse(data)
    await ensureCanonicalProductMediaMigration()
    const connect = (ids: string[]) => ids.map(id => ({ id }))

    try {
        const existingProduct = await db.product.findUnique({
            where: { id },
            select: { slug: true },
        })
        const skuConflict = await findConflictingProductSku(validated.sku, id)
        if (skuConflict) {
            return { success: false, error: "SKU already exists. Duplicate product cannot be saved without changing SKU." }
        }
        const before = await db.product.findUnique({
            where: { id },
            select: { compareAtPrice: true, price: true, isPublished: true },
        })
        const uniqueSlug = await ensureUniqueProductSlug(
            buildSlugBaseWithSku(validated.slug || validated.title, validated.sku),
            id
        )
        // CRITICAL FIX: Use image URLs as-is without path mutation.
        // Persisted image paths may exist under historical category folders.
        // Calling relocateProductImagesToSkuFolders() would mutate URLs based on CURRENT categories,
        // breaking images stored under different historical category paths.
        // Only relocate during initial upload, never during product edits.
        const normalizedImages = validated.images
        const categoryRows = validated.categoryIds.length > 0
            ? await db.category.findMany({
                where: { id: { in: validated.categoryIds } },
                select: { id: true, slug: true, title: true },
            })
            : []
        const seo = buildSeoFields({
            title: validated.title,
            description: validated.description,
            seoTitle: validated.seoTitle,
            seoDescription: validated.seoDescription,
            seoKeywords: validated.seoKeywords,
            categoryTitles: categoryRows.map((item) => item.title),
        })

        // Disconnect all first then connect new to handle "replace" logic for m-n
        // Or strictly set. set is cleaner for m-n in Prisma.

        await db.product.update({
            where: { id },
            data: {
                title: validated.title,
                slug: uniqueSlug,
                description: validated.description,
                price: validated.price,
                compareAtPrice: validated.compareAtPrice,
                stockCount: validated.stockCount,
                isStock: validated.isStock,
                isPublished: validated.isPublished,
                images: JSON.stringify(normalizeProductImageRecords(normalizedImages)),
                seoTitle: seo.seoTitle,
                seoDescription: seo.seoDescription,
                seoKeywords: seo.seoKeywords,
                categories: { set: connect(validated.categoryIds) },
                types: { set: connect(validated.typeIds) },
                styles: { set: connect(validated.styleIds) },
                colors: { set: connect(validated.colorIds) },
                sizes: { set: connect(validated.sizeIds) },
                ages: { set: connect(validated.ageIds) },
                materials: { set: connect(validated.materialIds) },
            }
        })
        await setSkuByProductId(id, validated.sku || null)
        await setFeaturedByProductId(id, validated.isFeatured)
        await setShortDescriptionByProductId(id, validated.shortDescription)
        await setCustomAttributesByProductId(id, validated.customAttributes)
        await setSuppliersByProductId(id, validated.suppliers)
        await ensureProductSkuFolders(validated.categoryIds, validated.sku || null)

        const hadDiscount = Boolean(
            before?.isPublished &&
            before.compareAtPrice &&
            Number(before.compareAtPrice) > Number(before.price)
        )
        const hasDiscountNow = Boolean(
            validated.isPublished &&
            validated.compareAtPrice &&
            validated.compareAtPrice > validated.price
        )
        if (!hadDiscount && hasDiscountNow && validated.compareAtPrice && validated.compareAtPrice > 0) {
            const discountPercent = Math.max(
                1,
                Math.round(((validated.compareAtPrice - validated.price) / validated.compareAtPrice) * 100)
            )
            await notifyProductDiscount({
                id,
                title: validated.title,
                slug: uniqueSlug,
                discountPercent,
            })
        }
        try {
            const syncResult = await syncProductToInventory({
                event: "updated",
                product: {
                    id,
                    slug: uniqueSlug,
                    title: validated.title,
                    description: validated.description,
                    sku: validated.sku || null,
                    price: validated.price,
                    compareAtPrice: validated.compareAtPrice ?? null,
                    stockCount: validated.stockCount,
                    isStock: validated.isStock,
                    isPublished: validated.isPublished,
                    isFeatured: validated.isFeatured,
                    seoTitle: seo.seoTitle,
                    seoDescription: seo.seoDescription,
                    seoKeywords: seo.seoKeywords,
                    images: normalizedImages,
                    customAttributes: validated.customAttributes,
                    suppliers: validated.suppliers,
                    categories: categoryRows.map((c) => ({ id: c.id, slug: c.slug, title: c.title })),
                },
            })
            if (!syncResult.skipped && syncResult.success === false) {
                console.warn("Inventory sync (update) skipped safely:", syncResult.error)
            }
        } catch (syncError) {
            console.error("Inventory sync (update) failed:", syncError)
        }
        revalidatePath("/dashboard/products")
        revalidatePath(`/dashboard/products/${id}`)
        revalidatePath(`/product/${uniqueSlug}`)
        if (existingProduct?.slug && existingProduct.slug !== uniqueSlug) {
            revalidatePath(`/product/${existingProduct.slug}`)
        }
        return { success: true }
    } catch (error) {
        console.error("Update Product Error:", error)
        return { success: false, error: (error as Error).message || "Failed to update product" }
    }
}

export async function deleteProduct(id: string, permanent = false) {
    try {
        await ensureDeletedAtColumn()
        if (permanent) {
            await db.product.delete({ where: { id } })
        } else {
            await db.$executeRaw`UPDATE "Product" SET "deletedAt" = CURRENT_TIMESTAMP WHERE "id" = ${id}`
        }
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch {
        return { success: false, error: "Failed to delete product" }
    }
}

export async function duplicateProduct(id: string) {
    const original = await getProduct(id)
    if (!original) return { success: false, error: "Product not found" }

    try {
        const actor = await getSessionUser("admin")
        const newSlug = await ensureUniqueProductSlug(
            buildSlugBaseWithSku(`copy-${original.title}`, original.sku)
        )
        const newProduct = await db.product.create({
            data: {
                title: `Copy of ${original.title}`,
                slug: newSlug,
                description: original.description,
                price: original.price,
                compareAtPrice: original.compareAtPrice,
                stockCount: original.stockCount,
                isStock: original.isStock,
                isPublished: false, // Default to draft
                images: original.images,
                seoTitle: original.seoTitle,
                seoDescription: original.seoDescription,
                seoKeywords: original.seoKeywords,
                categories: { connect: original.categories.map((c: { id: string }) => ({ id: c.id })) },
                types: { connect: original.types.map((t: { id: string }) => ({ id: t.id })) },
                styles: { connect: original.styles.map((s: { id: string }) => ({ id: s.id })) },
                colors: { connect: original.colors.map((c: { id: string }) => ({ id: c.id })) },
                sizes: { connect: original.sizes.map((s: { id: string }) => ({ id: s.id })) },
                ages: { connect: original.ages.map((a: { id: string }) => ({ id: a.id })) },
            }
        })
        await setSkuByProductId(newProduct.id, original.sku || null)
        await setFeaturedByProductId(newProduct.id, Boolean(original.isFeatured))
        await setShortDescriptionByProductId(newProduct.id, original.shortDescription || null)
        await setCustomAttributesByProductId(newProduct.id, original.customAttributes || [])
        await setSuppliersByProductId(newProduct.id, original.suppliers || [])
        await setProductCreatorByProductId(newProduct.id, {
            id: actor?.id || null,
            name: actor?.name || actor?.email || "Unknown",
        })
        revalidatePath("/dashboard/products")
        return { success: true, newId: newProduct.id }
    } catch (error) {
        console.error("Duplicate Error", error)
        return { success: false, error: "Failed to duplicate" }
    }
}

export async function bulkDeleteProducts(ids: string[]) {
    try {
        await ensureDeletedAtColumn()
        if (ids.length === 0) return { success: true }
        await db.$executeRaw`UPDATE "Product" SET "deletedAt" = CURRENT_TIMESTAMP WHERE "id" IN (${Prisma.join(ids)})`
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch {
        return { success: false, error: "Bulk delete failed" }
    }
}

export async function bulkDeleteProductsPermanently(ids: string[]) {
    try {
        if (ids.length === 0) return { success: true }
        await db.product.deleteMany({
            where: { id: { in: ids } },
        })
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch {
        return { success: false, error: "Bulk permanent delete failed" }
    }
}

export async function restoreProduct(id: string) {
    try {
        await ensureDeletedAtColumn()
        await db.$executeRaw`UPDATE "Product" SET "deletedAt" = NULL WHERE "id" = ${id}`
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch {
        return { success: false, error: "Failed to restore product" }
    }
}

export async function bulkRestoreProducts(ids: string[]) {
    try {
        await ensureDeletedAtColumn()
        if (ids.length === 0) return { success: true }
        await db.$executeRaw`UPDATE "Product" SET "deletedAt" = NULL WHERE "id" IN (${Prisma.join(ids)})`
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch {
        return { success: false, error: "Bulk restore failed" }
    }
}

export async function emptyProductTrash() {
    try {
        await ensureDeletedAtColumn()
        await db.$executeRaw`DELETE FROM "Product" WHERE "deletedAt" IS NOT NULL`
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch {
        return { success: false, error: "Failed to empty trash" }
    }
}

export async function bulkPublishProducts(ids: string[], isPublished: boolean) {
    try {
        await db.product.updateMany({
            where: { id: { in: ids } },
            data: { isPublished }
        })
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch {
        return { success: false, error: "Bulk update failed" }
    }
}

export async function getProductOptions() {
    await ensureCanonicalProductMediaMigration()
    const categoriesWithProductsPromise = db.category.findMany({
        select: {
            id: true,
            products: {
                select: {
                    id: true,
                    types: { select: { id: true } },
                    styles: { select: { id: true } },
                    colors: { select: { id: true } },
                    sizes: { select: { id: true } },
                    ages: { select: { id: true } },
                    materials: { select: { id: true } },
                }
            }
        }
    })

    const [categories, types, styles, colors, sizes, ages, materials, categoriesWithProducts] = await Promise.all([
        db.category.findMany(),
        db.type.findMany(),
        db.style.findMany(),
        db.color.findMany(),
        db.size.findMany(),
        db.age.findMany(),
        findMaterials(),
        categoriesWithProductsPromise,
    ])

    const categoryAttributeMap: Record<string, {
        typeIds: string[]
        styleIds: string[]
        colorIds: string[]
        sizeIds: string[]
        ageIds: string[]
        materialIds: string[]
    }> = {}
    const categoryProductCountMap: Record<string, number> = {}

    categoriesWithProducts.forEach((category) => {
        const typeIds = new Set<string>()
        const styleIds = new Set<string>()
        const colorIds = new Set<string>()
        const sizeIds = new Set<string>()
        const ageIds = new Set<string>()
        const materialIds = new Set<string>()
        const productIds = new Set<string>()

        category.products.forEach((product) => {
            productIds.add(product.id)
            product.types.forEach((t) => typeIds.add(t.id))
            product.styles.forEach((s) => styleIds.add(s.id))
            product.colors.forEach((c) => colorIds.add(c.id))
            product.sizes.forEach((s) => sizeIds.add(s.id))
            product.ages.forEach((a) => ageIds.add(a.id))
            product.materials.forEach((m) => materialIds.add(m.id))
        })

        categoryAttributeMap[category.id] = {
            typeIds: Array.from(typeIds),
            styleIds: Array.from(styleIds),
            colorIds: Array.from(colorIds),
            sizeIds: Array.from(sizeIds),
            ageIds: Array.from(ageIds),
            materialIds: Array.from(materialIds),
        }
        // Product-based unique count per category.
        categoryProductCountMap[category.id] = productIds.size
    })

    const categoriesWithCount = categories.map((category) => ({
        ...category,
        productCount: categoryProductCountMap[category.id] ?? 0,
    }))

    return {
        categories: categoriesWithCount,
        types,
        styles,
        colors,
        sizes,
        ages,
        materials,
        categoryAttributeMap,
    }
}
