"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/features/query-keys";
import type { Job, JobWithStats } from "@/shared/types";
import type { JobCreateInput } from "@/shared/validation";

export function useJobs() {
  return useQuery({
    queryKey: queryKeys.jobs.all,
    queryFn: ({ signal }) => api.get<JobWithStats[]>("/jobs", undefined, signal),
    staleTime: 60_000,
  });
}

function useInvalidateJobViews() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      // Job titles appear on candidate rows and pipeline cards.
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.all }),
    ]);
}

export function useCreateJob() {
  const invalidate = useInvalidateJobViews();
  return useMutation({
    mutationFn: (input: JobCreateInput) => api.post<Job>("/jobs", input),
    onSuccess: invalidate,
  });
}

export function useUpdateJob() {
  const invalidate = useInvalidateJobViews();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<JobCreateInput> }) =>
      api.patch<Job>(`/jobs/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteJob() {
  const invalidate = useInvalidateJobViews();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/jobs/${id}`),
    onSuccess: invalidate,
  });
}
