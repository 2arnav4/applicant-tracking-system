# Applicant Tracker

A small applicant tracking system: manage candidates and jobs, move people through hiring stages on a drag-and-drop board, search and filter applicants, and watch pipeline metrics on a dashboard.

- **Live app:** _added after deploy_
- **Demo video:** _added after recording_

## Features

| Area | What it does |
|---|---|
| **Dashboard** | Totals, active pipeline, new applications (30d), hires, average time-to-hire, open jobs; daily applications chart; hiring funnel with stage-to-stage conversion; stage and source breakdowns; recent activity feed |
| **Pipeline** | Kanban board across Applied → Screening → Interview → Offer → Hired / Rejected. Drag-and-drop with optimistic updates and automatic rollback, keyboard support (Space to pick up / drop), valid drop targets highlighted while dragging, filter by job, search |
| **Candidates** | Server-side search (name, email, title, skills), filters (stage, job, source), six sort orders, pagination; create / edit / delete; detail drawer with stage changes, notes and a full activity timeline |
| **Jobs** | Create / edit / delete roles, change status (open / on hold / closed), per-job candidate, active and hired counts, jump to that job's pipeline |

### Business rules

Enforced on the server and mirrored in the UI from one shared module (`src/shared/domain.ts`):

- New candidates always start in **Applied**.
- A candidate can only be moved to **Hired** from **Offer**.
- **Hired** is terminal. Reversing a hire is an HR process, not a drag-and-drop.
- Rejected candidates can be reopened into any active stage.
- Emails are unique, compared case-insensitively.
- **Stale-write protection:** a stage change carries the stage the client last saw (`fromStage`). If someone else moved the candidate in the meantime, the API returns `409` instead of silently overwriting their move.

## Tech stack and why

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router) + TypeScript** | UI and API in one deployable; typed route params via `RouteContext` |
| Database | **PostgreSQL** + **Drizzle ORM** | Relational data with real constraints (FKs, enums, unique and check constraints); Drizzle is typed SQL with no query-engine binary, and its migrations are plain SQL files |
| Validation | **Zod 4** | One schema validates API input *and* drives the client forms |
| Server state | **TanStack Query** | Caching, request dedup, background refetch, optimistic updates with rollback |
| Client state | **Zustand** | Filters, sort, pagination and which panel is open; persisted preferences |
| Forms | **React Hook Form** + Zod resolver | Uncontrolled inputs, schema-driven errors, server errors mapped back onto fields |
| Drag and drop | **dnd-kit** | Accessible (keyboard sensor, screen-reader announcements), headless |
| Charts | **Recharts** | Responsive SVG charts with tooltips |
| Tests | **Vitest**, **PGlite**, **Testing Library** | Service and API tests run against a real Postgres engine in memory |
| Hosting | **Vercel** + **Neon** Postgres | |

## Architecture

```
Browser
  features/*          React components + TanStack Query hooks (server state)
  stores/ui-store     Zustand (UI state: filters, sort, page, open drawer)
  lib/api-client      fetch wrapper → typed ApiError {status, code, message, details}
        │  JSON over /api/*
        ▼
app/api/**/route.ts   Thin handlers: parse + validate (Zod) → call service → respond
server/http/handler   route() wrapper: AppError/ZodError → consistent JSON error + status
server/container      Composition root: services wired to the DB (swapped in tests)
server/services/*     Business logic and transactions (candidate, job, dashboard)
server/db/*           Drizzle schema, client (pooled), migrations in /drizzle
        ▼
PostgreSQL
```

- **Thin route handlers, logic in services.** Services take the database as a parameter (`createCandidateService(db)`), so the same code runs against Neon in production and in-memory PGlite in tests.
- **Typed errors.** Services throw `NotFoundError`, `ConflictError` or `BusinessRuleError`; one wrapper maps them to `404` / `409` / `422`. Unknown errors become a generic `500` and are logged server-side, so internals never leak.
- **Shared contract.** `src/shared/` (domain rules, Zod schemas, response types) is imported by both sides.

### Data model

```
jobs ──< candidates ──< candidate_activities
```

- `candidates`: profile fields, `skills text[]`, `stage` enum, `source` enum, rating (CHECK 1–5), `job_id` (FK, `ON DELETE SET NULL`, so deleting a job never deletes people), `stage_updated_at`.
- `candidate_activities`: append-only log of `created`, `stage_changed` (from → to), `note_added` and `updated`. It feeds the timeline and the metrics.
- Indexes: unique email, stage, (job_id, stage), created_at; activities by (candidate_id, created_at) and to_stage.

