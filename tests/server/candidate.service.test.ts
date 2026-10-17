import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { candidateActivities } from "@/server/db/schema";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/server/domain/errors";
import { createCandidateService, type CandidateService } from "@/server/services/candidate.service";
import { candidateCreateSchema, candidateListQuerySchema } from "@/shared/validation";
import { createTestDb, type TestDb } from "../helpers/db";
import { insertCandidate, insertJob } from "../helpers/factories";

let testDb: TestDb;
let service: CandidateService;

beforeAll(async () => {
  testDb = await createTestDb();
  service = createCandidateService(testDb.db);
});
beforeEach(() => testDb.reset());
afterAll(() => testDb.close());

const create = (input: Record<string, unknown>) => service.create(candidateCreateSchema.parse(input));
const list = (query: Record<string, unknown> = {}) => service.list(candidateListQuerySchema.parse(query));

describe("create", () => {
  it("creates the candidate in Applied with a 'created' activity", async () => {
    const job = await insertJob(testDb.db, { title: "Frontend Engineer" });
    const candidate = await create({ name: "Asha Rao", email: "asha@example.com", jobId: job.id, skills: ["React"] });

    expect(candidate).toMatchObject({ name: "Asha Rao", stage: "applied", skills: ["React"] });
    expect(candidate.job).toEqual({ id: job.id, title: "Frontend Engineer" });
    expect(candidate.activities).toHaveLength(1);
    expect(candidate.activities[0]).toMatchObject({ type: "created", toStage: "applied" });
  });

  it("rejects a duplicate email regardless of case with a ConflictError", async () => {
    await create({ name: "Asha Rao", email: "asha@example.com" });
    await expect(create({ name: "Other Asha", email: "ASHA@example.com" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects an unknown job and writes nothing (transaction rolls back)", async () => {
    await expect(
      create({ name: "Asha Rao", email: "asha@example.com", jobId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect((await list()).meta.total).toBe(0);
  });
});

describe("list", () => {
  beforeEach(async () => {
    const job = await insertJob(testDb.db, { title: "Backend" });
    await insertCandidate(testDb.db, { name: "Ravi Kumar", email: "ravi@corp.in", skills: ["Go", "PostgreSQL"], jobId: job.id, source: "referral", rating: 4 });
    await insertCandidate(testDb.db, { name: "Meera Iyer", email: "meera@corp.in", skills: ["React"], currentTitle: "Frontend Dev", rating: 5 }, ["applied", "screening"]);
    await insertCandidate(testDb.db, { name: "John 100% Real", email: "john@corp.in", skills: ["Python"] });
  });

  it("searches across name, email, title and skills (case-insensitive)", async () => {
    expect((await list({ q: "ravi" })).data.map((c) => c.name)).toEqual(["Ravi Kumar"]);
    expect((await list({ q: "postgres" })).data.map((c) => c.name)).toEqual(["Ravi Kumar"]);
    expect((await list({ q: "FRONTEND" })).data.map((c) => c.name)).toEqual(["Meera Iyer"]);
    expect((await list({ q: "corp.in" })).meta.total).toBe(3);
  });

  it("treats LIKE wildcards in the search literally", async () => {
    expect((await list({ q: "%" })).data.map((c) => c.name)).toEqual(["John 100% Real"]);
    expect((await list({ q: "_" })).meta.total).toBe(0);
  });

  it("filters by stage, source and job, and combines filters with search", async () => {
    expect((await list({ stage: "screening" })).data.map((c) => c.name)).toEqual(["Meera Iyer"]);
    expect((await list({ source: "referral" })).data.map((c) => c.name)).toEqual(["Ravi Kumar"]);
    expect((await list({ stage: "screening", q: "ravi" })).meta.total).toBe(0);
  });

  it("sorts and paginates with accurate metadata", async () => {
    const page1 = await list({ sort: "name", pageSize: 2, page: 1 });
    const page2 = await list({ sort: "name", pageSize: 2, page: 2 });
    expect(page1.data.map((c) => c.name)).toEqual(["John 100% Real", "Meera Iyer"]);
    expect(page2.data.map((c) => c.name)).toEqual(["Ravi Kumar"]);
    expect(page1.meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });

    const byRating = await list({ sort: "rating" });
    expect(byRating.data.map((c) => c.rating)).toEqual([5, 4, null]); // nulls last
  });
});

describe("update", () => {
  it("updates only the provided fields and logs an activity", async () => {
    const created = await create({ name: "Asha Rao", email: "asha@example.com", skills: ["React"], source: "linkedin" });
    const updated = await service.update(created.id, { phone: "+91 90000 00000" });
    expect(updated).toMatchObject({ phone: "+91 90000 00000", skills: ["React"], source: "linkedin" });
    expect(updated.activities[0]).toMatchObject({ type: "updated", note: "Updated phone" });
  });

  it("maps a duplicate email to ConflictError and a missing id to NotFoundError", async () => {
    await create({ name: "Asha Rao", email: "asha@example.com" });
    const other = await create({ name: "Ravi Kumar", email: "ravi@example.com" });
    await expect(service.update(other.id, { email: "asha@example.com" })).rejects.toBeInstanceOf(ConflictError);
    await expect(service.update("00000000-0000-4000-8000-000000000000", { name: "X Y" })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("changeStage", () => {
  it("moves the candidate, bumps stageUpdatedAt and records from/to in the activity log", async () => {
    const candidate = await insertCandidate(testDb.db, { stageUpdatedAt: new Date("2026-01-01") });
    const moved = await service.changeStage(candidate.id, { stage: "screening", fromStage: "applied", note: "Strong CV" });

    expect(moved.stage).toBe("screening");
    expect(new Date(moved.stageUpdatedAt).getTime()).toBeGreaterThan(new Date("2026-01-01").getTime());
    expect(moved.activities[0]).toMatchObject({ type: "stage_changed", fromStage: "applied", toStage: "screening", note: "Strong CV" });
  });

  it("enforces business rules with BusinessRuleError", async () => {
    const applied = await insertCandidate(testDb.db);
    await expect(service.changeStage(applied.id, { stage: "hired" })).rejects.toBeInstanceOf(BusinessRuleError);

    const hired = await insertCandidate(testDb.db, {}, ["applied", "offer", "hired"]);
    await expect(service.changeStage(hired.id, { stage: "rejected" })).rejects.toThrow("final stage");
  });

  it("detects a stale client (fromStage mismatch) and leaves the row untouched", async () => {
    const candidate = await insertCandidate(testDb.db, {}, ["applied", "interview"]);
    await expect(service.changeStage(candidate.id, { stage: "offer", fromStage: "applied" })).rejects.toBeInstanceOf(ConflictError);
    expect((await service.getById(candidate.id)).stage).toBe("interview");
  });

  it("serializes concurrent moves of the same card: exactly one wins", async () => {
    const candidate = await insertCandidate(testDb.db);
    const results = await Promise.allSettled([
      service.changeStage(candidate.id, { stage: "screening", fromStage: "applied" }),
      service.changeStage(candidate.id, { stage: "rejected", fromStage: "applied" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")[0]).toMatchObject({ reason: expect.any(ConflictError) });
  });

  it("throws NotFoundError for an unknown candidate", async () => {
    await expect(
      service.changeStage("00000000-0000-4000-8000-000000000000", { stage: "screening" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("notes and delete", () => {
  it("adds a note to the timeline", async () => {
    const candidate = await insertCandidate(testDb.db);
    const note = await service.addNote(candidate.id, "Great culture fit");
    expect(note).toMatchObject({ type: "note_added", note: "Great culture fit" });
    expect((await service.getById(candidate.id)).activities[0].id).toBe(note.id);
  });

  it("deletes the candidate and cascades their activities", async () => {
    const candidate = await insertCandidate(testDb.db, {}, ["applied", "screening"]);
    await service.remove(candidate.id);
    await expect(service.getById(candidate.id)).rejects.toBeInstanceOf(NotFoundError);
    const orphans = await testDb.db.select().from(candidateActivities).where(eq(candidateActivities.candidateId, candidate.id));
    expect(orphans).toHaveLength(0);
    await expect(service.remove(candidate.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("pipeline", () => {
  it("groups candidates into every stage column with totals, newest move first", async () => {
    const job = await insertJob(testDb.db);
    await insertCandidate(testDb.db, { name: "Old", stageUpdatedAt: new Date("2026-01-01"), jobId: job.id });
    await insertCandidate(testDb.db, { name: "New", stageUpdatedAt: new Date("2026-02-01") });
    await insertCandidate(testDb.db, { name: "Interviewing" }, ["applied", "interview"]);

    const board = await service.pipeline({});
    expect(board.columns.map((c) => c.stage)).toEqual(["applied", "screening", "interview", "offer", "hired", "rejected"]);
    const applied = board.columns[0];
    expect(applied.total).toBe(2);
    expect(applied.candidates.map((c) => c.name)).toEqual(["New", "Old"]);
    expect(applied.candidates[1].job).toEqual({ id: job.id, title: job.title });
    expect(board.columns[2].candidates.map((c) => c.name)).toEqual(["Interviewing"]);

    const filtered = await service.pipeline({ jobId: job.id });
    expect(filtered.columns.reduce((sum, c) => sum + c.total, 0)).toBe(1);
  });
});
