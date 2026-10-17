import { desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/server/db/types";
import { candidates, jobs } from "@/server/db/schema";
import { NotFoundError } from "@/server/domain/errors";
import type { JobCreate, JobUpdate } from "@/shared/validation";

export function createJobService(db: Database) {
  async function list() {
    return db
      .select({
        ...jobsColumns(),
        candidateCount: sql<number>`count(${candidates.id})`.mapWith(Number),
        activeCount: sql<number>`count(${candidates.id}) filter (where ${candidates.stage} not in ('hired', 'rejected'))`.mapWith(Number),
        hiredCount: sql<number>`count(${candidates.id}) filter (where ${candidates.stage} = 'hired')`.mapWith(Number),
      })
      .from(jobs)
      .leftJoin(candidates, eq(candidates.jobId, jobs.id))
      .groupBy(jobs.id)
      // Open roles first, then most recent.
      .orderBy(sql`case ${jobs.status} when 'open' then 0 when 'on_hold' then 1 else 2 end`, desc(jobs.createdAt));
  }

  async function getById(id: string) {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    if (!job) throw new NotFoundError("Job");
    return job;
  }

  async function create(input: JobCreate) {
    const [job] = await db.insert(jobs).values(input).returning();
    return job;
  }

  async function update(id: string, input: JobUpdate) {
    const [job] = await db.update(jobs).set(input).where(eq(jobs.id, id)).returning();
    if (!job) throw new NotFoundError("Job");
    return job;
  }

  /** Candidates keep their history; their job link is cleared by the FK (ON DELETE SET NULL). */
  async function remove(id: string) {
    const [deleted] = await db.delete(jobs).where(eq(jobs.id, id)).returning({ id: jobs.id });
    if (!deleted) throw new NotFoundError("Job");
  }

  return { list, getById, create, update, remove };
}

function jobsColumns() {
  return {
    id: jobs.id,
    title: jobs.title,
    department: jobs.department,
    location: jobs.location,
    employmentType: jobs.employmentType,
    status: jobs.status,
    description: jobs.description,
    createdAt: jobs.createdAt,
    updatedAt: jobs.updatedAt,
  };
}

export type JobService = ReturnType<typeof createJobService>;
