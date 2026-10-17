import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/server/db/schema";
import type { Database } from "@/server/db/types";

/**
 * In-memory Postgres (PGlite) with the real migrations applied, so service
 * tests exercise actual SQL (enums, constraints, FILTER, unnest, ILIKE)
 * instead of mocks.
 */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return {
    db: db as unknown as Database,
    reset: () => db.execute(sql`truncate table candidate_activities, candidates, jobs cascade`),
    close: () => client.close(),
  };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
