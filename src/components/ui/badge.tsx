import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { STAGE_LABELS, type Stage } from "@/shared/domain";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export const STAGE_STYLES: Record<Stage, { badge: string; dot: string }> = {
  applied: { badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20", dot: "bg-slate-500" },
  screening: { badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20", dot: "bg-sky-500" },
  interview: { badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20", dot: "bg-violet-500" },
  offer: { badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20", dot: "bg-amber-500" },
  hired: { badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20", dot: "bg-emerald-500" },
  rejected: { badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20", dot: "bg-rose-500" },
};

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <Badge className={cn(STAGE_STYLES[stage].badge, className)}>
      <span className={cn("size-1.5 rounded-full", STAGE_STYLES[stage].dot)} aria-hidden />
      {STAGE_LABELS[stage]}
    </Badge>
  );
}
