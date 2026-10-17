import type { CandidateListQuery, PipelineQuery } from "@/shared/validation";

/**
 * Query key factory. Hierarchical keys let one invalidation hit every
 * variant (e.g. `candidates.all` refreshes every list page and detail).
 */
export const queryKeys = {
  candidates: {
    all: ["candidates"] as const,
    lists: () => [...queryKeys.candidates.all, "list"] as const,
    list: (query: Partial<CandidateListQuery>) => [...queryKeys.candidates.lists(), query] as const,
    detail: (id: string) => [...queryKeys.candidates.all, "detail", id] as const,
  },
  pipeline: {
    all: ["pipeline"] as const,
    board: (query: Partial<PipelineQuery>) => [...queryKeys.pipeline.all, query] as const,
  },
  jobs: {
    all: ["jobs"] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
  },
};
