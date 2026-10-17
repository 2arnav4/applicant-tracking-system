"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanSquare, Search, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { STAGE_STYLES } from "@/components/ui/badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { useJobs } from "@/features/jobs/api";
import { errorMessage } from "@/lib/api-client";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn, timeAgo } from "@/lib/utils";
import { STAGES, STAGE_LABELS, canTransition, isStage, type Stage } from "@/shared/domain";
import type { PipelineCard, PipelineColumn } from "@/shared/types";
import { useUiStore } from "@/stores/ui-store";
import { useMoveCandidate, usePipeline } from "./api";

export function PipelineBoard() {
  const filters = useUiStore((s) => s.pipelineFilters);
  const setFilters = useUiStore((s) => s.setPipelineFilters);
  const openCandidate = useUiStore((s) => s.openCandidate);
  const jobs = useJobs();

  const [search, setSearch] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(search, 300);
  useEffect(() => {
    if (debouncedSearch !== useUiStore.getState().pipelineFilters.q) setFilters({ q: debouncedSearch });
  }, [debouncedSearch, setFilters]);

  const query = { q: filters.q || undefined, jobId: filters.jobId || undefined };
  const pipeline = usePipeline(query);
  const move = useMoveCandidate(query);
  const [activeCard, setActiveCard] = useState<PipelineCard | null>(null);

  const sensors = useSensors(
    // A small drag threshold lets a plain click still open the candidate.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Space picks up / drops; Enter is reserved for opening the card.
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  const onDragStart = (event: DragStartEvent) => {
    setActiveCard((event.active.data.current?.card as PipelineCard | undefined) ?? null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);
    const card = event.active.data.current?.card as PipelineCard | undefined;
    const to = event.over?.id;
    if (!card || typeof to !== "string" || !isStage(to) || to === card.stage) return;

    // Check locally first for instant feedback; the server re-validates regardless.
    const check = canTransition(card.stage, to);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    move.mutate(
      { candidateId: card.id, from: card.stage, to },
      {
        onSuccess: () => toast.success(`${card.name} moved to ${STAGE_LABELS[to]}`),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <>
      <PageHeader title="Pipeline" description="Drag candidates between stages. Click a card for details." />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search pipeline"
            placeholder="Search name, email, skill…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          aria-label="Filter by job"
          value={filters.jobId}
          onChange={(e) => setFilters({ jobId: e.target.value })}
          className="sm:w-60"
        >
          <option value="">All jobs</option>
          {jobs.data?.map((job) => (
            <option key={job.id} value={job.id}>{job.title}</option>
          ))}
        </Select>
      </div>

      {pipeline.isError && <ErrorState message={errorMessage(pipeline.error)} onRetry={() => pipeline.refetch()} />}

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveCard(null)}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Picked up ${(active.data.current?.card as PipelineCard)?.name}`,
            onDragOver: ({ over }) => (over ? `Over ${STAGE_LABELS[over.id as Stage]}` : "Not over a stage"),
            onDragEnd: ({ over }) => (over ? `Dropped in ${STAGE_LABELS[over.id as Stage]}` : "Dropped"),
            onDragCancel: () => "Move cancelled",
          },
        }}
      >
        <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
          <div className="flex min-w-max gap-3">
            {pipeline.isPending
              ? STAGES.map((stage) => <ColumnSkeleton key={stage} stage={stage} />)
              : pipeline.data?.columns.map((column) => (
                  <StageColumn
                    key={column.stage}
                    column={column}
                    limit={pipeline.data.limitPerStage}
                    activeCard={activeCard}
                    onOpen={openCandidate}
                  />
                ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeCard ? <CardBody card={activeCard} className="rotate-2 shadow-xl ring-2 ring-primary/40" /> : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

function StageColumn({
  column,
  limit,
  activeCard,
  onOpen,
}: {
  column: PipelineColumn;
  limit: number;
  activeCard: PipelineCard | null;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage });
  const dropState = activeCard
    ? activeCard.stage === column.stage
      ? "source"
      : canTransition(activeCard.stage, column.stage).ok
        ? "allowed"
        : "blocked"
    : "idle";

  return (
    <section
      ref={setNodeRef}
      aria-label={`${STAGE_LABELS[column.stage]} (${column.total})`}
      className={cn(
        "flex w-72 flex-col rounded-xl border border-border bg-surface-muted/50 transition-colors",
        dropState === "allowed" && "border-dashed border-primary/50",
        dropState === "allowed" && isOver && "border-primary bg-primary/5",
        dropState === "blocked" && "opacity-50",
      )}
    >
      <header className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", STAGE_STYLES[column.stage].dot)} aria-hidden />
          <h2 className="text-sm font-semibold">{STAGE_LABELS[column.stage]}</h2>
        </div>
        <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted-foreground tabular-nums">{column.total}</span>
      </header>
      <div className="flex max-h-[calc(100dvh-16rem)] min-h-32 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {column.candidates.map((card) => (
          <DraggableCard key={card.id} card={card} onOpen={onOpen} />
        ))}
        {column.candidates.length === 0 && (
          <EmptyState icon={KanbanSquare} title="No candidates" className="py-6" />
        )}
        {column.total > column.candidates.length && (
          <p className="px-2 py-1 text-center text-xs text-muted-foreground">
            Showing latest {limit} of {column.total}. Use Candidates to see all.
          </p>
        )}
      </div>
    </section>
  );
}

function DraggableCard({ card, onOpen }: { card: PipelineCard; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, data: { card } });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable candidate card"
      aria-label={`${card.name}, ${STAGE_LABELS[card.stage]}. Press space to move, Enter to open.`}
      onClick={() => onOpen(card.id)}
      onKeyDown={(event) => {
        listeners?.onKeyDown?.(event);
        if (event.key === "Enter" && !isDragging) onOpen(card.id);
      }}
      className={cn("rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring", isDragging && "opacity-30")}
    >
      <CardBody card={card} />
    </div>
  );
}

function CardBody({ card, className }: { card: PipelineCard; className?: string }) {
  return (
    <article className={cn("cursor-grab rounded-lg border border-border bg-surface p-3 shadow-xs hover:border-primary/40 active:cursor-grabbing", className)}>
      <div className="flex items-start gap-2.5">
        <Avatar name={card.name} className="size-7 text-[10px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{card.name}</p>
          <p className="truncate text-xs text-muted-foreground">{card.currentTitle ?? card.email}</p>
        </div>
        {card.rating && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground" aria-label={`Rating ${card.rating}`}>
            <Star className="size-3 fill-warning text-warning" />
            {card.rating}
          </span>
        )}
      </div>
      {card.job && <p className="mt-2 truncate text-xs text-muted-foreground">{card.job.title}</p>}
      {card.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.skills.slice(0, 3).map((skill) => (
            <span key={skill} className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {skill}
            </span>
          ))}
          {card.skills.length > 3 && <span className="px-1 text-[11px] text-muted-foreground">+{card.skills.length - 3}</span>}
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">In stage {timeAgo(card.stageUpdatedAt)}</p>
    </article>
  );
}

function ColumnSkeleton({ stage }: { stage: Stage }) {
  return (
    <div className="flex w-72 flex-col gap-2 rounded-xl border border-border bg-surface-muted/50 p-3">
      <p className="text-sm font-semibold">{STAGE_LABELS[stage]}</p>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}
