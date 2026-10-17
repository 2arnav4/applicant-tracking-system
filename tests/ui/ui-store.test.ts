import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CANDIDATE_FILTERS, useUiStore } from "@/stores/ui-store";

beforeEach(() => {
  useUiStore.setState({ candidateFilters: DEFAULT_CANDIDATE_FILTERS, selectedCandidateId: null });
});

describe("ui store", () => {
  it("resets to page 1 whenever a filter changes", () => {
    useUiStore.getState().setCandidatePage(4);
    expect(useUiStore.getState().candidateFilters.page).toBe(4);

    useUiStore.getState().setCandidateFilters({ stage: "interview" });
    expect(useUiStore.getState().candidateFilters).toMatchObject({ stage: "interview", page: 1 });
  });

  it("opens and closes the candidate drawer", () => {
    useUiStore.getState().openCandidate("abc");
    expect(useUiStore.getState().selectedCandidateId).toBe("abc");
    useUiStore.getState().closeCandidate();
    expect(useUiStore.getState().selectedCandidateId).toBeNull();
  });

  it("persists preferences but never the search text, page or open panels", () => {
    useUiStore.getState().setCandidateFilters({ q: "react", sort: "rating" });
    useUiStore.getState().openCandidate("abc");
    const persisted = useUiStore.persist.getOptions().partialize!(useUiStore.getState()) as Record<string, unknown>;
    expect(persisted).toEqual({
      candidateFilters: { ...DEFAULT_CANDIDATE_FILTERS, sort: "rating" },
      pipelineFilters: { q: "", jobId: "" },
    });
  });
});
