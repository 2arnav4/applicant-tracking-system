import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";
import * as schema from "./schema";
import type { Database } from "./types";

type GlobalWithDb = typeof globalThis & { __atsSql?: postgres.Sql };

/**
 * One connection pool per server instance. Cached on globalThis so dev-mode
 * hot reloads don't open a new pool on every edit.
 * `prepare: false` keeps it compatible with transaction-mode poolers (Neon/PgBouncer).
 */
function createSql() {
  return postgres(env().DATABASE_URL, { max: env().DB_POOL_MAX, prepare: false });
}

let database: Database | undefined;

export function getDb(): Database {
  if (database) return database;
  const globalRef = globalThis as GlobalWithDb;
  const sql = globalRef.__atsSql ?? createSql();
  if (process.env.NODE_ENV !== "production") globalRef.__atsSql = sql;
  database = drizzle(sql, { schema }) as unknown as Database;
  return database;
}
