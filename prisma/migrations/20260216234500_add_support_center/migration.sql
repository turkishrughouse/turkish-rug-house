-- CreateTable
CREATE TABLE "SupportFaq" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answerShort" TEXT NOT NULL,
    "answerLong" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "category" TEXT NOT NULL,
    "subType" TEXT,
    "orderNumber" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "faqViewed" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SupportFaq_category_isFeatured_updatedAt_idx" ON "SupportFaq"("category", "isFeatured", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "SupportTicket_userId_createdAt_idx" ON "SupportTicket"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SupportTicket_email_createdAt_idx" ON "SupportTicket"("email", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SupportTicket_category_status_createdAt_idx" ON "SupportTicket"("category", "status", "createdAt" DESC);
