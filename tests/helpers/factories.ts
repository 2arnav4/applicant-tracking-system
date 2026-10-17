import { candidateActivities, candidates, jobs } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import type { Stage } from "@/shared/domain";

let counter = 0;
const next = () => ++counter;

export async function insertJob(db: Database, overrides: Partial<typeof jobs.$inferInsert> = {}) {
  const [job] = await db
    .insert(jobs)
    .values({ title: `Engineer ${next()}`, department: "Engineering", location: "Bengaluru", ...overrides })
    .returning();
  return job;
}

/**
 * Inserts a candidate plus a consistent activity history for the given stage path
 * (first entry = "created"), with explicit timestamps for metric tests.
 */
export async function insertCandidate(
  db: Database,
  overrides: Partial<typeof candidates.$inferInsert> = {},
  path: Stage[] = ["applied"],
  stepDays = 1,
) {
  const n = next();
  const createdAt = overrides.createdAt ?? new Date();
  const [candidate] = await db
    .insert(candidates)
    .values({
      name: `Candidate ${n}`,
      email: `candidate${n}@example.com`,
      ...overrides,
      stage: path[path.length - 1],
      createdAt,
    })
    .returning();

  await db.insert(candidateActivities).values(
    path.map((stage, index) => ({
      candidateId: candidate.id,
      type: index === 0 ? ("created" as const) : ("stage_changed" as const),
      fromStage: index === 0 ? null : path[index - 1],
      toStage: stage,
      createdAt: new Date(createdAt.getTime() + index * stepDays * 86_400_000),
    })),
  );
  return candidate;
}
