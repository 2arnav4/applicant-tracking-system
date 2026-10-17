/**
 * Domain constants and rules shared by the API and the UI.
 * Keeping them in one module means the kanban board and the server
 * enforce the exact same stage-transition policy.
 */

export const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;
export type Stage = (typeof STAGES)[number];

export function isStage(value: string): value is Stage {
  return (STAGES as readonly string[]).includes(value);
}

/** Stages that form the forward hiring funnel (rejected sits outside it). */
export const FUNNEL_STAGES = ["applied", "screening", "interview", "offer", "hired"] as const satisfies readonly Stage[];

export const TERMINAL_STAGES: readonly Stage[] = ["hired"];

export const STAGE_LABELS: Record<Stage, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

export const SOURCES = ["linkedin", "referral", "careers_page", "job_board", "agency", "other"] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<Source, string> = {
  linkedin: "LinkedIn",
  referral: "Referral",
  careers_page: "Careers page",
  job_board: "Job board",
  agency: "Agency",
  other: "Other",
};

export const JOB_STATUSES = ["open", "on_hold", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  open: "Open",
  on_hold: "On hold",
  closed: "Closed",
};

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};

export const ACTIVITY_TYPES = ["created", "stage_changed", "note_added", "updated"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

/**
 * Stage transition policy:
 * - moving to the same stage is a no-op and rejected
 * - "hired" is terminal (reversing a hire is an HR process, not a drag-and-drop)
 * - a candidate can only be hired from "offer"
 * - anything else is allowed, including reopening a rejected candidate
 */
export function canTransition(from: Stage, to: Stage): TransitionCheck {
  if (from === to) return { ok: false, reason: `Candidate is already in ${STAGE_LABELS[to]}` };
  if (TERMINAL_STAGES.includes(from)) {
    return { ok: false, reason: `${STAGE_LABELS[from]} is a final stage and cannot be changed` };
  }
  if (to === "hired" && from !== "offer") {
    return { ok: false, reason: "Only candidates in Offer can be moved to Hired" };
  }
  return { ok: true };
}

/** Trims, drops empties and de-duplicates case-insensitively, keeping the first spelling. */
export function normalizeSkills(skills: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of skills) {
    const skill = raw.trim().replace(/\s+/g, " ");
    const key = skill.toLowerCase();
    if (!skill || seen.has(key)) continue;
    seen.add(key);
    result.push(skill);
  }
  return result;
}
