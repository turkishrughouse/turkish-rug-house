import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { PageForm } from "@/components/admin/pages/page-form"


interface EditPagePageProps {
    params: Promise<{
        id: string
    }>
}

export default async function EditPagePage({ params }: EditPagePageProps) {
    const { id } = await params
    const page = await prisma.page.findUnique({
        where: { id }
    })

    if (!page) {
        notFound()
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageForm initialData={page} />
        </div>
    )
}
