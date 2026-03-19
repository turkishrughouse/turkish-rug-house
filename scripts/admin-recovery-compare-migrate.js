#!/usr/bin/env node

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SQLITE_DB = path.join(process.cwd(), "prisma/dev.db");
const PG_URL =
  process.env.DATABASE_URL ||
  "postgresql://rughouse:rughouse_lab_pw@127.0.0.1:5446/rughouse_recovery_test_20260315_164647";

const TARGET_TABLES = [
  "Order",
  "OrderItem",
  "OrderEvent",
  "Message",
  "CustomerMessage",
  "SupportTicket",
  "SupportFaq",
  "ProductReview",
  "ReviewAccess",
];

const MIGRATION_ORDER = [
  "SupportFaq",
  "Message",
  "Order",
  "OrderItem",
  "OrderEvent",
  "CustomerMessage",
  "ReviewAccess",
  "ProductReview",
  "SupportTicket",
];

const TABLE_METADATA = {
  Order: {
    primaryKey: "id",
    dependencies: ["userId -> User.id (nullable)"],
    fkColumns: [{ column: "userId", refTable: "User", refColumn: "id", nullable: true }],
  },
  OrderItem: {
    primaryKey: "id",
    dependencies: ["orderId -> Order.id", "productId -> Product.id (nullable)"],
    fkColumns: [
      { column: "orderId", refTable: "Order", refColumn: "id", nullable: false },
      { column: "productId", refTable: "Product", refColumn: "id", nullable: true },
    ],
  },
  OrderEvent: {
    primaryKey: "id",
    dependencies: ["orderId -> Order.id"],
    fkColumns: [{ column: "orderId", refTable: "Order", refColumn: "id", nullable: false }],
  },
  Message: {
    primaryKey: "id",
    dependencies: [],
    fkColumns: [],
  },
  CustomerMessage: {
    primaryKey: "id",
    dependencies: ["userId -> User.id", "orderId -> Order.id (nullable)"],
    fkColumns: [
      { column: "userId", refTable: "User", refColumn: "id", nullable: false },
      { column: "orderId", refTable: "Order", refColumn: "id", nullable: true },
    ],
  },
  SupportTicket: {
    primaryKey: "id",
    dependencies: ["userId -> User.id (nullable)"],
    fkColumns: [{ column: "userId", refTable: "User", refColumn: "id", nullable: true }],
  },
  SupportFaq: {
    primaryKey: "id",
    dependencies: [],
    fkColumns: [],
  },
  ProductReview: {
    primaryKey: "id",
    dependencies: ["productId -> Product.id"],
    fkColumns: [{ column: "productId", refTable: "Product", refColumn: "id", nullable: false }],
  },
  ReviewAccess: {
    primaryKey: "id",
    dependencies: ["userId -> User.id (nullable)"],
    fkColumns: [{ column: "userId", refTable: "User", refColumn: "id", nullable: true }],
  },
};

