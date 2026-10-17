import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createCandidateService } from "@/server/services/candidate.service";
import { createDashboardService } from "@/server/services/dashboard.service";
import { createJobService } from "@/server/services/job.service";
import { createTestDb, type TestDb } from "../helpers/db";

/**
 * Route handlers run for real (parsing, validation, status codes, error shape);
 * only the composition root is swapped to point at an in-memory database.
 */
let testDb: TestDb;
let container: ReturnType<typeof build>;
const build = (db: TestDb["db"]) => ({
  candidates: createCandidateService(db),
  jobs: createJobService(db),
  dashboard: createDashboardService(db),
});

vi.mock("@/server/container", () => ({ services: () => container }));
// connection() only signals "dynamic" to Next's renderer; outside a request it has nothing to do.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

const candidatesRoute = await import("@/app/api/candidates/route");
const candidateRoute = await import("@/app/api/candidates/[id]/route");
const stageRoute = await import("@/app/api/candidates/[id]/stage/route");
const dashboardRoute = await import("@/app/api/dashboard/route");

const url = (path: string) => `http://localhost/api${path}`;
const json = (path: string, method: string, body: unknown) =>
  new NextRequest(url(path), {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  testDb = await createTestDb();
  container = build(testDb.db);
});
beforeEach(() => testDb.reset());
afterAll(() => testDb.close());

describe("POST /api/candidates", () => {
  it("returns 201 with the created candidate", async () => {
    const res = await candidatesRoute.POST(json("/candidates", "POST", { name: "Asha Rao", email: "asha@example.com" }), undefined);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ name: "Asha Rao", stage: "applied" });
  });

  it("returns 400 with per-field errors for invalid input", async () => {
    const res = await candidatesRoute.POST(json("/candidates", "POST", { name: "A", email: "nope" }), undefined);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(body.error.details.fieldErrors)).toEqual(expect.arrayContaining(["name", "email"]));
  });

  it("returns 400 for a malformed JSON body", async () => {
    const res = await candidatesRoute.POST(json("/candidates", "POST", "{not json"), undefined);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("BAD_REQUEST");
  });

  it("returns 409 for a duplicate email", async () => {
    await candidatesRoute.POST(json("/candidates", "POST", { name: "Asha Rao", email: "asha@example.com" }), undefined);
    const res = await candidatesRoute.POST(json("/candidates", "POST", { name: "Asha Two", email: "Asha@Example.com" }), undefined);
    expect(res.status).toBe(409);
  });
});

describe("GET /api/candidates", () => {
  it("parses query params, ignoring empty ones", async () => {
    await candidatesRoute.POST(json("/candidates", "POST", { name: "Asha Rao", email: "asha@example.com" }), undefined);
    const res = await candidatesRoute.GET(new NextRequest(url("/candidates?q=asha&stage=&pageSize=5")), undefined);
    expect(res.status).toBe(200);
    expect((await res.json()).meta).toMatchObject({ total: 1, pageSize: 5 });
  });

  it("rejects an invalid filter value with 400", async () => {
    const res = await candidatesRoute.GET(new NextRequest(url("/candidates?stage=onboarding")), undefined);
    expect(res.status).toBe(400);
  });
});

describe("/api/candidates/[id]", () => {
  it("returns 400 for a malformed id and 404 for an unknown one", async () => {
    const bad = await candidateRoute.GET(new NextRequest(url("/candidates/123")), ctx("123"));
    expect(bad.status).toBe(400);
    const missing = "00000000-0000-4000-8000-000000000000";
    const notFound = await candidateRoute.GET(new NextRequest(url(`/candidates/${missing}`)), ctx(missing));
    expect(notFound.status).toBe(404);
    expect((await notFound.json()).error).toEqual({ code: "NOT_FOUND", message: "Candidate not found" });
  });

  it("deletes with 204", async () => {
    const created = await (await candidatesRoute.POST(json("/candidates", "POST", { name: "Asha Rao", email: "asha@example.com" }), undefined)).json();
    const res = await candidateRoute.DELETE(new NextRequest(url(`/candidates/${created.id}`), { method: "DELETE" }), ctx(created.id));
    expect(res.status).toBe(204);
  });
});

describe("PATCH /api/candidates/[id]/stage", () => {
  it("returns 200 for a valid move, 422 for a rule violation, 409 for a stale client", async () => {
    const created = await (await candidatesRoute.POST(json("/candidates", "POST", { name: "Asha Rao", email: "asha@example.com" }), undefined)).json();
    const path = `/candidates/${created.id}/stage`;

    const illegal = await stageRoute.PATCH(json(path, "PATCH", { stage: "hired" }), ctx(created.id));
    expect(illegal.status).toBe(422);

    const ok = await stageRoute.PATCH(json(path, "PATCH", { stage: "screening", fromStage: "applied" }), ctx(created.id));
    expect(ok.status).toBe(200);
    expect((await ok.json()).stage).toBe("screening");

    const stale = await stageRoute.PATCH(json(path, "PATCH", { stage: "interview", fromStage: "applied" }), ctx(created.id));
    expect(stale.status).toBe(409);
    expect((await stale.json()).error.details).toEqual({ currentStage: "screening" });
  });
});

describe("GET /api/dashboard", () => {
  it("returns the metrics payload", async () => {
    const res = await dashboardRoute.GET(new NextRequest(url("/dashboard")), undefined);
    expect(res.status).toBe(200);
    expect(Object.keys(await res.json())).toEqual(
      expect.arrayContaining(["totals", "byStage", "funnel", "avgDaysToHire", "applicationsByDay", "bySource", "recentActivity"]),
    );
  });
});

describe("unexpected errors", () => {
  it("returns a generic 500 without leaking internals", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const original = container.candidates.list;
    container.candidates.list = async () => {
      throw new Error("connection string with password leaked");
    };
    const res = await candidatesRoute.GET(new NextRequest(url("/candidates")), undefined);
    container.candidates.list = original;
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
    spy.mockRestore();
  });
});
