"use client";

import { format } from "date-fns";
import { Activity as ActivityIcon, BriefcaseBusiness, Clock, UserCheck, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/app-shell";
import { STAGE_STYLES } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { describeActivity } from "@/features/candidates/candidate-drawer";
import { errorMessage } from "@/lib/api-client";
import { cn, timeAgo } from "@/lib/utils";
import { SOURCE_LABELS, STAGE_LABELS } from "@/shared/domain";
import type { DashboardMetrics } from "@/shared/types";
import { useUiStore } from "@/stores/ui-store";
import { useDashboard } from "./api";

export function DashboardView() {
  const dashboard = useDashboard();

  return (
    <>
      <PageHeader title="Dashboard" description="Hiring pipeline health at a glance." />
      {dashboard.isError && <ErrorState message={errorMessage(dashboard.error)} onRetry={() => dashboard.refetch()} />}
      {dashboard.isPending && <DashboardSkeleton />}
      {dashboard.data && <DashboardContent metrics={dashboard.data} />}
    </>
  );
}

function DashboardContent({ metrics }: { metrics: DashboardMetrics }) {
  const { totals } = metrics;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Users} label="Total candidates" value={totals.candidates} />
        <StatTile icon={ActivityIcon} label="Active in pipeline" value={totals.active} />
        <StatTile icon={UserPlus} label="New (30 days)" value={totals.newLast30Days} />
        <StatTile icon={UserCheck} label="Hired" value={totals.hired} />
        <StatTile
          icon={Clock}
          label="Avg. time to hire"
          value={metrics.avgDaysToHire === null ? "—" : `${metrics.avgDaysToHire}d`}
          hint="From application to hire"
        />
        <StatTile icon={BriefcaseBusiness} label="Open jobs" value={totals.openJobs} href="/jobs" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Applications, last 30 days</CardTitle>
            <span className="text-xs text-muted-foreground">
              {metrics.applicationsByDay.reduce((sum, d) => sum + d.count, 0)} total
            </span>
          </CardHeader>
          <CardContent>
            <ApplicationsChart data={metrics.applicationsByDay} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Hiring funnel</CardTitle>
            <span className="text-xs text-muted-foreground">Reached stage · conversion</span>
          </CardHeader>
          <CardContent>
            <Funnel funnel={metrics.funnel} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Current pipeline</CardTitle>
            <Link href="/pipeline" className="text-xs text-primary hover:underline">Open board</Link>
          </CardHeader>
          <CardContent>
            <HorizontalBars
              rows={metrics.byStage.map((s) => ({
                key: s.stage,
                label: STAGE_LABELS[s.stage],
                value: s.count,
                dotClass: STAGE_STYLES[s.stage].dot,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Candidates by source</CardTitle>
            <span className="text-xs text-muted-foreground">count · hired</span>
          </CardHeader>
          <CardContent>
            <HorizontalBars
              rows={metrics.bySource.map((s) => ({
                key: s.source,
                label: SOURCE_LABELS[s.source],
                value: s.count,
                suffix: `${s.hired} hired`,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentActivity items={metrics.recentActivity} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <Card className={cn("h-full p-4", href && "transition-colors hover:border-primary/40")}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function ApplicationsChart({ data }: { data: DashboardMetrics["applicationsByDay"] }) {
  return (
    <div className="h-56" role="img" aria-label="Area chart of daily applications over the last 30 days">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="applicationsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => format(new Date(`${d}T00:00:00Z`), "d MMM")}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--foreground)",
            }}
            labelFormatter={(d) => format(new Date(`${d}T00:00:00Z`), "EEE, d MMM")}
            formatter={(value) => [value, "Applications"]}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#applicationsFill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Funnel({ funnel }: { funnel: DashboardMetrics["funnel"] }) {
  const max = Math.max(1, ...funnel.map((f) => f.reached));
  return (
    <ol className="flex flex-col gap-3">
      {funnel.map((step) => (
        <li key={step.stage} title={`${step.reached} candidates reached ${STAGE_LABELS[step.stage]}`}>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="font-medium">{STAGE_LABELS[step.stage]}</span>
            <span className="text-muted-foreground tabular-nums">
              {step.reached}
              {step.conversionFromPrevious !== null && (
                <span className="ml-2 inline-block w-12 text-right">{step.conversionFromPrevious}%</span>
              )}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-muted">
            <div
              className="h-2 rounded-full bg-primary transition-[width]"
              style={{ width: `${(step.reached / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

type BarRow = { key: string; label: string; value: number; suffix?: string; dotClass?: string };

function HorizontalBars({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li key={row.key} title={`${row.label}: ${row.value}${row.suffix ? ` (${row.suffix})` : ""}`}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              {row.dotClass && <span className={cn("size-1.5 rounded-full", row.dotClass)} aria-hidden />}
              {row.label}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {row.value}
              {row.suffix && <span className="ml-1.5">· {row.suffix}</span>}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-muted">
            <div className="h-1.5 rounded-full bg-primary/70" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function RecentActivity({ items }: { items: DashboardMetrics["recentActivity"] }) {
  const openCandidate = useUiStore((s) => s.openCandidate);
  if (items.length === 0) return <EmptyState icon={ActivityIcon} title="No activity yet" className="py-6" />;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="text-sm">
          <button
            type="button"
            onClick={() => openCandidate(item.candidateId)}
            className="font-medium hover:underline"
          >
            {item.candidateName}
          </button>
          <span className="text-muted-foreground"> · {describeActivity(item)}</span>
          <p className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Skeleton className="h-72 lg:col-span-3" />
        <Skeleton className="h-72 lg:col-span-2" />
      </div>
    </div>
  );
}
