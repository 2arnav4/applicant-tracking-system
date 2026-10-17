"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/features/query-keys";
import type { DashboardMetrics } from "@/shared/types";

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: ({ signal }) => api.get<DashboardMetrics>("/dashboard", undefined, signal),
  });
}
