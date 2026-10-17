import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "@/server/domain/errors";
import { createCandidateService } from "@/server/services/candidate.service";
import { createDashboardService } from "@/server/services/dashboard.service";
import { createJobService } from "@/server/services/job.service";
import { jobCreateSchema } from "@/shared/validation";
import { createTestDb, type TestDb } from "../helpers/db";
import { insertCandidate, insertJob } from "../helpers/factories";

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});
beforeEach(() => testDb.reset());
afterAll(() => testDb.close());

describe("dashboard metrics", () => {
  it("computes totals, stage counts and a monotonic funnel from the activity log", async () => {
    const dashboard = createDashboardService(testDb.db);
    await insertJob(testDb.db, { status: "open" });
    await insertJob(testDb.db, { status: "closed" });
    await insertCandidate(testDb.db, {}, ["applied"]);
    await insertCandidate(testDb.db, {}, ["applied", "screening"]);
    // Reached interview before rejection: must still count toward screening + interview.
    await insertCandidate(testDb.db, {}, ["applied", "screening", "interview", "rejected"]);
    // Skipped screening: still counts as having reached screening ("reached S or later").
    await insertCandidate(testDb.db, {}, ["applied", "interview", "offer", "hired"]);

    const metrics = await dashboard.getMetrics();

    expect(metrics.totals).toEqual({ candidates: 4, active: 2, hired: 1, rejected: 1, newLast30Days: 4, openJobs: 1 });
    expect(metrics.byStage.find((s) => s.stage === "rejected")?.count).toBe(1);
    expect(metrics.funnel).toEqual([
      { stage: "applied", reached: 4, conversionFromPrevious: null },
      { stage: "screening", reached: 3, conversionFromPrevious: 75 },
      { stage: "interview", reached: 2, conversionFromPrevious: 66.7 },
      { stage: "offer", reached: 1, conversionFromPrevious: 50 },
      { stage: "hired", reached: 1, conversionFromPrevious: 100 },
    ]);
  });

  it("averages time-to-hire from application to the hire event", async () => {
    const dashboard = createDashboardService(testDb.db);
    const now = Date.now();
    // 3 steps x 2 days = hired 6 days after applying; 3 steps x 4 days = 12 days.
    await insertCandidate(testDb.db, { createdAt: new Date(now - 20 * 86_400_000) }, ["applied", "interview", "offer", "hired"], 2);
    await insertCandidate(testDb.db, { createdAt: new Date(now - 20 * 86_400_000) }, ["applied", "interview", "offer", "hired"], 4);
    expect((await dashboard.getMetrics()).avgDaysToHire).toBe(9);
  });

  it("returns null time-to-hire and an all-zero funnel on an empty database", async () => {
    const metrics = await createDashboardService(testDb.db).getMetrics();
    expect(metrics.avgDaysToHire).toBeNull();
    expect(metrics.funnel.every((f) => f.reached === 0)).toBe(true);
    expect(metrics.recentActivity).toEqual([]);
  });

  it("zero-fills applications per day across the 30-day window", async () => {
    const dashboard = createDashboardService(testDb.db);
    const now = new Date();
    await insertCandidate(testDb.db, { createdAt: now });
    await insertCandidate(testDb.db, { createdAt: now });
    await insertCandidate(testDb.db, { createdAt: new Date(now.getTime() - 2 * 86_400_000) });
    await insertCandidate(testDb.db, { createdAt: new Date(now.getTime() - 60 * 86_400_000) }); // outside window

    const days = await dashboard.applicationsByDay(now);
    expect(days).toHaveLength(30);
    expect(days.at(-1)?.count).toBe(2);
    expect(days.at(-3)?.count).toBe(1);
    expect(days.reduce((sum, d) => sum + d.count, 0)).toBe(3);
  });
});

describe("job service", () => {
  it("lists jobs with candidate counts, open roles first", async () => {
    const jobs = createJobService(testDb.db);
    const closed = await insertJob(testDb.db, { title: "Closed role", status: "closed" });
    const open = await insertJob(testDb.db, { title: "Open role", status: "open" });
    await insertCandidate(testDb.db, { jobId: open.id }, ["applied"]);
    await insertCandidate(testDb.db, { jobId: open.id }, ["applied", "offer", "hired"]);
    await insertCandidate(testDb.db, { jobId: open.id }, ["applied", "rejected"]);

    const result = await jobs.list();
    expect(result.map((j) => j.title)).toEqual(["Open role", "Closed role"]);
    expect(result[0]).toMatchObject({ candidateCount: 3, activeCount: 1, hiredCount: 1 });
    expect(result[1]).toMatchObject({ id: closed.id, candidateCount: 0 });
  });

  it("creates, updates and deletes; deleting unlinks candidates instead of deleting them", async () => {
    const jobs = createJobService(testDb.db);
    const candidates = createCandidateService(testDb.db);
    const job = await jobs.create(jobCreateSchema.parse({ title: "QA Engineer", department: "Eng", location: "Pune" }));
    expect(job).toMatchObject({ status: "open", employmentType: "full_time" });

    expect(await jobs.update(job.id, { status: "on_hold" })).toMatchObject({ status: "on_hold", title: "QA Engineer" });

    const candidate = await insertCandidate(testDb.db, { jobId: job.id });
    await jobs.remove(job.id);
    expect((await candidates.getById(candidate.id)).jobId).toBeNull();
    await expect(jobs.getById(job.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