const FK_CHECKS = {
  CustomerProfile: [
    {
      name: "userId -> User.id",
      sql: 'SELECT COUNT(*) FROM "CustomerProfile" cp LEFT JOIN "User" u ON u."id" = cp."userId" WHERE cp."userId" IS NOT NULL AND u."id" IS NULL',
    },
  ],
  Order: [
    {
      name: "userId -> User.id",
      sql: 'SELECT COUNT(*) FROM "Order" o LEFT JOIN "User" u ON u."id" = o."userId" WHERE o."userId" IS NOT NULL AND u."id" IS NULL',
    },
  ],
  OrderItem: [
    {
      name: "orderId -> Order.id",
      sql: 'SELECT COUNT(*) FROM "OrderItem" oi LEFT JOIN "Order" o ON o."id" = oi."orderId" WHERE o."id" IS NULL',
    },
    {
      name: "productId -> Product.id",
      sql: 'SELECT COUNT(*) FROM "OrderItem" oi LEFT JOIN "Product" p ON p."id" = oi."productId" WHERE oi."productId" IS NOT NULL AND p."id" IS NULL',
    },
  ],
  OrderEvent: [
    {
      name: "orderId -> Order.id",
      sql: 'SELECT COUNT(*) FROM "OrderEvent" oe LEFT JOIN "Order" o ON o."id" = oe."orderId" WHERE o."id" IS NULL',
    },
  ],
  CustomerMessage: [
    {
      name: "userId -> User.id",
      sql: 'SELECT COUNT(*) FROM "CustomerMessage" cm LEFT JOIN "User" u ON u."id" = cm."userId" WHERE u."id" IS NULL',
    },
    {
      name: "orderId -> Order.id",
      sql: 'SELECT COUNT(*) FROM "CustomerMessage" cm LEFT JOIN "Order" o ON o."id" = cm."orderId" WHERE cm."orderId" IS NOT NULL AND o."id" IS NULL',
    },
  ],
  SupportTicket: [
    {
      name: "userId -> User.id",
      sql: 'SELECT COUNT(*) FROM "SupportTicket" st LEFT JOIN "User" u ON u."id" = st."userId" WHERE st."userId" IS NOT NULL AND u."id" IS NULL',
    },
  ],
  ProductReview: [
    {
      name: "productId -> Product.id",
      sql: 'SELECT COUNT(*) FROM "ProductReview" pr LEFT JOIN "Product" p ON p."id" = pr."productId" WHERE p."id" IS NULL',
    },
  ],
  ReviewAccess: [
    {
      name: "userId -> User.id",
      sql: 'SELECT COUNT(*) FROM "ReviewAccess" ra LEFT JOIN "User" u ON u."id" = ra."userId" WHERE ra."userId" IS NOT NULL AND u."id" IS NULL',
    },
  ],
  MenuItem: [
    {
      name: "menuId -> Menu.id",
      sql: 'SELECT COUNT(*) FROM "MenuItem" mi LEFT JOIN "Menu" m ON m."id" = mi."menuId" WHERE m."id" IS NULL',
    },
    {
      name: "parentId -> MenuItem.id",
      sql: 'SELECT COUNT(*) FROM "MenuItem" mi LEFT JOIN "MenuItem" parent ON parent."id" = mi."parentId" WHERE mi."parentId" IS NOT NULL AND parent."id" IS NULL',
    },
  ],
};

function sh(cmd, args, options = {}) {
  return execFileSync(cmd, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  }).trim();
}

function runSqlite(query, mode = "json") {
  const args = [SQLITE_DB];
  if (mode === "json") args.push("-json");
  args.push(query);
  const out = sh("sqlite3", args);
  if (!out) return mode === "json" ? [] : "";
  return mode === "json" ? JSON.parse(out) : out;
}

function runPsql(query) {
  return sh(
    "psql",
    [PG_URL, "-At", "-F", "\t", "-c", query],
    { env: { ...process.env, PAGER: "cat" } }
  );
}