### Metric definitions

- **Funnel, "reached stage S"**: the candidate was ever moved into S *or any later stage*. It comes from the activity log, so a candidate rejected after an interview still counts toward Screening and Interview, and a candidate who skipped Screening still counts as having passed it. This keeps the funnel monotonic, and conversion is `reached(S) / reached(previous)`.
- **Average time to hire**: application time → the `hired` stage event, averaged over hires.
- **Applications per day**: last 30 UTC days, zero-filled.

## API

All responses are JSON. Errors look like `{ "error": { "code", "message", "details?" } }`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/candidates` | `q, stage, jobId, source, sort, page, pageSize` → `{ data, meta }` |
| POST | `/api/candidates` | 201; 400 validation; 409 duplicate email; 404 unknown job |
| GET / PATCH / DELETE | `/api/candidates/:id` | detail includes job + activity timeline; PATCH is partial |
| PATCH | `/api/candidates/:id/stage` | `{ stage, fromStage?, note? }`; 422 rule violation; 409 stale |
| POST | `/api/candidates/:id/notes` | `{ body }` |
| GET | `/api/pipeline` | `q, jobId` → columns with totals (latest 50 cards per stage) |
| GET / POST | `/api/jobs` | list includes candidate / active / hired counts |
| GET / PATCH / DELETE | `/api/jobs/:id` | |
| GET | `/api/dashboard` | all metrics in one payload |
| GET | `/api/health` | DB reachability, 503 when down |

## Running locally

Requires Node 22+, pnpm and a Postgres database (local, Docker, or a free Neon branch).

```bash
pnpm install
cp .env.example .env          # set DATABASE_URL
pnpm db:migrate               # apply migrations
pnpm db:seed                  # optional: 7 jobs, 140 candidates with realistic histories (wipes data)
pnpm dev                      # http://localhost:3000
```

## Testing

```bash
pnpm test        # 82 tests: unit, service integration, API routes, UI components
pnpm check       # typecheck + lint + tests (what CI runs, plus build)
```

| Suite | What it covers |
|---|---|
| `tests/unit` | Stage-transition table, skill normalization, Zod schemas (including a regression test for Zod 4 applying defaults inside `.partial()`), optimistic board reducer, LIKE escaping, metric helpers |
| `tests/server` | Services against **real Postgres (PGlite) with the real migrations**: search (including literal `%` and `_`), filters, sort, pagination, duplicate email, transactions rolling back, stage rules, stale-write 409, concurrent moves, cascades, funnel / time-to-hire / zero-filled series |
| `tests/api` | Route handlers end to end: status codes (201/204/400/404/409/422/500), error shape, malformed JSON, no leaked internals |
| `tests/ui` | Candidate form validation, value normalization, server 409 shown on the email field; UI store behavior and persistence rules |

## Deployment

1. Provision Postgres (Neon via the Vercel Marketplace sets `DATABASE_URL` on the project).
2. Run migrations once against it: `DATABASE_URL=... pnpm db:migrate` (optionally `pnpm db:seed`).
3. Deploy with Vercel. Migrations are deliberately **not** run inside `next build`, so preview builds can never alter the production schema.

## Trade-offs and what I'd do next

- **No authentication.** Single-tenant demo, out of scope for a ~6-hour build. Next would be auth (e.g. Clerk), an `organization_id` on every table, and ownership checks in every service call.
- **One active application per candidate.** A candidate links to at most one job. A full ATS separates `Candidate` from `Application(candidate, job, stage)` so one person can apply to several roles. The services keep stage logic in one place, so that split stays contained.
- **Search** uses `ILIKE` plus a skills `unnest`. That's fine at thousands of rows; at scale I'd add a `pg_trgm` GIN index or a `tsvector` column.
- **Offset pagination** is simple and supports page numbers; for very large tables, keyset (cursor) pagination avoids deep-offset scans.
- **Board columns** show the latest 50 cards per stage with true totals; infinite scroll per column would be next.
- **UI state in Zustand rather than the URL.** Filters persist per browser but aren't shareable links. Moving them into search params is a small change confined to the store.
- **Concurrency.** Stage changes lock the row (`SELECT … FOR UPDATE`) and check `fromStage`. The tests prove the stale-write path; real lock contention can only be exercised on a multi-connection Postgres, not single-connection PGlite.
- Also next: resume file upload (object storage), email notifications on stage changes, an audit of who made each change (needs auth), CSV import and export, rate limiting.
