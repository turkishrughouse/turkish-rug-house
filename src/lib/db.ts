import { PrismaClient } from '@prisma/client'
import { getEnv } from "@/lib/env"
import path from "path"

const env = getEnv()

function resolveDatasourceUrl() {
    const raw = env.DATABASE_URL
    if (raw === "file:./dev.db") {
        return `file:${path.join(process.cwd(), "prisma", "dev.db")}`
    }
    return raw
}

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
    prismaDatasourceUrl: string | undefined
}

const datasourceUrl = resolveDatasourceUrl()

if (!globalForPrisma.prisma || globalForPrisma.prismaDatasourceUrl !== datasourceUrl) {
    globalForPrisma.prisma = new PrismaClient({
        datasources: {
            db: {
                url: datasourceUrl,
            },
        },
    })
    globalForPrisma.prismaDatasourceUrl = datasourceUrl
}

export const prisma = globalForPrisma.prisma

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Force reload for schema changes
