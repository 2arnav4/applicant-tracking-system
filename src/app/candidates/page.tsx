import type { Metadata } from "next";
import { CandidatesView } from "@/features/candidates/candidates-view";

export const metadata: Metadata = { title: "Candidates" };

export default function CandidatesPage() {
  return <CandidatesView />;
}
