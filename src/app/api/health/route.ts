import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/server/db/client";

/** Liveness + database reachability, for uptime checks. */
export async function GET() {
  await connection();
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok", database: "up" });
  } catch (error) {
    console.error("[health] database check failed", error);
    return Response.json({ status: "degraded", database: "down" }, { status: 503 });
  }
}
