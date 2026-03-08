import { PrismaClient } from '@prisma/client'
import { getEnv } from "@/lib/env"

getEnv()

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Force reload for schema changes
