import "server-only";
import { getDb } from "@/server/db/client";
import { createCandidateService } from "@/server/services/candidate.service";
import { createDashboardService } from "@/server/services/dashboard.service";
import { createJobService } from "@/server/services/job.service";

/**
 * Composition root: wires services to the real database. Route handlers depend
 * on this module only, so tests can swap it for a PGlite-backed container.
 */
function build() {
  const db = getDb();
  return {
    candidates: createCandidateService(db),
    jobs: createJobService(db),
    dashboard: createDashboardService(db),
  };
}

let instance: ReturnType<typeof build> | undefined;

export function services() {
  instance ??= build();
  return instance;
}
