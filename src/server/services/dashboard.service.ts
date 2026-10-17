import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Database } from "@/server/db/types";
import { candidateActivities, candidates, jobs } from "@/server/db/schema";
import { FUNNEL_STAGES, SOURCES, STAGES, type Stage } from "@/shared/domain";

export const APPLICATION_WINDOW_DAYS = 30;
const RECENT_ACTIVITY_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC calendar days from (today - days + 1) through today, as YYYY-MM-DD. */
export function lastNDays(days: number, now = new Date()): string[] {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, i) =>
    new Date(todayUtc - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10),
  );
}

/** Rounded percentage of `current` relative to `previous`; null when there is no base. */
export function conversionRate(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round((current / previous) * 1000) / 10;
}

export function createDashboardService(db: Database) {
  async function totals() {
    const [row] = await db
      .select({
        candidates: count(),
        active: sql<number>`count(*) filter (where ${candidates.stage} not in ('hired', 'rejected'))`.mapWith(Number),
        hired: sql<number>`count(*) filter (where ${candidates.stage} = 'hired')`.mapWith(Number),
        rejected: sql<number>`count(*) filter (where ${candidates.stage} = 'rejected')`.mapWith(Number),
        newLast30Days: sql<number>`count(*) filter (where ${candidates.createdAt} >= now() - interval '30 days')`.mapWith(Number),
      })
      .from(candidates);
    const [{ openJobs }] = await db.select({ openJobs: count() }).from(jobs).where(eq(jobs.status, "open"));
    return { ...row, openJobs };
  }

  async function byStage() {
    const rows = await db
      .select({ stage: candidates.stage, count: count() })
      .from(candidates)
      .groupBy(candidates.stage);
    const counts = new Map(rows.map((r) => [r.stage, r.count]));
    return STAGES.map((stage) => ({ stage, count: counts.get(stage) ?? 0 }));
  }

  /**
   * "Reached stage S" = the candidate was ever moved into S or any later funnel
   * stage. Based on the activity log, so rejected candidates still count for
   * the furthest stage they got to, and the funnel is monotonic.
   */
  async function funnel() {
    const fields = Object.fromEntries(
      FUNNEL_STAGES.map((stage, index) => {
        const reachedOrLater = FUNNEL_STAGES.slice(index) as Stage[];
        return [
          stage,
          sql<number>`count(distinct ${candidateActivities.candidateId}) filter (where ${inArray(candidateActivities.toStage, reachedOrLater)})`.mapWith(Number),
        ];
      }),
    );
    const [row] = await db.select(fields).from(candidateActivities);
    return FUNNEL_STAGES.map((stage, index) => ({
      stage,
      reached: row[stage],
      conversionFromPrevious: index === 0 ? null : conversionRate(row[stage], row[FUNNEL_STAGES[index - 1]]),
    }));
  }

  async function avgDaysToHire() {
    const [row] = await db
      .select({
        days: sql<number | null>`avg(extract(epoch from (${candidateActivities.createdAt} - ${candidates.createdAt}))) / 86400`.mapWith(
          (value) => (value === null ? null : Number(value)),
        ),
      })
      .from(candidateActivities)
      .innerJoin(candidates, eq(candidates.id, candidateActivities.candidateId))
      .where(and(eq(candidateActivities.type, "stage_changed"), eq(candidateActivities.toStage, "hired")));
    return row.days === null ? null : Math.round(row.days * 10) / 10;
  }

  async function applicationsByDay(now = new Date()) {
    const days = lastNDays(APPLICATION_WINDOW_DAYS, now);
    const day = sql<string>`to_char(${candidates.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
    const rows = await db
      .select({ date: day, count: count() })
      .from(candidates)
      .where(gte(candidates.createdAt, new Date(`${days[0]}T00:00:00.000Z`)))
      .groupBy(day);
    const counts = new Map(rows.map((r) => [r.date, r.count]));
    // Zero-fill so the chart shows quiet days instead of skipping them.
    return days.map((date) => ({ date, count: counts.get(date) ?? 0 }));
  }

  async function bySource() {
    const rows = await db
      .select({
        source: candidates.source,
        count: count(),
        hired: sql<number>`count(*) filter (where ${candidates.stage} = 'hired')`.mapWith(Number),
      })
      .from(candidates)
      .groupBy(candidates.source);
    const bySourceMap = new Map(rows.map((r) => [r.source, r]));
    return SOURCES.map((source) => ({
      source,
      count: bySourceMap.get(source)?.count ?? 0,
      hired: bySourceMap.get(source)?.hired ?? 0,
    })).sort((a, b) => b.count - a.count);
  }

  async function recentActivity() {
    const rows = await db
      .select({ activity: candidateActivities, candidateName: candidates.name })
      .from(candidateActivities)
      .innerJoin(candidates, eq(candidates.id, candidateActivities.candidateId))
      .orderBy(desc(candidateActivities.createdAt))
      .limit(RECENT_ACTIVITY_LIMIT);
    return rows.map((r) => ({ ...r.activity, candidateName: r.candidateName }));
  }

  async function getMetrics() {
    const [t, stages, f, avg, applications, sources, recent] = await Promise.all([
      totals(),
      byStage(),
      funnel(),
      avgDaysToHire(),
      applicationsByDay(),
      bySource(),
      recentActivity(),
    ]);
    return {
      totals: t,
      byStage: stages,
      funnel: f,
      avgDaysToHire: avg,
      applicationsByDay: applications,
      bySource: sources,
      recentActivity: recent,
    };
  }

  return { getMetrics, applicationsByDay };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
