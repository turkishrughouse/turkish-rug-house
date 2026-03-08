"use client"

import { useState } from "react"
import { Upload, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface MediaUploaderProps {
    images: string[]
    onImagesChange: (images: string[]) => void
}

export function MediaUploader({ images, onImagesChange }: MediaUploaderProps) {
    const [isUploading, setIsUploading] = useState(false)

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0]
            setIsUploading(true)

            // Client-side logging to confirm path
            console.log("CLIENT UPLOAD via /api/upload")

            try {
                const formData = new FormData()
                formData.append("file", file)

                // Fetch directly to API route
                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                })

                if (!res.ok) {
                    throw new Error(`Upload failed with status: ${res.status}`)
                }

                const data = await res.json()

                if (data.success && data.url) {
                    const updated = [...images, data.url]
                    onImagesChange(updated)
                    toast.success("Image uploaded successfully")
                } else {
                    toast.error(data.error || "Failed to upload image")
                }
            } catch (error) {
                console.error("Client Upload Error:", error)
                toast.error("Error uploading image")
            } finally {
                setIsUploading(false)
                // Reset input
                e.target.value = ""
            }
        }
    }

    const removeImage = (index: number) => {
        const updated = images.filter((_, i) => i !== index)
        onImagesChange(updated)
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {images.map((img, i) => (
                    <div key={i} className="relative aspect-[4/3] group overflow-hidden rounded-lg border bg-muted shadow-sm transition-all hover:shadow-md">
                        <img src={img} alt="" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => removeImage(i)}
                                className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-red-50 text-red-600 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add Media Button */}
                <div className="relative aspect-[4/3] cursor-pointer space-y-2 rounded-lg border-2 border-dashed p-4 transition-colors hover:bg-muted/50 flex flex-col items-center justify-center">
                    <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                    />
                    {isUploading ? (
                        <Loader2 className="h-8 w-8 text-muted-foreground/50 animate-spin" />
                    ) : (
                        <Upload className="h-8 w-8 text-muted-foreground/50" />
                    )}
                    <span className="text-xs text-muted-foreground font-medium text-center">
                        {isUploading ? "Uploading..." : "Upload"}
                    </span>
                </div>
            </div>
        </div>
    )
}
