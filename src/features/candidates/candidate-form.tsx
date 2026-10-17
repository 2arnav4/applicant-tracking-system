"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldPath } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { useJobs } from "@/features/jobs/api";
import { ApiError } from "@/lib/api-client";
import { SOURCES, SOURCE_LABELS } from "@/shared/domain";
import type { CandidateDetail } from "@/shared/types";
import { candidateCreateSchema, skillsSchema, type CandidateCreate } from "@/shared/validation";

/**
 * Form schema = API schema, except skills are typed as one comma-separated
 * string and split before running through the same normalization.
 */
export const candidateFormSchema = candidateCreateSchema.extend({
  skills: z
    .string()
    .max(1500)
    .transform((value) => value.split(","))
    .pipe(skillsSchema),
});
type FormInput = z.input<typeof candidateFormSchema>;

const emptyToNull = (value: unknown) => (value === "" || value === undefined ? null : value);
const toNumberOrNull = (value: unknown) => (value === "" || value === null ? null : Number(value));

function toFormValues(candidate?: CandidateDetail): FormInput {
  return {
    name: candidate?.name ?? "",
    email: candidate?.email ?? "",
    phone: candidate?.phone ?? "",
    location: candidate?.location ?? "",
    currentTitle: candidate?.currentTitle ?? "",
    experienceYears: candidate?.experienceYears ?? null,
    skills: candidate?.skills.join(", ") ?? "",
    source: candidate?.source ?? "linkedin",
    jobId: candidate?.jobId ?? null,
    rating: candidate?.rating ?? null,
    linkedinUrl: candidate?.linkedinUrl ?? "",
    resumeUrl: candidate?.resumeUrl ?? "",
  };
}

type CandidateFormProps = {
  candidate?: CandidateDetail;
  submitLabel: string;
  onSubmit: (values: CandidateCreate) => Promise<unknown>;
  onCancel: () => void;
};

export function CandidateForm({ candidate, submitLabel, onSubmit, onCancel }: CandidateFormProps) {
  const jobs = useJobs();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, CandidateCreate>({
    resolver: zodResolver(candidateFormSchema),
    defaultValues: toFormValues(candidate),
  });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      // Surface server-side validation on the matching inputs, not only as a toast.
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setError("email", { message: error.message });
          return;
        }
        const fieldErrors = Object.entries(error.fieldErrors);
        if (fieldErrors.length > 0) {
          for (const [field, messages] of fieldErrors) {
            setError(field as FieldPath<FormInput>, { message: messages?.[0] });
          }
          return;
        }
      }
      setError("root", { message: error instanceof Error ? error.message : "Could not save candidate" });
    }
  });

  const fieldProps = (name: FieldPath<FormInput>) => ({
    id: `candidate-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `candidate-${name}-error` : undefined,
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="candidate-name" error={errors.name?.message} required>
          <Input {...fieldProps("name")} {...register("name")} autoComplete="off" autoFocus />
        </Field>
        <Field label="Email" htmlFor="candidate-email" error={errors.email?.message} required>
          <Input {...fieldProps("email")} {...register("email")} type="email" autoComplete="off" />
        </Field>
        <Field label="Phone" htmlFor="candidate-phone" error={errors.phone?.message}>
          <Input {...fieldProps("phone")} {...register("phone")} type="tel" />
        </Field>
        <Field label="Location" htmlFor="candidate-location" error={errors.location?.message}>
          <Input {...fieldProps("location")} {...register("location")} />
        </Field>
        <Field label="Current title" htmlFor="candidate-currentTitle" error={errors.currentTitle?.message}>
          <Input {...fieldProps("currentTitle")} {...register("currentTitle")} />
        </Field>
        <Field label="Experience (years)" htmlFor="candidate-experienceYears" error={errors.experienceYears?.message}>
          <Input
            {...fieldProps("experienceYears")}
            {...register("experienceYears", { setValueAs: toNumberOrNull })}
            type="number"
            min={0}
            max={60}
          />
        </Field>
        <Field label="Applying for" htmlFor="candidate-jobId" error={errors.jobId?.message}>
          <Select {...fieldProps("jobId")} {...register("jobId", { setValueAs: emptyToNull })}>
            <option value="">No specific role</option>
            {jobs.data?.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
                {job.status !== "open" ? ` (${job.status.replace("_", " ")})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Source" htmlFor="candidate-source" error={errors.source?.message}>
          <Select {...fieldProps("source")} {...register("source")}>
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {SOURCE_LABELS[source]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Skills"
          htmlFor="candidate-skills"
          error={errors.skills?.message}
          hint="Comma separated, e.g. React, Node.js, PostgreSQL"
          className="sm:col-span-2"
        >
          <Input {...fieldProps("skills")} {...register("skills")} />
        </Field>
        <Field label="Rating" htmlFor="candidate-rating" error={errors.rating?.message}>
          <Select {...fieldProps("rating")} {...register("rating", { setValueAs: toNumberOrNull })}>
            <option value="">Not rated</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)} ({n})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="LinkedIn URL" htmlFor="candidate-linkedinUrl" error={errors.linkedinUrl?.message}>
          <Input {...fieldProps("linkedinUrl")} {...register("linkedinUrl")} type="url" placeholder="https://" />
        </Field>
        <Field
          label="Resume URL"
          htmlFor="candidate-resumeUrl"
          error={errors.resumeUrl?.message}
          className="sm:col-span-2"
        >
          <Input {...fieldProps("resumeUrl")} {...register("resumeUrl")} type="url" placeholder="https://" />
        </Field>
      </div>

      {errors.root?.message && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
