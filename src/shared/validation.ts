import { z } from "zod";
import {
  EMPLOYMENT_TYPES,
  JOB_STATUSES,
  SOURCES,
  STAGES,
  normalizeSkills,
} from "./domain";

/**
 * Request schemas. Used by route handlers to validate input at the boundary
 * and by the client forms, so both sides agree on what "valid" means.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const optionalUrl = z
  .union([z.literal(""), z.url({ protocol: /^https?$/, error: "Must be a valid http(s) URL" })])
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

export const skillsSchema = z.array(z.string().max(50)).max(30).transform(normalizeSkills);

// Field shapes carry no defaults: Zod 4 applies `.default()` even inside
// `.partial()`, which would make a PATCH silently reset omitted fields.
const candidateFields = {
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  // Normalize first, then validate the format of the normalized value.
  email: z.string().trim().toLowerCase().max(254).pipe(z.email({ error: "Enter a valid email" })),
  phone: optionalText(32),
  location: optionalText(120),
  currentTitle: optionalText(120),
  experienceYears: z.coerce.number().int().min(0).max(60).nullable().optional(),
  skills: skillsSchema,
  source: z.enum(SOURCES),
  jobId: z.uuid().nullable().optional(),
  rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  linkedinUrl: optionalUrl,
  resumeUrl: optionalUrl,
};

export const candidateCreateSchema = z.object({
  ...candidateFields,
  skills: candidateFields.skills.default([]),
  source: candidateFields.source.default("other"),
});
export type CandidateCreateInput = z.input<typeof candidateCreateSchema>;
export type CandidateCreate = z.output<typeof candidateCreateSchema>;

export const candidateUpdateSchema = z.object(candidateFields).partial().refine(
  (value) => Object.keys(value).length > 0,
  "Provide at least one field to update",
);
export type CandidateUpdate = z.output<typeof candidateUpdateSchema>;

export const stageChangeSchema = z.object({
  stage: z.enum(STAGES),
  /** Stage the client believed the candidate was in; enables stale-write detection. */
  fromStage: z.enum(STAGES).optional(),
  note: optionalText(2000),
});
export type StageChange = z.output<typeof stageChangeSchema>;

export const noteCreateSchema = z.object({
  body: z.string().trim().min(1, "Note cannot be empty").max(2000),
});

export const CANDIDATE_SORTS = ["newest", "oldest", "name", "experience", "rating", "updated"] as const;
export type CandidateSort = (typeof CANDIDATE_SORTS)[number];

export const candidateListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  stage: z.enum(STAGES).optional(),
  jobId: z.uuid().optional(),
  source: z.enum(SOURCES).optional(),
  sort: z.enum(CANDIDATE_SORTS).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type CandidateListQuery = z.output<typeof candidateListQuerySchema>;

export const pipelineQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  jobId: z.uuid().optional(),
});
export type PipelineQuery = z.output<typeof pipelineQuerySchema>;

const jobFields = {
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(120),
  department: z.string().trim().min(1, "Department is required").max(80),
  location: z.string().trim().min(1, "Location is required").max(120),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  status: z.enum(JOB_STATUSES),
  description: optionalText(5000),
};

export const jobCreateSchema = z.object({
  ...jobFields,
  employmentType: jobFields.employmentType.default("full_time"),
  status: jobFields.status.default("open"),
});
export type JobCreateInput = z.input<typeof jobCreateSchema>;
export type JobCreate = z.output<typeof jobCreateSchema>;

export const jobUpdateSchema = z.object(jobFields).partial().refine(
  (value) => Object.keys(value).length > 0,
  "Provide at least one field to update",
);
export type JobUpdate = z.output<typeof jobUpdateSchema>;

export const idParamSchema = z.uuid({ error: "Invalid id" });
