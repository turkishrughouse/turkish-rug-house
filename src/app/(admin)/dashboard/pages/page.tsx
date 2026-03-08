
import { Suspense } from "react"
import { PageList } from "@/components/admin/pages/page-list"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"

async function getPages(page: number, limit: number, search: string, status: string | undefined) {
    const skip = (page - 1) * limit
    const where: Prisma.PageWhereInput = {}

    if (status && status !== 'ALL') {
        where.status = status
    }

    if (search) {
        where.OR = [
            { title: { contains: search } },
            { slug: { contains: search } }
        ]
    }

    const [pages, total] = await Promise.all([
        prisma.page.findMany({
            where,
            skip,
            take: limit,
            orderBy: { updatedAt: 'desc' },
        }),
        prisma.page.count({ where })
    ])

    return {
        pages,
        metadata: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    }
}

export default async function PagesPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const page = Number(params.page) || 1
    const search = (params.search as string) || ""
    const status = (params.status as string) || "ALL"
    const limit = 20

    const { pages, metadata } = await getPages(page, limit, search, status)

    return (
        <div className="flex-1 space-y-8 p-8 pt-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Pages</h2>
                <p className="text-slate-600">
                    Manage static content pages.
                </p>
            </div>

            <div className="h-px bg-border-subtle" />

            <Suspense fallback={<div>Loading pages...</div>}>
                <PageList initialPages={pages} metadata={metadata} />
            </Suspense>
        </div>
    )
}
