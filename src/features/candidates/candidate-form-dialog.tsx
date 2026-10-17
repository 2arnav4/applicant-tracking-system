"use client";

import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { useUiStore } from "@/stores/ui-store";
import { useCreateCandidate } from "./api";
import { CandidateForm } from "./candidate-form";

export function CandidateFormDialog() {
  const open = useUiStore((s) => s.candidateFormOpen);
  const setOpen = useUiStore((s) => s.setCandidateFormOpen);
  const openCandidate = useUiStore((s) => s.openCandidate);
  const createCandidate = useCreateCandidate();

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Add candidate"
      description="New candidates start in the Applied stage."
      className="max-w-2xl"
    >
      <CandidateForm
        submitLabel="Add candidate"
        onCancel={() => setOpen(false)}
        onSubmit={async (values) => {
          const candidate = await createCandidate.mutateAsync(values);
          toast.success(`${candidate.name} added`);
          setOpen(false);
          openCandidate(candidate.id);
        }}
      />
    </Dialog>
  );
}
