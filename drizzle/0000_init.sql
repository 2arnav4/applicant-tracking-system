CREATE TYPE "public"."activity_type" AS ENUM('created', 'stage_changed', 'note_added', 'updated');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'internship');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('open', 'on_hold', 'closed');--> statement-breakpoint
CREATE TYPE "public"."candidate_source" AS ENUM('linkedin', 'referral', 'careers_page', 'job_board', 'agency', 'other');--> statement-breakpoint
CREATE TYPE "public"."candidate_stage" AS ENUM('applied', 'screening', 'interview', 'offer', 'hired', 'rejected');--> statement-breakpoint
CREATE TABLE "candidate_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"type" "activity_type" NOT NULL,
	"from_stage" "candidate_stage",
	"to_stage" "candidate_stage",
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"location" text,
	"current_title" text,
	"experience_years" integer,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" "candidate_source" DEFAULT 'other' NOT NULL,
	"stage" "candidate_stage" DEFAULT 'applied' NOT NULL,
	"rating" integer,
	"linkedin_url" text,
	"resume_url" text,
	"job_id" uuid,
	"stage_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidates_rating_range" CHECK ("candidates"."rating" IS NULL OR "candidates"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "candidates_experience_range" CHECK ("candidates"."experience_years" IS NULL OR "candidates"."experience_years" BETWEEN 0 AND 60)
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"department" text NOT NULL,
	"location" text NOT NULL,
	"employment_type" "employment_type" DEFAULT 'full_time' NOT NULL,
	"status" "job_status" DEFAULT 'open' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidate_activities" ADD CONSTRAINT "candidate_activities_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_candidate_created_idx" ON "candidate_activities" USING btree ("candidate_id","created_at");--> statement-breakpoint
CREATE INDEX "activities_created_at_idx" ON "candidate_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activities_to_stage_idx" ON "candidate_activities" USING btree ("to_stage");--> statement-breakpoint
CREATE UNIQUE INDEX "candidates_email_unique" ON "candidates" USING btree ("email");--> statement-breakpoint
CREATE INDEX "candidates_stage_idx" ON "candidates" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "candidates_job_stage_idx" ON "candidates" USING btree ("job_id","stage");--> statement-breakpoint
CREATE INDEX "candidates_created_at_idx" ON "candidates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");