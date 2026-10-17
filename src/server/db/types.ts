import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * Driver-agnostic database handle. Production uses postgres-js, tests use
 * in-memory PGlite; services only depend on this shared query-builder type.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
