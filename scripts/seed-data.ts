import type { Faker } from "@faker-js/faker";
import { randomUUID } from "node:crypto";
import type { Source, Stage } from "../src/shared/domain";
import type { candidateActivities, candidates, jobs } from "../src/server/db/schema";

type NewJob = typeof jobs.$inferInsert;
type NewCandidate = typeof candidates.$inferInsert;
type NewActivity = typeof candidateActivities.$inferInsert;

const DAY_MS = 24 * 60 * 60 * 1000;

const JOBS: Omit<NewJob, "id">[] = [
  { title: "Full Stack Developer Intern", department: "Engineering", location: "Bengaluru", employmentType: "internship", status: "open" },
  { title: "Senior Backend Engineer", department: "Engineering", location: "Bengaluru", employmentType: "full_time", status: "open" },
  { title: "Frontend Engineer (React)", department: "Engineering", location: "Remote, India", employmentType: "full_time", status: "open" },
  { title: "Product Designer", department: "Design", location: "Bengaluru", employmentType: "full_time", status: "open" },
  { title: "Talent Acquisition Specialist", department: "People", location: "Bengaluru", employmentType: "full_time", status: "on_hold" },
  { title: "Data Analyst", department: "Data", location: "Hyderabad", employmentType: "contract", status: "open" },
  { title: "DevOps Engineer", department: "Engineering", location: "Pune", employmentType: "full_time", status: "closed" },
];

const SKILLS_BY_DEPARTMENT: Record<string, string[]> = {
  Engineering: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Go", "Docker", "AWS", "Python", "Redis", "GraphQL", "Kubernetes", "Tailwind CSS"],
  Design: ["Figma", "Prototyping", "User Research", "Design Systems", "Interaction Design", "Illustrator"],
  People: ["Sourcing", "Interviewing", "Employer Branding", "Workday", "Negotiation"],
  Data: ["SQL", "Python", "Power BI", "Tableau", "Statistics", "dbt", "Excel"],
};

const TITLES_BY_DEPARTMENT: Record<string, string[]> = {
  Engineering: ["Software Engineer", "Frontend Developer", "Backend Developer", "SDE II", "Student", "Platform Engineer"],
  Design: ["UI/UX Designer", "Visual Designer", "Product Designer"],
  People: ["HR Executive", "Recruiter", "Talent Partner"],
  Data: ["Business Analyst", "Data Analyst", "Analytics Engineer"],
};

const CITIES = ["Bengaluru", "Delhi", "Mumbai", "Pune", "Hyderabad", "Chennai", "Gurugram", "Noida", "Kolkata", "Jaipur"];

const SOURCE_WEIGHTS: { value: Source; weight: number }[] = [
  { value: "linkedin", weight: 35 },
  { value: "careers_page", weight: 20 },
  { value: "referral", weight: 15 },
  { value: "job_board", weight: 18 },
  { value: "agency", weight: 7 },
  { value: "other", weight: 5 },
];

const FINAL_STAGE_WEIGHTS: { value: Stage; weight: number }[] = [
  { value: "applied", weight: 28 },
  { value: "screening", weight: 20 },
  { value: "interview", weight: 17 },
  { value: "offer", weight: 7 },
  { value: "hired", weight: 9 },
  { value: "rejected", weight: 19 },
];

const ADVANCING: Stage[] = ["applied", "screening", "interview", "offer", "hired"];

const NOTES = [
  "Strong fundamentals, communicates clearly.",
  "Good culture fit. Schedule tech round with CTO.",
  "Portfolio is impressive; ask about system design depth.",
  "Salary expectations slightly above band.",
  "Available to join in 2 weeks.",
  "Referred by an engineer on the platform team.",
];

/** The sequence of stages a candidate moved through to end in `finalStage`. */
function stagePath(faker: Faker, finalStage: Stage): Stage[] {
  if (finalStage === "rejected") {
    const reachedIndex = faker.number.int({ min: 0, max: 3 });
    return [...ADVANCING.slice(0, reachedIndex + 1), "rejected"];
  }
  const path = ADVANCING.slice(0, ADVANCING.indexOf(finalStage) + 1);
  // Some strong candidates skip screening straight to interview.
  if (path.includes("interview") && faker.datatype.boolean(0.15)) {
    return path.filter((stage) => stage !== "screening");
  }
  return path;
}

