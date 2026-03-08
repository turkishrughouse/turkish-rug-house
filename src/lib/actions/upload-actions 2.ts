"use server"

import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { v4 as uuidv4 } from "uuid"

export async function uploadImage(formData: FormData) {
    const file = formData.get("file") as File
    if (!file) {
        return { success: false, error: "No file provided" }
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Create unique filename
    const uniqueId = uuidv4()
    const originalName = file.name
    const extension = originalName.split('.').pop()
    const fileName = `${uniqueId}.${extension}`

    // Ensure uploads directory exists
    const uploadDir = join(process.cwd(), "public", "uploads")
    try {
        await mkdir(uploadDir, { recursive: true })

        // Write file
        const filePath = join(uploadDir, fileName)
        await writeFile(filePath, buffer)

        return {
            success: true,
            url: `/uploads/${fileName}`,
            name: originalName,
            size: file.size
        }
    } catch (error) {
        console.error("Upload Error:", error)
        return { success: false, error: "Failed to upload file" }
    }
}
