"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { invalidateCandidateViews } from "@/features/candidates/api";
import { queryKeys } from "@/features/query-keys";
import type { Stage } from "@/shared/domain";
import type { CandidateDetail, Pipeline } from "@/shared/types";
import type { PipelineQuery } from "@/shared/validation";
import { moveCard } from "./move-card";

export function usePipeline(query: Partial<PipelineQuery>) {
  return useQuery({
    queryKey: queryKeys.pipeline.board(query),
    queryFn: ({ signal }) => api.get<Pipeline>("/pipeline", query, signal),
  });
}

type MoveVariables = { candidateId: string; from: Stage; to: Stage };

/**
 * Optimistic drag-and-drop move: the card jumps columns immediately, the
 * server validates the transition, and on failure the board snaps back.
 */
export function useMoveCandidate(query: Partial<PipelineQuery>) {
  const queryClient = useQueryClient();
  const key = queryKeys.pipeline.board(query);

  return useMutation({
    mutationFn: ({ candidateId, from, to }: MoveVariables) =>
      api.patch<CandidateDetail>(`/candidates/${candidateId}/stage`, { stage: to, fromStage: from }),
    onMutate: async ({ candidateId, from, to }) => {
      // Stop in-flight refetches from overwriting the optimistic state.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Pipeline>(key);
      if (previous) {
        queryClient.setQueryData<Pipeline>(key, moveCard(previous, candidateId, from, to, new Date().toISOString()));
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (candidate) => {
      queryClient.setQueryData(queryKeys.candidates.detail(candidate.id), candidate);
    },
    onSettled: () => invalidateCandidateViews(queryClient),
  });
}
