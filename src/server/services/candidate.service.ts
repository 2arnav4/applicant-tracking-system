import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/server/db/types";
import { candidateActivities, candidates, jobs } from "@/server/db/schema";
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  isUniqueViolation,
} from "@/server/domain/errors";
import { STAGES, STAGE_LABELS, canTransition } from "@/shared/domain";
import type {
  CandidateCreate,
  CandidateListQuery,
  CandidateSort,
  CandidateUpdate,
  PipelineQuery,
  StageChange,
} from "@/shared/validation";

export const PIPELINE_LIMIT_PER_STAGE = 50;

const DUPLICATE_EMAIL_MESSAGE = "A candidate with this email already exists";

/** Escapes LIKE wildcards so user input is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const jobSummary = sql<{ id: string; title: string } | null>`
  case when ${jobs.id} is null then null
  else json_build_object('id', ${jobs.id}, 'title', ${jobs.title}) end`;

const SORTS: Record<CandidateSort, SQL[]> = {
  newest: [desc(candidates.createdAt)],
  oldest: [asc(candidates.createdAt)],
  name: [asc(candidates.name)],
  experience: [sql`${candidates.experienceYears} desc nulls last`],
  rating: [sql`${candidates.rating} desc nulls last`],
  updated: [desc(candidates.updatedAt)],
};

function searchCondition(q: string): SQL {
  const pattern = `%${escapeLike(q)}%`;
  return or(
    ilike(candidates.name, pattern),
    ilike(candidates.email, pattern),
    ilike(candidates.currentTitle, pattern),
    sql`exists (select 1 from unnest(${candidates.skills}) as skill where skill ilike ${pattern})`,
  )!;
}

export function createCandidateService(db: Database) {
  async function assertJobExists(tx: Database, jobId: string | null | undefined) {
    if (!jobId) return;
    const [job] = await tx.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId));
    if (!job) throw new NotFoundError("Job");
  }

  async function list(query: CandidateListQuery) {
    const conditions: SQL[] = [];
    if (query.q) conditions.push(searchCondition(query.q));
    if (query.stage) conditions.push(eq(candidates.stage, query.stage));
    if (query.jobId) conditions.push(eq(candidates.jobId, query.jobId));
    if (query.source) conditions.push(eq(candidates.source, query.source));
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          candidate: candidates,
          job: jobSummary,
        })
        .from(candidates)
        .leftJoin(jobs, eq(candidates.jobId, jobs.id))
        .where(where)
        // id as a final tiebreaker keeps pagination stable when sort keys collide.
        .orderBy(...SORTS[query.sort], asc(candidates.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      db.select({ total: count() }).from(candidates).where(where),
    ]);

    return {
      data: rows.map((row) => ({ ...row.candidate, job: row.job })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async function getById(id: string) {
    const candidate = await db.query.candidates.findFirst({
      where: eq(candidates.id, id),
      with: {
        job: { columns: { id: true, title: true } },
        activities: { orderBy: [desc(candidateActivities.createdAt)] },
      },
    });
    if (!candidate) throw new NotFoundError("Candidate");
    return candidate;
  }

  async function create(input: CandidateCreate) {
    try {
      const created = await db.transaction(async (tx) => {
        await assertJobExists(tx, input.jobId);
        const [candidate] = await tx.insert(candidates).values({ ...input, stage: "applied" }).returning();
        await tx.insert(candidateActivities).values({
          candidateId: candidate.id,
          type: "created",
          toStage: "applied",
        });
        return candidate;
      });
      return getById(created.id);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError(DUPLICATE_EMAIL_MESSAGE);
      throw error;
    }
  }

  async function update(id: string, input: CandidateUpdate) {
    try {
      await db.transaction(async (tx) => {
        await assertJobExists(tx, input.jobId);
        const [updated] = await tx
          .update(candidates)
          .set(input)
          .where(eq(candidates.id, id))
          .returning({ id: candidates.id });
        if (!updated) throw new NotFoundError("Candidate");
        await tx.insert(candidateActivities).values({
          candidateId: id,
          type: "updated",
          note: `Updated ${Object.keys(input).join(", ")}`,
        });
      });
      return getById(id);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError(DUPLICATE_EMAIL_MESSAGE);
      throw error;
    }
  }

  async function remove(id: string) {
    const [deleted] = await db
      .delete(candidates)
      .where(eq(candidates.id, id))
      .returning({ id: candidates.id });
    if (!deleted) throw new NotFoundError("Candidate");
  }

  /**
   * Moves a candidate to a new stage. The row is locked for the transaction so
   * two concurrent moves serialize; `fromStage` lets the client detect that it
   * acted on stale data (someone else moved the card first).
   */
  async function changeStage(id: string, change: StageChange) {
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ stage: candidates.stage })
        .from(candidates)
        .where(eq(candidates.id, id))
        .for("update");
      if (!current) throw new NotFoundError("Candidate");

      if (change.fromStage && change.fromStage !== current.stage) {
        throw new ConflictError(
          `This candidate is now in ${STAGE_LABELS[current.stage]} (changed elsewhere). Refresh and try again.`,
          { currentStage: current.stage },
        );
      }

      const check = canTransition(current.stage, change.stage);
      if (!check.ok) throw new BusinessRuleError(check.reason);

      await tx
        .update(candidates)
        .set({ stage: change.stage, stageUpdatedAt: new Date() })
        .where(eq(candidates.id, id));
      await tx.insert(candidateActivities).values({
        candidateId: id,
        type: "stage_changed",
        fromStage: current.stage,
        toStage: change.stage,
        note: change.note ?? null,
      });
    });
    return getById(id);
  }

  async function addNote(id: string, body: string) {
    const [exists] = await db.select({ id: candidates.id }).from(candidates).where(eq(candidates.id, id));
    if (!exists) throw new NotFoundError("Candidate");
    const [activity] = await db
      .insert(candidateActivities)
      .values({ candidateId: id, type: "note_added", note: body })
      .returning();
    return activity;
  }

  /** Board view: newest-moved cards per stage, capped per column, plus true column totals. */
  async function pipeline(query: PipelineQuery) {
    const conditions: SQL[] = [];
    if (query.q) conditions.push(searchCondition(query.q));
    if (query.jobId) conditions.push(eq(candidates.jobId, query.jobId));

    const cardFields = {
      id: candidates.id,
      name: candidates.name,
      email: candidates.email,
      currentTitle: candidates.currentTitle,
      rating: candidates.rating,
      skills: candidates.skills,
      stage: candidates.stage,
      stageUpdatedAt: candidates.stageUpdatedAt,
      experienceYears: candidates.experienceYears,
      job: jobSummary,
    };

    const [totals, ...columns] = await Promise.all([
      db
        .select({ stage: candidates.stage, total: count() })
        .from(candidates)
        .where(conditions.length ? and(...conditions) : undefined)
        .groupBy(candidates.stage),
      ...STAGES.map((stage) =>
        db
          .select(cardFields)
          .from(candidates)
          .leftJoin(jobs, eq(candidates.jobId, jobs.id))
          .where(and(eq(candidates.stage, stage), ...conditions))
          .orderBy(desc(candidates.stageUpdatedAt), asc(candidates.id))
          .limit(PIPELINE_LIMIT_PER_STAGE),
      ),
    ]);

    const totalByStage = new Map(totals.map((row) => [row.stage, row.total]));
    return {
      limitPerStage: PIPELINE_LIMIT_PER_STAGE,
      columns: STAGES.map((stage, index) => ({
        stage,
        total: totalByStage.get(stage) ?? 0,
        candidates: columns[index],
      })),
    };
  }

  return { list, getById, create, update, remove, changeStage, addNote, pipeline };
}

export type CandidateService = ReturnType<typeof createCandidateService>;
