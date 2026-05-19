import { NextRequest, NextResponse } from "next/server"
import { stat } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import { getEnv } from "@/lib/env"
import { logger } from "@/lib/logger"
import { sanitizeFolderPath, getManagedMediaRoots } from "@/lib/media-folders"
import { prisma } from "@/lib/db"
import { getStorageProvider } from "@/lib/storage/provider"
import { processUploadImage } from "@/lib/storage/image-pipeline"
import { ensureMediaRegistryTable, findMediaByChecksum, upsertMediaAsset } from "@/lib/media-registry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MIN_MASTER_WIDTH = 1800

function normalizeFolderFromObjectKey(value: string | null | undefined) {
    const clean = sanitizeFolderPath(value || "")
    if (!clean) return ""
    const parts = clean.split("/").filter(Boolean)
    if (parts.length <= 1) return ""
    return parts.slice(0, -1).join("/")
}

async function resolveBaseName(folder: string, requestedBaseName: string | null, fallbackName: string) {
    const baseSlug = sanitizeFolderPath(requestedBaseName || "").split("/").pop() || sanitizeFolderPath(fallbackName) || uuidv4()
    const uploadRoot = path.join(process.cwd(), "public", "uploads")

    let candidate = baseSlug
    let counter = 2
    while (true) {
        const relativePath = path.join(uploadRoot, folder, `${candidate}-master.webp`)
        const exists = await stat(relativePath).then(() => true).catch(() => false)
        if (!exists) return candidate
        candidate = `${baseSlug}-${counter}`
        counter += 1
    }
}

async function mediaRowExists(objectKey: string | null | undefined) {
    const clean = sanitizeFolderPath(objectKey || "")
    if (!clean) return false
    const absolutePath = path.join(process.cwd(), "public", "uploads", clean)
    return stat(absolutePath).then(() => true).catch(() => false)
}

