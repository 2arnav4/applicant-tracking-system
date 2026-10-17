"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BriefcaseBusiness, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  type JobStatus,
} from "@/shared/domain";
import type { JobWithStats } from "@/shared/types";
import { jobCreateSchema, type JobCreate } from "@/shared/validation";
import { useUiStore } from "@/stores/ui-store";
import { useCreateJob, useDeleteJob, useJobs, useUpdateJob } from "./api";

const STATUS_STYLES: Record<JobStatus, string> = {
  open: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  on_hold: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  closed: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20",
};

export function JobsView() {
  const jobs = useJobs();
  const [editing, setEditing] = useState<JobWithStats | "new" | null>(null);

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Open roles candidates can be attached to."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" /> New job
          </Button>
        }
      />
      {jobs.isError && <ErrorState message={errorMessage(jobs.error)} onRetry={() => jobs.refetch()} />}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {jobs.isPending && Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-40" />)}
        {jobs.data?.map((job) => (
          <JobCard key={job.id} job={job} onEdit={() => setEditing(job)} />
        ))}
      </div>
      {jobs.data?.length === 0 && (
        <Card>
          <EmptyState
            icon={BriefcaseBusiness}
            title="No jobs yet"
            description="Create a role to start attaching candidates to it."
            action={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> New job</Button>}
          />
        </Card>
      )}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? "New job" : "Edit job"}
      >
        {editing !== null && (
          <JobForm job={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />
        )}
      </Dialog>
    </>
  );
}

function JobCard({ job, onEdit }: { job: JobWithStats; onEdit: () => void }) {
  const setFilters = useUiStore((s) => s.setPipelineFilters);
  const updateJob = useUpdateJob();

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{job.title}</h2>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            {job.department} · <MapPin className="size-3" /> {job.location}
          </p>
        </div>
        <Badge className={cn(STATUS_STYLES[job.status])}>{JOB_STATUS_LABELS[job.status]}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</p>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          ["Candidates", job.candidateCount],
          ["Active", job.activeCount],
          ["Hired", job.hiredCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-surface-muted/70 py-2">
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd className="text-base font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex items-center gap-2">
        <Select
          aria-label={`Status for ${job.title}`}
          value={job.status}
          disabled={updateJob.isPending}
          onChange={(e) =>
            updateJob.mutate(
              { id: job.id, input: { status: e.target.value as JobStatus } },
              {
                onSuccess: () => toast.success("Job status updated"),
                onError: (error) => toast.error(errorMessage(error)),
              },
            )
          }
          className="h-8 w-32 text-xs"
        >
          {JOB_STATUSES.map((status) => (
            <option key={status} value={status}>{JOB_STATUS_LABELS[status]}</option>
          ))}
        </Select>
        <Link
          href="/pipeline"
          onClick={() => setFilters({ jobId: job.id })}
          className="ml-auto text-xs text-primary hover:underline"
        >
          View pipeline
        </Link>
        <Button variant="ghost" size="icon" aria-label={`Edit ${job.title}`} onClick={onEdit}>
          <Pencil className="size-3.5" />
        </Button>
      </div>
    </Card>
  );
}

type JobFormInput = z.input<typeof jobCreateSchema>;

function JobForm({ job, onDone }: { job?: JobWithStats; onDone: () => void }) {
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JobFormInput, unknown, JobCreate>({
    resolver: zodResolver(jobCreateSchema),
    defaultValues: {
      title: job?.title ?? "",
      department: job?.department ?? "",
      location: job?.location ?? "",
      employmentType: job?.employmentType ?? "full_time",
      status: job?.status ?? "open",
      description: job?.description ?? "",
    },
  });

  const submit = handleSubmit(async (values) => {
    try {
      if (job) await updateJob.mutateAsync({ id: job.id, input: values });
      else await createJob.mutateAsync(values);
      toast.success(job ? "Job updated" : "Job created");
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  const remove = async () => {
    if (!job) return;
    try {
      await deleteJob.mutateAsync(job.id);
      toast.success("Job deleted");
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-5">
      <Field label="Title" htmlFor="job-title" error={errors.title?.message} required>
        <Input id="job-title" aria-invalid={errors.title ? true : undefined} {...register("title")} autoFocus />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Department" htmlFor="job-department" error={errors.department?.message} required>
          <Input id="job-department" aria-invalid={errors.department ? true : undefined} {...register("department")} />
        </Field>
        <Field label="Location" htmlFor="job-location" error={errors.location?.message} required>
          <Input id="job-location" aria-invalid={errors.location ? true : undefined} {...register("location")} />
        </Field>
        <Field label="Employment type" htmlFor="job-employmentType">
          <Select id="job-employmentType" {...register("employmentType")}>
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type} value={type}>{EMPLOYMENT_TYPE_LABELS[type]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="job-status">
          <Select id="job-status" {...register("status")}>
            {JOB_STATUSES.map((status) => (
              <option key={status} value={status}>{JOB_STATUS_LABELS[status]}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Description" htmlFor="job-description" error={errors.description?.message}>
        <Textarea id="job-description" {...register("description")} rows={4} />
      </Field>
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        {job &&
          (confirmDelete ? (
            <span className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
              Candidates stay, unlinked.
              <Button variant="destructive" size="sm" loading={deleteJob.isPending} onClick={remove}>
                Confirm delete
              </Button>
            </span>
          ) : (
            <Button variant="ghost" size="sm" className="mr-auto text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-3.5" /> Delete
            </Button>
          ))}
        <Button variant="secondary" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {job ? "Save" : "Create job"}
        </Button>
      </div>
    </form>
  );
}
