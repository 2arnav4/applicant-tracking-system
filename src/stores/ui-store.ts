import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Source, Stage } from "@/shared/domain";
import type { CandidateSort } from "@/shared/validation";

/**
 * Client-only UI state. Server data lives in TanStack Query; this store holds
 * what the user is looking at: filters, sort, pagination and open panels.
 */

export type CandidateFilters = {
  q: string;
  stage: Stage | "";
  jobId: string;
  source: Source | "";
  sort: CandidateSort;
  page: number;
  pageSize: number;
};

export const DEFAULT_CANDIDATE_FILTERS: CandidateFilters = {
  q: "",
  stage: "",
  jobId: "",
  source: "",
  sort: "newest",
  page: 1,
  pageSize: 20,
};

type UiState = {
  candidateFilters: CandidateFilters;
  pipelineFilters: { q: string; jobId: string };
  /** Candidate shown in the global detail drawer (null = closed). */
  selectedCandidateId: string | null;
  candidateFormOpen: boolean;

  setCandidateFilters: (patch: Partial<Omit<CandidateFilters, "page">>) => void;
  setCandidatePage: (page: number) => void;
  resetCandidateFilters: () => void;
  setPipelineFilters: (patch: Partial<UiState["pipelineFilters"]>) => void;
  openCandidate: (id: string) => void;
  closeCandidate: () => void;
  setCandidateFormOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      candidateFilters: DEFAULT_CANDIDATE_FILTERS,
      pipelineFilters: { q: "", jobId: "" },
      selectedCandidateId: null,
      candidateFormOpen: false,

      // Any filter change resets to page 1, otherwise you can land on an empty page.
      setCandidateFilters: (patch) =>
        set((state) => ({ candidateFilters: { ...state.candidateFilters, ...patch, page: 1 } })),
      setCandidatePage: (page) =>
        set((state) => ({ candidateFilters: { ...state.candidateFilters, page } })),
      resetCandidateFilters: () => set({ candidateFilters: DEFAULT_CANDIDATE_FILTERS }),
      setPipelineFilters: (patch) =>
        set((state) => ({ pipelineFilters: { ...state.pipelineFilters, ...patch } })),
      openCandidate: (id) => set({ selectedCandidateId: id }),
      closeCandidate: () => set({ selectedCandidateId: null }),
      setCandidateFormOpen: (open) => set({ candidateFormOpen: open }),
    }),
    {
      name: "ats-ui",
      version: 1,
      // Rehydrated after mount (see Providers) so server and first client render match.
      skipHydration: true,
      // Persist preferences only; never re-open panels or keep stale search text on reload.
      partialize: (state) => ({
        candidateFilters: { ...state.candidateFilters, q: "", page: 1 },
        pipelineFilters: { ...state.pipelineFilters, q: "" },
      }),
    },
  ),
);