export async function POST(req: NextRequest) {
    try {
        const env = getEnv()
        const contentType = req.headers.get("content-type") || ""
        if (!contentType.includes("multipart/form-data")) {
            return NextResponse.json(
                { error: "Invalid content type. Use multipart/form-data." },
                { status: 400 }
            )
        }
        const formData = await req.formData()
        const file = formData.get("file") as File | null
        const folderInput = formData.get("folder")
        const baseNameInput = formData.get("baseName")
        const candidateFolder = typeof folderInput === "string" ? sanitizeFolderPath(folderInput) : ""
        const requestedBaseName = typeof baseNameInput === "string" ? baseNameInput : null
        const topCategories = await prisma.category.findMany({
            where: { parentId: null },
            select: { slug: true },
        })
        const allowedRoots = new Set([
            ...getManagedMediaRoots().map((value) => sanitizeFolderPath(value)).filter(Boolean),
            ...topCategories.map((item) => sanitizeFolderPath(item.slug)).filter(Boolean),
        ])
        const folderTop = candidateFolder.split("/")[0] || ""
        const folder = candidateFolder && allowedRoots.has(folderTop) ? candidateFolder : "categories"

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            )
        }
        const mimeOk = !file.type || file.type.startsWith("image/")
        if (!mimeOk) {
            return NextResponse.json(
                { error: `Unsupported file type: ${file.type}. Please upload an image file.` },
                { status: 400 }
            )
        }
        const maxBytes = env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024
        if (file.size > maxBytes) {
            return NextResponse.json(
                { error: `File too large. Max allowed size is ${env.UPLOAD_MAX_FILE_SIZE_MB}MB.` },
                { status: 400 }
            )
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const processed = await processUploadImage(buffer, env.UPLOAD_ENABLE_AVIF)
        if ((processed.width || 0) < MIN_MASTER_WIDTH) {
            return NextResponse.json(
                {
                    error: `Image resolution too small for product detail. Minimum width is ${MIN_MASTER_WIDTH}px.`,
                    width: processed.width ?? null,
                    height: processed.height ?? null,
                },
                { status: 400 }
            )
        }
        if ((processed.width || 0) < env.UPLOAD_MIN_WIDTH || (processed.height || 0) < env.UPLOAD_MIN_HEIGHT) {
            return NextResponse.json(
                {
                    error: `Image resolution too small. Minimum is ${env.UPLOAD_MIN_WIDTH}x${env.UPLOAD_MIN_HEIGHT}px.`,
                    width: processed.width ?? null,
                    height: processed.height ?? null,
                },
                { status: 400 }
            )
        }
        let registryAvailable = true
        try {
            await ensureMediaRegistryTable()
            const existing = await findMediaByChecksum(processed.checksum)
            const existingInFolder = existing.filter((item) => normalizeFolderFromObjectKey(item.object_key) === folder)
            const existingInFolderWithFiles = []
            for (const item of existingInFolder) {
                if (await mediaRowExists(item.object_key)) {
                    existingInFolderWithFiles.push(item)
                    continue
                }
                await prisma.$executeRaw`DELETE FROM "MediaAsset" WHERE "image_url" = ${item.image_url}`
            }
            if (existingInFolderWithFiles.length > 0) {
                const primary = existingInFolderWithFiles.find((item) => item.is_primary === 1) || existingInFolderWithFiles[0]
                return NextResponse.json({
                    success: false,
                    duplicate: true,
                    error: "This image has already been uploaded to this folder.",
                    url: primary.image_url,
                    variants: existingInFolderWithFiles.map((item) => ({
                        variant: item.variant,
                        url: item.image_url,
                        width: item.width,
                        height: item.height,
                    })),
                }, { status: 409 })
            }
        } catch (error) {
            registryAvailable = false
            logger.warn(
                "Media registry unavailable during duplicate check; continuing with filesystem upload",
                { error: error instanceof Error ? error.message : String(error) },
                "api-upload"
            )
        }

        const storage = getStorageProvider()
        const originalName = file.name || "image"
        const baseName = await resolveBaseName(folder, requestedBaseName, originalName.replace(/\.[^.]+$/, ""))
        const savedVariants: Array<{ variant: string; url: string; path: string; width?: number; height?: number; contentType: string; size: number }> = []

        for (const variant of processed.variants) {
            const filename = `${baseName}-${variant.variant}.${variant.ext}`
            const object = await storage.putObject({
                folder,
                filename,
                data: variant.buffer,
                contentType: variant.contentType,
                cacheControl: "public, max-age=31536000, immutable",
            })
            savedVariants.push({
                variant: variant.variant,
                url: object.url,
                path: object.path,
                width: variant.width,
                height: variant.height,
                contentType: variant.contentType,
                size: object.size,
            })
        }

        const master = savedVariants.find((item) => item.variant === "master") || savedVariants[0]
        if (registryAvailable) {
            try {
                for (const variant of savedVariants) {
                    await upsertMediaAsset({
                        id: `${baseName}-${variant.variant}`,
                        image_url: variant.url,
                        width: variant.width ?? processed.width ?? null,
                        height: variant.height ?? processed.height ?? null,
                        alt: "",
                        sort_order: variant.variant === "thumb" ? 0 : variant.variant === "large" ? 1 : 2,
                        is_primary: variant.url === master.url,
                        variant: variant.variant,
                        master_url: master.url,
                        checksum: processed.checksum,
                        mime_type: variant.contentType,
                        size_bytes: variant.size,
                        storage_provider: storage.name,
                        object_key: variant.path,
                    })
                }
            } catch (error) {
                logger.warn(
                    "Media registry unavailable during upload finalization; file saved without registry sync",
                    { error: error instanceof Error ? error.message : String(error) },
                    "api-upload"
                )
            }
        }

        return NextResponse.json({
            success: true,
            url: master.url,
            name: originalName,
            size: master.size,
            originalSize: file.size,
            mime: file.type,
            width: processed.width ?? null,
            height: processed.height ?? null,
            variants: {
                thumb: savedVariants.find((item) => item.variant === "thumb")?.url || master.url,
                large: savedVariants.find((item) => item.variant === "large")?.url || master.url,
                master: master.url,
            },
            image: {
                image_url: master.url,
                width: processed.width ?? null,
                height: processed.height ?? null,
                alt: "",
                sort_order: 0,
                is_primary: true,
            },
        })

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.toLowerCase().includes("content-type")) {
            logger.warn("Upload rejected due to invalid content type", { error: message }, "api-upload")
            return NextResponse.json(
                { error: "Invalid content type. Use multipart/form-data." },
                { status: 400 }
            )
        }
        logger.error(
            "Upload failed",
            { error: message },
            "api-upload"
        )
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