function runPsqlJson(query) {
  const wrapped = `COPY (${query}) TO STDOUT WITH (FORMAT csv, HEADER true)`;
  const csv = sh(
    "psql",
    [PG_URL, "-c", wrapped],
    { env: { ...process.env, PAGER: "cat" } }
  );
  const lines = csv.split("\n").filter((line) => line && !line.startsWith("COPY "));
  if (lines.length <= 1) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] ?? "";
    });
    return obj;
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else if (char === '"') {
      inQuotes = true;
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function getSqliteColumns(table) {
  return runSqlite(`PRAGMA table_info(${quoteIdent(table)});`).map((row) => ({
    name: row.name,
    type: row.type,
    notnull: Number(row.notnull) === 1,
    pk: Number(row.pk) === 1,
  }));
}

function getPgColumns(table) {
  const rows = runPsqlJson(`
    SELECT column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${quoteLiteral(table)}
    ORDER BY ordinal_position
  `);
  return rows.map((row) => ({
    name: row.column_name,
    dataType: row.data_type,
    udtName: row.udt_name,
    nullable: row.is_nullable === "YES",
  }));
}

function getPrimaryKeyColumn(table) {
  const sqlitePk = getSqliteColumns(table).find((column) => column.pk);
  if (sqlitePk) return sqlitePk.name;
  return TABLE_METADATA[table]?.primaryKey || "id";
}

function getSqliteCount(table) {
  return Number(runSqlite(`SELECT COUNT(*) AS count FROM ${quoteIdent(table)};`)[0]?.count || 0);
}

function getPgCount(table) {
  const out = runPsql(`SELECT COUNT(*) FROM ${quoteIdent(table)};`);
  return Number(out || 0);
}

function getSqliteIds(table) {
  return runSqlite(`SELECT id FROM ${quoteIdent(table)} ORDER BY id;`).map((row) => row.id);
}

function getPgIds(table) {
  const out = runPsql(`SELECT id FROM ${quoteIdent(table)} ORDER BY id;`);
  return out ? out.split("\n").filter(Boolean) : [];
}

function compareTables() {
  return TARGET_TABLES.map((table) => {
    const sqliteColumns = getSqliteColumns(table);
    const pgColumns = getPgColumns(table);
    const sqliteCount = getSqliteCount(table);
    const pgCount = getPgCount(table);
    const sqliteIds = new Set(getSqliteIds(table));
    const pgIds = new Set(getPgIds(table));
    const missingIds = [...sqliteIds].filter((id) => !pgIds.has(id));
    const extraIds = [...pgIds].filter((id) => !sqliteIds.has(id));
    const sqliteColumnNames = sqliteColumns.map((column) => column.name);
    const pgColumnNames = pgColumns.map((column) => column.name);
    const safeDirect = JSON.stringify(sqliteColumnNames) === JSON.stringify(pgColumnNames);
    return {
      table,
      sqliteCount,
      postgresCount: pgCount,
      missingRows: missingIds.length,
      extraRows: extraIds.length,
      missingIds,
      extraIds,
      primaryKey: getPrimaryKeyColumn(table),
      dependencies: TABLE_METADATA[table]?.dependencies || [],
      safeDirect,
      transformNeeded: !safeDirect,
      sqliteColumns,
      pgColumns,
    };
  });
}

function renderValue(value, column) {
  if (value === null || value === undefined || value === "") {
    return "NULL";
  }

  const dataType = column.dataType;
  if (dataType === "boolean") {
    if (value === true || value === "1" || value === 1 || String(value).toLowerCase() === "true") return "TRUE";
    return "FALSE";
  }

  if (
    dataType === "integer" ||
    dataType === "bigint" ||
    dataType === "smallint" ||
    dataType === "numeric" ||
    dataType === "double precision" ||
    dataType === "real"
  ) {
    return String(value);
  }

  if (
    dataType === "timestamp without time zone" ||
    dataType === "timestamp with time zone" ||
    dataType === "date" ||
    dataType === "time without time zone" ||
    dataType === "time with time zone"
  ) {
    return quoteLiteral(normalizeTemporalValue(value));
  }

  return quoteLiteral(value);
}

function normalizeTemporalValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    if (value > 1e12) return new Date(value).toISOString();
    if (value > 1e9) return new Date(value * 1000).toISOString();
    return new Date(value).toISOString();
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      if (numeric > 1e12) return new Date(numeric).toISOString();
      if (numeric > 1e9) return new Date(numeric * 1000).toISOString();
    }
  }

  return String(value);
}

function fetchSqliteRowsByIds(table, ids) {
  if (!ids.length) return [];
  const idList = ids.map((id) => quoteLiteral(id)).join(", ");
  return runSqlite(`SELECT * FROM ${quoteIdent(table)} WHERE id IN (${idList}) ORDER BY id;`);
}

function getReferencedIdSet(table, column) {
  const out = runPsql(`SELECT ${quoteIdent(column)} FROM ${quoteIdent(table)};`);
  return new Set(out ? out.split("\n").filter(Boolean) : []);
}

function splitRowsByDependencies(table, rows) {
  const fkColumns = TABLE_METADATA[table]?.fkColumns || [];
  if (!fkColumns.length) {
    return { validRows: rows, orphanRows: [] };
  }

  const referenceSets = new Map();
  for (const fk of fkColumns) {
    const key = `${fk.refTable}.${fk.refColumn}`;
    if (!referenceSets.has(key)) {
      referenceSets.set(key, getReferencedIdSet(fk.refTable, fk.refColumn));
    }
  }

  const validRows = [];
  const orphanRows = [];

  for (const row of rows) {
    const failures = [];
    for (const fk of fkColumns) {
      const value = row[fk.column];
      if (value === null || value === undefined || value === "") {
        if (!fk.nullable) failures.push(`${fk.column} missing`);
        continue;
      }
      const refSet = referenceSets.get(`${fk.refTable}.${fk.refColumn}`);
      if (!refSet.has(String(value))) {
        failures.push(`${fk.column} -> ${fk.refTable}.${fk.refColumn} (${value})`);
      }
    }

    if (failures.length > 0) {
      orphanRows.push({ id: row.id, failures });
    } else {
      validRows.push(row);
    }
  }

  return { validRows, orphanRows };
}

