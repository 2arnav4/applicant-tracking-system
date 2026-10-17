import { describe, expect, it } from "vitest";
import {
  candidateCreateSchema,
  candidateListQuerySchema,
  candidateUpdateSchema,
  jobUpdateSchema,
  stageChangeSchema,
} from "@/shared/validation";

describe("candidateCreateSchema", () => {
  it("normalizes email (trim + lowercase) before validating it", () => {
    const parsed = candidateCreateSchema.parse({ name: "Asha Rao", email: "  Asha.Rao@Example.COM " });
    expect(parsed.email).toBe("asha.rao@example.com");
  });

  it("applies defaults for skills and source on create", () => {
    const parsed = candidateCreateSchema.parse({ name: "Asha Rao", email: "asha@example.com" });
    expect(parsed.skills).toEqual([]);
    expect(parsed.source).toBe("other");
  });

  it("turns empty optional strings into null", () => {
    const parsed = candidateCreateSchema.parse({
      name: "Asha Rao",
      email: "asha@example.com",
      phone: "  ",
      linkedinUrl: "",
    });
    expect(parsed.phone).toBeNull();
    expect(parsed.linkedinUrl).toBeNull();
  });

  it.each([
    [{ name: "A", email: "a@b.co" }, "name"],
    [{ name: "Asha", email: "not-an-email" }, "email"],
    [{ name: "Asha", email: "a@b.co", rating: 6 }, "rating"],
    [{ name: "Asha", email: "a@b.co", experienceYears: -1 }, "experienceYears"],
    [{ name: "Asha", email: "a@b.co", linkedinUrl: "javascript:alert(1)" }, "linkedinUrl"],
    [{ name: "Asha", email: "a@b.co", jobId: "123" }, "jobId"],
    [{ name: "Asha", email: "a@b.co", source: "twitter" }, "source"],
  ])("rejects invalid input %#", (input, field) => {
    const result = candidateCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toContain(field);
  });
});

describe("update schemas (regression: Zod 4 applies defaults inside .partial())", () => {
  it("does not inject defaults for omitted candidate fields", () => {
    expect(candidateUpdateSchema.parse({ name: "New Name" })).toEqual({ name: "New Name" });
  });

  it("does not inject defaults for omitted job fields", () => {
    expect(jobUpdateSchema.parse({ status: "closed" })).toEqual({ status: "closed" });
  });

  it("rejects an empty update", () => {
    expect(candidateUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("candidateListQuerySchema", () => {
  it("coerces query-string numbers and applies defaults", () => {
    expect(candidateListQuerySchema.parse({ page: "3" })).toEqual({ page: 3, pageSize: 20, sort: "newest" });
  });

  it("caps page size to protect the database", () => {
    expect(candidateListQuerySchema.safeParse({ pageSize: "1000" }).success).toBe(false);
  });

  it("rejects unknown stages and sorts", () => {
    expect(candidateListQuerySchema.safeParse({ stage: "onboarding" }).success).toBe(false);
    expect(candidateListQuerySchema.safeParse({ sort: "salary" }).success).toBe(false);
  });
});

describe("stageChangeSchema", () => {
  it("accepts an optional fromStage and note", () => {
    expect(stageChangeSchema.parse({ stage: "offer", fromStage: "interview", note: "" })).toEqual({
      stage: "offer",
      fromStage: "interview",
      note: null,
    });
  });
});
