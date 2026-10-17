import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  ACTIVITY_TYPES,
  EMPLOYMENT_TYPES,
  JOB_STATUSES,
  SOURCES,
  STAGES,
} from "@/shared/domain";

export const stageEnum = pgEnum("candidate_stage", STAGES);
export const sourceEnum = pgEnum("candidate_source", SOURCES);
export const jobStatusEnum = pgEnum("job_status", JOB_STATUSES);
export const employmentTypeEnum = pgEnum("employment_type", EMPLOYMENT_TYPES);
export const activityTypeEnum = pgEnum("activity_type", ACTIVITY_TYPES);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    department: text("department").notNull(),
    location: text("location").notNull(),
    employmentType: employmentTypeEnum("employment_type").notNull().default("full_time"),
    status: jobStatusEnum("status").notNull().default("open"),
    description: text("description"),
    ...timestamps,
  },
  (t) => [index("jobs_status_idx").on(t.status)],
);

export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Stored lowercased by the validation layer; unique to block duplicate applicants.
    email: text("email").notNull(),
    phone: text("phone"),
    location: text("location"),
    currentTitle: text("current_title"),
    experienceYears: integer("experience_years"),
    skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
    source: sourceEnum("source").notNull().default("other"),
    stage: stageEnum("stage").notNull().default("applied"),
    rating: integer("rating"),
    linkedinUrl: text("linkedin_url"),
    resumeUrl: text("resume_url"),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    stageUpdatedAt: timestamp("stage_updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("candidates_email_unique").on(t.email),
    index("candidates_stage_idx").on(t.stage),
    index("candidates_job_stage_idx").on(t.jobId, t.stage),
    index("candidates_created_at_idx").on(t.createdAt),
    check("candidates_rating_range", sql`${t.rating} IS NULL OR ${t.rating} BETWEEN 1 AND 5`),
    check(
      "candidates_experience_range",
      sql`${t.experienceYears} IS NULL OR ${t.experienceYears} BETWEEN 0 AND 60`,
    ),
  ],
);

/**
 * Append-only audit log per candidate: creation, stage moves, notes, edits.
 * Drives the candidate timeline and the funnel / time-to-hire metrics.
 */
export const candidateActivities = pgTable(
  "candidate_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    type: activityTypeEnum("type").notNull(),
    fromStage: stageEnum("from_stage"),
    toStage: stageEnum("to_stage"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activities_candidate_created_idx").on(t.candidateId, t.createdAt),
    index("activities_created_at_idx").on(t.createdAt),
    index("activities_to_stage_idx").on(t.toStage),
  ],
);

export const jobsRelations = relations(jobs, ({ many }) => ({
  candidates: many(candidates),
}));

export const candidatesRelations = relations(candidates, ({ one, many }) => ({
  job: one(jobs, { fields: [candidates.jobId], references: [jobs.id] }),
  activities: many(candidateActivities),
}));

export const candidateActivitiesRelations = relations(candidateActivities, ({ one }) => ({
  candidate: one(candidates, {
    fields: [candidateActivities.candidateId],
    references: [candidates.id],
  }),
}));

export type JobRow = typeof jobs.$inferSelect;
export type CandidateRow = typeof candidates.$inferSelect;
export type ActivityRow = typeof candidateActivities.$inferSelect;
