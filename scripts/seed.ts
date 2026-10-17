import "dotenv/config";
import { faker } from "@faker-js/faker";
import { sql as rawSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/server/db/schema";
import { buildSeedData } from "./seed-data";

/**
 * Resets the database to a realistic demo dataset.
 * Destructive: truncates jobs, candidates and activities.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!process.argv.includes("--yes")) {
    throw new Error("Seeding wipes all data. Re-run with --yes to confirm (pnpm db:seed).");
  }

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema });
  faker.seed(2026);

  try {
    const data = buildSeedData(faker, new Date());
    await db.transaction(async (tx) => {
      await tx.execute(rawSql`truncate table candidate_activities, candidates, jobs restart identity cascade`);
      await tx.insert(schema.jobs).values(data.jobs);
      // Chunked inserts keep each statement well under Postgres' parameter limit.
      for (let i = 0; i < data.candidates.length; i += 100) {
        await tx.insert(schema.candidates).values(data.candidates.slice(i, i + 100));
      }
      for (let i = 0; i < data.activities.length; i += 200) {
        await tx.insert(schema.candidateActivities).values(data.activities.slice(i, i + 200));
      }
    });
    console.log(
      `Seeded ${data.jobs.length} jobs, ${data.candidates.length} candidates, ${data.activities.length} activities`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
