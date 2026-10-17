import type {
  ActivityType,
  EmploymentType,
  JobStatus,
  Source,
  Stage,
} from "./domain";

/** API response shapes as the client receives them (dates are ISO strings over JSON). */

export type JobSummary = { id: string; title: string };

export type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  currentTitle: string | null;
  experienceYears: number | null;
  skills: string[];
  source: Source;
  stage: Stage;
  rating: number | null;
  linkedinUrl: string | null;
  resumeUrl: string | null;
  jobId: string | null;
  stageUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CandidateListItem = Candidate & { job: JobSummary | null };

export type Activity = {
  id: string;
  candidateId: string;
  type: ActivityType;
  fromStage: Stage | null;
  toStage: Stage | null;
  note: string | null;
  createdAt: string;
};

export type CandidateDetail = CandidateListItem & { activities: Activity[] };

export type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };
export type Paginated<T> = { data: T[]; meta: PageMeta };

export type PipelineCard = Pick<
  Candidate,
  "id" | "name" | "email" | "currentTitle" | "rating" | "skills" | "stage" | "stageUpdatedAt" | "experienceYears"
> & { job: JobSummary | null };

export type PipelineColumn = { stage: Stage; total: number; candidates: PipelineCard[] };
export type Pipeline = { columns: PipelineColumn[]; limitPerStage: number };

export type Job = {
  id: string;
  title: string;
  department: string;
  location: string;
  employmentType: EmploymentType;
  status: JobStatus;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobWithStats = Job & { candidateCount: number; activeCount: number; hiredCount: number };

export type DashboardMetrics = {
  totals: {
    candidates: number;
    active: number;
    hired: number;
    rejected: number;
    newLast30Days: number;
    openJobs: number;
  };
  byStage: { stage: Stage; count: number }[];
  funnel: { stage: Stage; reached: number; conversionFromPrevious: number | null }[];
  avgDaysToHire: number | null;
  applicationsByDay: { date: string; count: number }[];
  bySource: { source: Source; count: number; hired: number }[];
  recentActivity: (Activity & { candidateName: string })[];
};
