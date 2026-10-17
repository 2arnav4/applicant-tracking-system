import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url({ error: "DATABASE_URL must be a valid Postgres connection string" }),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
});

let cached: z.infer<typeof envSchema> | undefined;

/** Validated server env, parsed lazily so `next build` doesn't need a database. */
export function env() {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
  }
  cached = parsed.data;
  return cached;
}
