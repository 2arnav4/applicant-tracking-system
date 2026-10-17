"use client";

import { format } from "date-fns";
import {
  ArrowRight,
  Briefcase,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StageBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Select, Textarea } from "@/components/ui/input";
import { errorMessage } from "@/lib/api-client";
import { formatYears, timeAgo } from "@/lib/utils";
import { SOURCE_LABELS, STAGES, STAGE_LABELS, canTransition, type Stage } from "@/shared/domain";
import type { Activity, CandidateDetail } from "@/shared/types";
import { useUiStore } from "@/stores/ui-store";
import { useAddNote, useCandidate, useChangeStage, useDeleteCandidate, useUpdateCandidate } from "./api";
import { CandidateForm } from "./candidate-form";

export function CandidateDrawer() {
  const selectedId = useUiStore((s) => s.selectedCandidateId);
  const close = useUiStore((s) => s.closeCandidate);
  const [editing, setEditing] = useState(false);
  const candidate = useCandidate(selectedId);

  const onOpenChange = (open: boolean) => {
    if (!open) {
      setEditing(false);
      close();
    }
  };

  return (
    <Dialog
      open={Boolean(selectedId)}
      onOpenChange={onOpenChange}
      variant="sheet"
      title={editing ? "Edit candidate" : (candidate.data?.name ?? "Candidate")}
      description={editing ? undefined : (candidate.data?.currentTitle ?? undefined)}
    >
      {candidate.isPending && <DrawerSkeleton />}
      {candidate.isError && (
        <div className="p-5">
          <ErrorState message={errorMessage(candidate.error)} onRetry={() => candidate.refetch()} />
        </div>
      )}
      {candidate.data &&
        (editing ? (
          <EditCandidate candidate={candidate.data} onDone={() => setEditing(false)} />
        ) : (
          <CandidateDetails
            // Remount per candidate so local inputs (note draft, stage pick) never leak between people.
            key={candidate.data.id}
            candidate={candidate.data}
            onEdit={() => setEditing(true)}
            onDeleted={() => onOpenChange(false)}
          />
        ))}
    </Dialog>
  );
}

function EditCandidate({ candidate, onDone }: { candidate: CandidateDetail; onDone: () => void }) {
  const update = useUpdateCandidate(candidate.id);
  return (
    <CandidateForm
      candidate={candidate}
      submitLabel="Save changes"
      onCancel={onDone}
      onSubmit={async (values) => {
        await update.mutateAsync(values);
        toast.success("Candidate updated");
        onDone();
      }}
    />
  );
}

