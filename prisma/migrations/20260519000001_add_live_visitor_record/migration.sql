-- CreateTable
CREATE TABLE "LiveVisitorRecord" (
    "actorKey"     TEXT     NOT NULL PRIMARY KEY,
    "countryCode"  TEXT     NOT NULL DEFAULT 'ZZ',
    "countryName"  TEXT     NOT NULL DEFAULT 'Unknown',
    "customerName" TEXT     NOT NULL DEFAULT 'Guest',
    "action"       TEXT     NOT NULL DEFAULT 'Site visit',
    "browser"      TEXT     NOT NULL DEFAULT 'Other',
    "device"       TEXT     NOT NULL DEFAULT 'Other',
    "currentPath"  TEXT,
    "updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
