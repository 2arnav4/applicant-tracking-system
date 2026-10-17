import { describe, expect, it } from "vitest";
import { moveCard } from "@/features/pipeline/move-card";
import { escapeLike } from "@/server/services/candidate.service";
import { conversionRate, lastNDays } from "@/server/services/dashboard.service";
import { initials } from "@/lib/utils";
import type { Pipeline, PipelineCard } from "@/shared/types";

const card = (id: string, stage: PipelineCard["stage"]): PipelineCard => ({
  id,
  name: `Person ${id}`,
  email: `${id}@example.com`,
  currentTitle: null,
  rating: null,
  skills: [],
  stage,
  stageUpdatedAt: "2026-10-01T00:00:00.000Z",
  experienceYears: null,
  job: null,
});

const board = (): Pipeline => ({
  limitPerStage: 50,
  columns: [
    { stage: "applied", total: 2, candidates: [card("a", "applied"), card("b", "applied")] },
    { stage: "screening", total: 1, candidates: [card("c", "screening")] },
    { stage: "interview", total: 0, candidates: [] },
    { stage: "offer", total: 0, candidates: [] },
    { stage: "hired", total: 0, candidates: [] },
    { stage: "rejected", total: 0, candidates: [] },
  ],
});

describe("moveCard (optimistic board update)", () => {
  it("moves the card to the top of the target column and adjusts totals", () => {
    const result = moveCard(board(), "b", "applied", "screening", "2026-10-17T10:00:00.000Z");
    const [applied, screening] = result.columns;
    expect(applied.total).toBe(1);
    expect(applied.candidates.map((c) => c.id)).toEqual(["a"]);
    expect(screening.total).toBe(2);
    expect(screening.candidates[0]).toMatchObject({ id: "b", stage: "screening", stageUpdatedAt: "2026-10-17T10:00:00.000Z" });
  });

  it("does not mutate the input (the cache snapshot must stay intact for rollback)", () => {
    const original = board();
    const snapshot = structuredClone(original);
    moveCard(original, "a", "applied", "interview", "2026-10-17T10:00:00.000Z");
    expect(original).toEqual(snapshot);
  });

  it("returns the same board when the card is not in the source column", () => {
    const original = board();
    expect(moveCard(original, "c", "applied", "offer", "x")).toBe(original);
  });
});

describe("escapeLike", () => {
  it("escapes LIKE wildcards and the escape character", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("dashboard helpers", () => {
  it("lastNDays returns consecutive UTC days ending today", () => {
    const days = lastNDays(3, new Date("2026-03-01T05:00:00Z"));
    expect(days).toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
  });

  it("conversionRate rounds to one decimal and handles a zero base", () => {
    expect(conversionRate(2, 3)).toBe(66.7);
    expect(conversionRate(0, 0)).toBeNull();
  });
});

describe("initials", () => {
  it.each([
    ["Arnav Singla", "AS"],
    ["madonna", "M"],
    ["Jean Claude Van Damme", "JD"],
    ["   ", "?"],
  ])("%s -> %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