function CandidateDetails({
  candidate,
  onEdit,
  onDeleted,
}: {
  candidate: CandidateDetail;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const remove = useDeleteCandidate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(candidate.id);
      toast.success(`${candidate.name} deleted`);
      onDeleted();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="flex items-start gap-3">
        <Avatar name={candidate.name} className="size-11 text-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StageBadge stage={candidate.stage} />
            {candidate.rating && (
              <span className="inline-flex items-center gap-0.5 text-xs text-warning" aria-label={`Rating ${candidate.rating} of 5`}>
                {Array.from({ length: candidate.rating }, (_, i) => (
                  <Star key={i} className="size-3 fill-current" />
                ))}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            In stage since {timeAgo(candidate.stageUpdatedAt)} · Applied {format(new Date(candidate.createdAt), "d MMM yyyy")}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" /> Edit
          </Button>
        </div>
      </div>

      <StageMover candidate={candidate} />

      <section aria-labelledby="contact-heading" className="grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-2">
        <h3 id="contact-heading" className="sr-only">
          Contact details
        </h3>
        <InfoRow icon={Mail}>
          <a href={`mailto:${candidate.email}`} className="truncate hover:underline">
            {candidate.email}
          </a>
        </InfoRow>
        <InfoRow icon={Phone}>{candidate.phone ?? "—"}</InfoRow>
        <InfoRow icon={MapPin}>{candidate.location ?? "—"}</InfoRow>
        <InfoRow icon={Briefcase}>{candidate.job?.title ?? "No specific role"}</InfoRow>
        <InfoRow icon={ArrowRight}>
          {SOURCE_LABELS[candidate.source]}
          {candidate.experienceYears !== null && ` · ${formatYears(candidate.experienceYears)} exp`}
        </InfoRow>
        <InfoRow icon={ExternalLink}>
          <span className="flex gap-3">
            {candidate.linkedinUrl ? (
              <a href={candidate.linkedinUrl} target="_blank" rel="noreferrer noopener" className="hover:underline">
                LinkedIn
              </a>
            ) : null}
            {candidate.resumeUrl ? (
              <a href={candidate.resumeUrl} target="_blank" rel="noreferrer noopener" className="hover:underline">
                Resume
              </a>
            ) : null}
            {!candidate.linkedinUrl && !candidate.resumeUrl && "No links"}
          </span>
        </InfoRow>
      </section>

      {candidate.skills.length > 0 && (
        <section aria-labelledby="skills-heading">
          <h3 id="skills-heading" className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Skills
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {candidate.skills.map((skill) => (
              <Badge key={skill}>{skill}</Badge>
            ))}
          </div>
        </section>
      )}

      <NoteComposer candidateId={candidate.id} />
      <Timeline activities={candidate.activities} />

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        {confirmDelete ? (
          <>
            <span className="mr-auto text-sm text-muted-foreground">Delete permanently?</span>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" loading={remove.isPending} onClick={handleDelete}>
              Delete
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-3.5" /> Delete candidate
          </Button>
        )}
      </div>
    </div>
  );
}

function StageMover({ candidate }: { candidate: CandidateDetail }) {
  const changeStage = useChangeStage(candidate.id);
  const [target, setTarget] = useState<Stage | "">("");
  const [note, setNote] = useState("");

  const submit = async () => {
    if (!target) return;
    try {
      await changeStage.mutateAsync({ stage: target, fromStage: candidate.stage, note: note || null });
      toast.success(`Moved to ${STAGE_LABELS[target]}`);
      setTarget("");
      setNote("");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <section aria-labelledby="stage-heading" className="rounded-lg border border-border bg-surface-muted/50 p-3">
      <h3 id="stage-heading" className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Move stage
      </h3>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          aria-label="Target stage"
          value={target}
          onChange={(e) => setTarget(e.target.value as Stage | "")}
          className="sm:w-44"
        >
          <option value="">Select stage…</option>
          {STAGES.map((stage) => {
            const check = canTransition(candidate.stage, stage);
            return (
              <option key={stage} value={stage} disabled={!check.ok}>
                {STAGE_LABELS[stage]}
                {!check.ok && stage !== candidate.stage ? " (not allowed)" : ""}
              </option>
            );
          })}
        </Select>
        <input
          aria-label="Optional note for this stage change"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note"
          maxLength={2000}
          className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring"
        />
        <Button onClick={submit} disabled={!target} loading={changeStage.isPending}>
          Move
        </Button>
      </div>
    </section>
  );
}

function NoteComposer({ candidateId }: { candidateId: string }) {
  const addNote = useAddNote(candidateId);
  const [body, setBody] = useState("");

  const submit = async () => {
    if (!body.trim()) return;
    try {
      await addNote.mutateAsync(body.trim());
      setBody("");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <section aria-labelledby="notes-heading">
      <h3 id="notes-heading" className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Add note
      </h3>
      <Textarea
        aria-label="Note"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
        }}
        placeholder="Interview feedback, next steps… (⌘/Ctrl + Enter to save)"
        maxLength={2000}
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={submit} disabled={!body.trim()} loading={addNote.isPending}>
          <Plus className="size-3.5" /> Add note
        </Button>
      </div>
    </section>
  );
}

const ACTIVITY_ICON = { created: Plus, stage_changed: ArrowRight, note_added: MessageSquare, updated: FileText } as const;

export function describeActivity(activity: Pick<Activity, "type" | "fromStage" | "toStage">): string {
  switch (activity.type) {
    case "created":
      return "Candidate added";
    case "stage_changed":
      return `Moved ${activity.fromStage ? `from ${STAGE_LABELS[activity.fromStage]} ` : ""}to ${
        activity.toStage ? STAGE_LABELS[activity.toStage] : "—"
      }`;
    case "note_added":
      return "Note added";
    case "updated":
      return "Profile updated";
  }
}

function Timeline({ activities }: { activities: Activity[] }) {
  return (
    <section aria-labelledby="timeline-heading">
      <h3 id="timeline-heading" className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Activity
      </h3>
      <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
        {activities.map((activity) => {
          const Icon = ACTIVITY_ICON[activity.type];
          return (
            <li key={activity.id} className="relative">
              <span className="absolute top-0.5 -left-[1.86rem] flex size-5 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground">
                <Icon className="size-3" />
              </span>
              <p className="text-sm">{describeActivity(activity)}</p>
              {activity.note && activity.type !== "updated" && (
                <p className="mt-1 rounded-md bg-surface-muted px-3 py-2 text-sm whitespace-pre-wrap">{activity.note}</p>
              )}
              <time dateTime={activity.createdAt} className="text-xs text-muted-foreground" title={format(new Date(activity.createdAt), "PPpp")}>
                {timeAgo(activity.createdAt)}
              </time>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function InfoRow({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-foreground">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex gap-3">
        <Skeleton className="size-11 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