export function buildSeedData(faker: Faker, now: Date, candidateCount = 140) {
  const jobRows: NewJob[] = JOBS.map((job) => ({
    ...job,
    id: randomUUID(),
    description: `We're hiring a ${job.title} to join our ${job.department} team in ${job.location}.`,
    createdAt: new Date(now.getTime() - faker.number.int({ min: 45, max: 75 }) * DAY_MS),
  }));

  const candidateRows: NewCandidate[] = [];
  const activityRows: NewActivity[] = [];
  const usedEmails = new Set<string>();

  for (let i = 0; i < candidateCount; i++) {
    const job = faker.helpers.arrayElement(jobRows);
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    let email = faker.internet.email({ firstName, lastName }).toLowerCase();
    while (usedEmails.has(email)) email = `${faker.string.alphanumeric(4)}.${email}`.toLowerCase();
    usedEmails.add(email);

    // A closed role has no one left in progress: everyone was hired or rejected.
    const finalStage: Stage =
      job.status === "closed"
        ? faker.helpers.weightedArrayElement([
            { value: "hired" as const, weight: 1 },
            { value: "rejected" as const, weight: 6 },
          ])
        : faker.helpers.weightedArrayElement(FINAL_STAGE_WEIGHTS);
    const path = stagePath(faker, finalStage);

    // Older applications are the ones that progressed further.
    const maxAgeDays = 10 + path.length * 10;
    const createdAt = new Date(now.getTime() - faker.number.float({ min: 0.2, max: maxAgeDays }) * DAY_MS);
    const id = randomUUID();

    let at = createdAt;
    path.forEach((stage, index) => {
      if (index > 0) {
        const step = faker.number.float({ min: 0.5, max: 7 }) * DAY_MS;
        at = new Date(Math.min(at.getTime() + step, now.getTime() - 60_000));
      }
      activityRows.push({
        id: randomUUID(),
        candidateId: id,
        type: index === 0 ? "created" : "stage_changed",
        fromStage: index === 0 ? null : path[index - 1],
        toStage: stage,
        note: index > 0 && faker.datatype.boolean(0.25) ? faker.helpers.arrayElement(NOTES) : null,
        createdAt: at,
      });
    });

    if (faker.datatype.boolean(0.3)) {
      activityRows.push({
        id: randomUUID(),
        candidateId: id,
        type: "note_added",
        note: faker.helpers.arrayElement(NOTES),
        createdAt: new Date(Math.min(at.getTime() + DAY_MS / 4, now.getTime() - 30_000)),
      });
    }

    const department = job.department;
    candidateRows.push({
      id,
      name: `${firstName} ${lastName}`,
      email,
      phone: `+91 ${faker.string.numeric(5)} ${faker.string.numeric(5)}`,
      location: faker.helpers.arrayElement(CITIES),
      currentTitle: faker.helpers.arrayElement(TITLES_BY_DEPARTMENT[department]),
      experienceYears: job.employmentType === "internship" ? 0 : faker.number.int({ min: 1, max: 12 }),
      skills: faker.helpers.arrayElements(SKILLS_BY_DEPARTMENT[department], { min: 2, max: 5 }),
      source: faker.helpers.weightedArrayElement(SOURCE_WEIGHTS),
      stage: finalStage,
      rating: faker.datatype.boolean(0.7) ? faker.number.int({ min: 2, max: 5 }) : null,
      linkedinUrl: `https://www.linkedin.com/in/${firstName}-${lastName}-${faker.string.alphanumeric(5)}`.toLowerCase(),
      resumeUrl: null,
      jobId: job.id,
      stageUpdatedAt: at,
      createdAt,
      updatedAt: at,
    });
  }

  return { jobs: jobRows, candidates: candidateRows, activities: activityRows };
}
