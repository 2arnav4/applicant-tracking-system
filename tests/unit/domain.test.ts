import { describe, expect, it } from "vitest";
import { canTransition, isStage, normalizeSkills, STAGES, type Stage } from "@/shared/domain";

describe("canTransition", () => {
  it.each<[Stage, Stage, boolean]>([
    ["applied", "screening", true],
    ["applied", "interview", true], // skipping screening is allowed
    ["screening", "applied", true], // moving back is allowed
    ["interview", "rejected", true],
    ["rejected", "screening", true], // reopening a rejected candidate
    ["offer", "hired", true],
    ["applied", "hired", false], // hire requires an offer
    ["interview", "hired", false],
    ["hired", "rejected", false], // hired is terminal
    ["hired", "offer", false],
  ])("%s -> %s is %s", (from, to, expected) => {
    expect(canTransition(from, to).ok).toBe(expected);
  });

  it("rejects a move to the same stage for every stage", () => {
    for (const stage of STAGES) {
      expect(canTransition(stage, stage).ok).toBe(false);
    }
  });

  it("explains why a transition is blocked", () => {
    const result = canTransition("applied", "hired");
    expect(result).toEqual({ ok: false, reason: "Only candidates in Offer can be moved to Hired" });
  });
});

describe("normalizeSkills", () => {
  it("trims, collapses whitespace and removes empties", () => {
    expect(normalizeSkills(["  React ", "", "   ", "Node   js"])).toEqual(["React", "Node js"]);
  });

  it("de-duplicates case-insensitively, keeping the first spelling", () => {
    expect(normalizeSkills(["TypeScript", "typescript", "TYPESCRIPT", "Go"])).toEqual(["TypeScript", "Go"]);
  });
});

describe("isStage", () => {
  it("narrows known stages and rejects others", () => {
    expect(isStage("offer")).toBe(true);
    expect(isStage("Offer")).toBe(false);
    expect(isStage("onboarding")).toBe(false);
  });
});
