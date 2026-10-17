"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/features/query-keys";
import type { Activity, CandidateDetail, CandidateListItem, Paginated } from "@/shared/types";
import type { CandidateCreateInput, CandidateListQuery, StageChange } from "@/shared/validation";

/** Everything derived from candidate data: lists, board, dashboard metrics, job counts. */
export function invalidateCandidateViews(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
  ]);
}

export function useCandidates(query: Partial<CandidateListQuery>) {
  return useQuery({
    queryKey: queryKeys.candidates.list(query),
    queryFn: ({ signal }) => api.get<Paginated<CandidateListItem>>("/candidates", query, signal),
    // Keep the current page on screen while the next one loads (no table flash).
    placeholderData: keepPreviousData,
  });
}

export function useCandidate(id: string | null) {
  return useQuery({
    queryKey: queryKeys.candidates.detail(id ?? ""),
    queryFn: ({ signal }) => api.get<CandidateDetail>(`/candidates/${id}`, undefined, signal),
    enabled: Boolean(id),
  });
}

export function useCreateCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CandidateCreateInput) => api.post<CandidateDetail>("/candidates", input),
    onSuccess: (candidate) => {
      queryClient.setQueryData(queryKeys.candidates.detail(candidate.id), candidate);
      return invalidateCandidateViews(queryClient);
    },
  });
}

export function useUpdateCandidate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CandidateCreateInput>) => api.patch<CandidateDetail>(`/candidates/${id}`, input),
    onSuccess: (candidate) => {
      queryClient.setQueryData(queryKeys.candidates.detail(id), candidate);
      return invalidateCandidateViews(queryClient);
    },
  });
}

export function useDeleteCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/candidates/${id}`),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.candidates.detail(id) });
      return invalidateCandidateViews(queryClient);
    },
  });
}

export function useChangeStage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (change: StageChange) => api.patch<CandidateDetail>(`/candidates/${id}/stage`, change),
    onSuccess: (candidate) => {
      queryClient.setQueryData(queryKeys.candidates.detail(id), candidate);
      return invalidateCandidateViews(queryClient);
    },
  });
}

export function useAddNote(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post<Activity>(`/candidates/${id}/notes`, { body }),
    onSuccess: (activity) => {
      // Prepend locally so the timeline updates instantly, then let the dashboard refetch.
      queryClient.setQueryData<CandidateDetail>(queryKeys.candidates.detail(id), (prev) =>
        prev ? { ...prev, activities: [activity, ...prev.activities] } : prev,
      );
      return queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