function insertRows(table, rows, pgColumns) {
  if (!rows.length) return 0;

  const columnNames = pgColumns.map((column) => column.name);
  const insertSql = rows
    .map((row) => {
      const values = pgColumns.map((column) => renderValue(row[column.name], column)).join(", ");
      const columnsSql = columnNames.map(quoteIdent).join(", ");
      return `INSERT INTO ${quoteIdent(table)} (${columnsSql}) VALUES (${values}) ON CONFLICT (${quoteIdent("id")}) DO NOTHING;`;
    })
    .join("\n");

  const tempFile = path.join(os.tmpdir(), `rughouse-${table.toLowerCase()}-recovery.sql`);
  fs.writeFileSync(tempFile, `${insertSql}\n`, "utf8");
  sh("psql", [PG_URL, "-v", "ON_ERROR_STOP=1", "-f", tempFile], {
    env: { ...process.env, PAGER: "cat" },
  });

  return rows.length;
}

function migrateTable(table, missingIds) {
  const sourceCount = getSqliteCount(table);
  const targetCountBefore = getPgCount(table);
  const pgColumns = getPgColumns(table);
  if (!missingIds.length) {
    return {
      sourceCount,
      targetCountBefore,
      insertedRows: 0,
      targetCountAfter: targetCountBefore,
      orphanCount: 0,
      orphanRows: [],
      fkChecks: [],
    };
  }

  const rows = fetchSqliteRowsByIds(table, missingIds);
  if (!rows.length) {
    return {
      sourceCount,
      targetCountBefore,
      insertedRows: 0,
      targetCountAfter: targetCountBefore,
      orphanCount: 0,
      orphanRows: [],
      fkChecks: [],
    };
  }

  const { validRows, orphanRows } = splitRowsByDependencies(table, rows);
  const insertedRows = insertRows(table, validRows, pgColumns);
  const targetCountAfter = getPgCount(table);

  const fkChecks = (FK_CHECKS[table] || []).map((check) => ({
    name: check.name,
    orphans: Number(runPsql(check.sql) || 0),
  }));

  return {
    sourceCount,
    targetCountBefore,
    insertedRows,
    targetCountAfter,
    orphanCount: orphanRows.length,
    orphanRows,
    fkChecks,
  };
}

function printReport(report) {
  console.log("table\tsqlite_count\tpostgres_count\tmissing_rows\tprimary_key\tforeign_key_dependencies\tmigration_mode");
  for (const row of report) {
    console.log(
      [
        row.table,
        row.sqliteCount,
        row.postgresCount,
        row.missingRows,
        row.primaryKey,
        row.dependencies.length ? row.dependencies.join("|") : "none",
        row.safeDirect ? "safe_direct" : "transform_needed",
      ].join("\t")
    );
  }
}

function main() {
  const mode = process.argv[2] || "compare";
  const initialReport = compareTables();
  console.log("Initial diff report");
  printReport(initialReport);

  if (mode !== "migrate") return;

  console.log("\nMigration results");
  console.log("table\tsource_count\ttarget_count_before\tinserted_rows\ttarget_count_after\torphan_count\tfk_orphans");

  for (const table of MIGRATION_ORDER) {
    const row = initialReport.find((entry) => entry.table === table);
    if (!row) continue;

    const result = migrateTable(table, row.missingIds);
    const fkSummary =
      result.fkChecks.length > 0
        ? result.fkChecks.map((check) => `${check.name}:${check.orphans}`).join("|")
        : "n/a";

    console.log(
      [
        table,
        result.sourceCount,
        result.targetCountBefore,
        result.insertedRows,
        result.targetCountAfter,
        result.orphanCount,
        fkSummary,
      ].join("\t")
    );

    if (result.orphanRows.length > 0) {
      console.log(`ORPHANS\t${table}\t${result.orphanRows.map((row) => `${row.id}:${row.failures.join(",")}`).join("|")}`);
    }
  }

  console.log("\nFinal diff report");
  printReport(compareTables());
}

main();
