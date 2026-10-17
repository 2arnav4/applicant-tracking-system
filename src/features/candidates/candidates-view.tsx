"use client";

import { ChevronLeft, ChevronRight, Plus, Search, Star, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { StageBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { useJobs } from "@/features/jobs/api";
import { errorMessage } from "@/lib/api-client";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn, formatYears, timeAgo } from "@/lib/utils";
import { SOURCES, SOURCE_LABELS, STAGES, STAGE_LABELS, type Source, type Stage } from "@/shared/domain";
import type { CandidateSort } from "@/shared/validation";
import { DEFAULT_CANDIDATE_FILTERS, useUiStore, type CandidateFilters } from "@/stores/ui-store";
import { useCandidates } from "./api";

const SORT_LABELS: Record<CandidateSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  name: "Name A–Z",
  experience: "Most experience",
  rating: "Highest rated",
  updated: "Recently updated",
};

/** Drops empty filter values so they're omitted from the query string and cache key. */
function toQuery(filters: CandidateFilters) {
  return {
    q: filters.q || undefined,
    stage: filters.stage || undefined,
    jobId: filters.jobId || undefined,
    source: filters.source || undefined,
    sort: filters.sort,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export function CandidatesView() {
  const filters = useUiStore((s) => s.candidateFilters);
  const setFilters = useUiStore((s) => s.setCandidateFilters);
  const setPage = useUiStore((s) => s.setCandidatePage);
  const resetFilters = useUiStore((s) => s.resetCandidateFilters);
  const openCandidate = useUiStore((s) => s.openCandidate);
  const openForm = useUiStore((s) => s.setCandidateFormOpen);
  const jobs = useJobs();

  // Search input is local for instant typing; the store (and the request) updates after a pause.
  const [search, setSearch] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(search, 300);
  useEffect(() => {
    if (debouncedSearch !== useUiStore.getState().candidateFilters.q) setFilters({ q: debouncedSearch });
  }, [debouncedSearch, setFilters]);

  const candidates = useCandidates(toQuery(filters));
  const meta = candidates.data?.meta;

  // Deleting the last row on the last page would strand the user on an empty page.
  useEffect(() => {
    if (meta && meta.page > meta.totalPages) setPage(meta.totalPages);
  }, [meta, setPage]);
  const hasFilters =
    filters.q !== "" || filters.stage !== "" || filters.jobId !== "" || filters.source !== "" ||
    filters.sort !== DEFAULT_CANDIDATE_FILTERS.sort;

  return (
    <>
      <PageHeader
        title="Candidates"
        description={meta ? `${meta.total} candidate${meta.total === 1 ? "" : "s"}` : "Search and filter applicants"}
        actions={
          <Button onClick={() => openForm(true)}>
            <Plus className="size-4" /> Add candidate
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search candidates"
            placeholder="Search by name, email, title or skill…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <Select aria-label="Filter by stage" value={filters.stage} onChange={(e) => setFilters({ stage: e.target.value as Stage | "" })} className="lg:w-36">
            <option value="">All stages</option>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
            ))}
          </Select>
          <Select aria-label="Filter by job" value={filters.jobId} onChange={(e) => setFilters({ jobId: e.target.value })} className="lg:w-48">
            <option value="">All jobs</option>
            {jobs.data?.map((job) => (
              <option key={job.id} value={job.id}>{job.title}</option>
            ))}
          </Select>
          <Select aria-label="Filter by source" value={filters.source} onChange={(e) => setFilters({ source: e.target.value as Source | "" })} className="lg:w-36">
            <option value="">All sources</option>
            {SOURCES.map((source) => (
              <option key={source} value={source}>{SOURCE_LABELS[source]}</option>
            ))}
          </Select>
          <Select aria-label="Sort by" value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value as CandidateSort })} className="lg:w-40">
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              resetFilters();
            }}
          >
            <X className="size-3.5" /> Clear
          </Button>
        )}
      </div>

      {candidates.isError && (
        <ErrorState message={errorMessage(candidates.error)} onRetry={() => candidates.refetch()} />
      )}

      <Card className={cn("overflow-hidden", candidates.isFetching && candidates.isPlaceholderData && "opacity-70")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border bg-surface-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Candidate</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Stage</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Job</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Experience</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Source</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Rating</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {candidates.isPending &&
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {candidates.data?.data.map((candidate) => (
                <tr
                  key={candidate.id}
                  onClick={() => openCandidate(candidate.id)}
                  className="cursor-pointer transition-colors hover:bg-surface-muted/60"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={candidate.name} />
                      <div className="min-w-0">
                        {/* A real button keeps rows keyboard-accessible; the row click is a mouse convenience. */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCandidate(candidate.id);
                          }}
                          className="block max-w-[16rem] truncate text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                          {candidate.name}
                        </button>
                        <p className="max-w-[16rem] truncate text-xs text-muted-foreground">
                          {candidate.currentTitle ?? candidate.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><StageBadge stage={candidate.stage} /></td>
                  <td className="max-w-[14rem] truncate px-4 py-2.5 text-muted-foreground">{candidate.job?.title ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {formatYears(candidate.experienceYears)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{SOURCE_LABELS[candidate.source]}</td>
                  <td className="px-4 py-2.5">
                    {candidate.rating ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Star className="size-3.5 fill-warning text-warning" /> {candidate.rating}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{timeAgo(candidate.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {candidates.data && candidates.data.data.length === 0 && (
          <EmptyState
            icon={Users}
            title={hasFilters ? "No candidates match these filters" : "No candidates yet"}
            description={hasFilters ? "Try a different search or clear the filters." : "Add your first candidate to start tracking them."}
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={() => { setSearch(""); resetFilters(); }}>Clear filters</Button>
              ) : (
                <Button onClick={() => openForm(true)}><Plus className="size-4" /> Add candidate</Button>
              )
            }
          />
        )}

        {meta && meta.total > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total}
            </span>
            <div className="flex items-center gap-2">
              <span>Page {meta.page} of {meta.totalPages}</span>
              <Button variant="secondary" size="icon" aria-label="Previous page" disabled={meta.page <= 1} onClick={() => setPage(meta.page - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="secondary" size="icon" aria-label="Next page" disabled={meta.page >= meta.totalPages} onClick={() => setPage(meta.page + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
