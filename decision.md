# Decisions

Why the app is built the way it is, and why not the alternatives. Grouped by area; the most recent additions (subtasks, per-subtask status, required task dates, partial progress) are called out separately since they're the freshest and most likely to be revisited.

## Architecture

**Next.js App Router with Server Actions, no separate API layer.**
Every mutation (`createTaskAction`, `addSubtaskAction`, `cycleSubtaskStatusAction`, ...) is a `"use server"` function called directly from a `<form action={...}>`, instead of a REST/GraphQL endpoint called via `fetch`.
- Why: the whole app is server-rendered pages talking to one Postgres/SQLite database behind them — there's no separate mobile client or third party consuming an API, so a formal API layer would just be indirection with nothing on the other end of it. Server Actions also mean the mutation and the page that displays its result live in the same file/folder, which matters a lot when a feature (like subtasks) touches five files at once — you're not hunting across an `api/` tree to find the handler.
- Rejected: a `pages/api/*` or `app/api/*` REST layer — would add request/response typing, JSON parsing, and manual client-side fetch/error-state handling for zero real benefit here.

**Server Components for data reads, Client Components only where interaction requires it.**
`projects/[id]/page.tsx` is a Server Component that does the Prisma query directly; `TaskSubtasks.tsx` and `GanttChart.tsx` are `"use client"` only because they need `useState` for expand/collapse and click-to-reveal behavior.
- Why: minimizes JS shipped to the browser and avoids a client-side data-fetching layer (no SWR/React Query needed) — the server already has the data by the time it renders HTML.
- Rejected: making the whole project page a client component with `useEffect` + fetch — would need a JSON API for every read, plus loading states, for data that's available synchronously on the server anyway.

**`revalidatePath` after every mutation, not client-side cache updates.**
Every action ends with `revalidatePath(\`/projects/${projectId}\`)`, which tells Next.js to re-run the Server Component and send fresh HTML/RSC payload.
- Why: correctness over cleverness. The project page's data (task status, subtask counts, derived progress %) is cross-referential enough that hand-rolling optimistic client-side updates for every action would be a second copy of the derivation logic (`recomputeTaskStatus`, `recalculateProjectProgress`) living in the browser, which *will* drift from the server copy over time.
- Rejected: optimistic UI updates via client state — faster perceived response, but this app is internal/low-traffic, so the round-trip cost isn't worth the duplicated logic and bug surface.

## Data layer

**Prisma ORM, not a query builder or raw SQL.**
- Why: typed queries and typed results end-to-end (the same `Task`/`Subtask` types flow from `prisma.task.findMany` into the React props with no manual mapping), plus `prisma migrate` gives a reviewable history of schema changes as the app grew from "just Projects" to Tasks → Subtasks → per-subtask status.
- Rejected: Drizzle or Kysely (lighter, but the project was already deep into Prisma's migration history by the time it would have mattered) and raw SQL (loses type safety for no real performance win at this scale).

**SQLite in dev, with schema written to be Postgres-portable.**
- Why: zero setup during active development — no Docker/Postgres install needed to iterate. The schema deliberately avoids SQLite-only features so the eventual move to Postgres for production is a `datasource` swap, not a rewrite.
- Rejected: standing up Postgres from day one — would have meant a genuine infra dependency for what was, until recently, still a single-developer prototyping loop.
- Trade-off actually paid: SQLite can't `ALTER TABLE ... DROP COLUMN` or change a column's type in place, so schema changes that touch existing columns (like `Subtask.done` → `Subtask.status`) require Prisma's "RedefineTables" rebuild-the-table pattern under the hood, and on Windows, `prisma migrate dev` refuses to run non-interactively — both are documented, known costs of this choice (see `flow.md` for how migrations are actually applied here).

**Soft-delete (`deactivatedAt`) for users, hard delete for everything else.**
- Why: a removed team member's name still needs to show up correctly on every message, task, and document they authored months ago — hard-deleting the `User` row would either cascade-delete that history or leave orphaned foreign keys. Tasks/Subtasks/Documents don't have this problem (deleting a task's subtasks along with it is exactly what should happen), so they use plain cascading hard deletes.
- Rejected: hard-deleting users too, with a denormalized "authorName" string copied onto each record at creation time — would have worked, but duplicates data and doesn't let a reactivated employee's account reconnect to their own history.

**Progress and task status are derived, never stored as free-standing user input.**
`Project.progress` and a subtasked `Task.status` are both computed from lower-level facts (subtask statuses) every time something changes, rather than being fields the UI lets someone type into.
- Why: this was an explicit ask (percentage was previously a manual field that drifted from reality). A derived value can't go stale relative to its inputs; a manually-entered one always eventually does.
- Rejected: keeping progress editable but "suggesting" a calculated value — still allows drift, just with extra UI.

## Task/Subtask status modeling (most recent work)

**`Subtask.status` reuses the existing `TaskStatus` enum (`TODO` / `IN_PROGRESS` / `DONE`) instead of a new `SubtaskStatus` enum.**
- Why: subtasks and tasks are conceptually the same three states, and reusing the enum means the same `STATUS_CLASS`/cycle-button UI pattern already built for tasks could be reused for subtasks almost verbatim, and the derivation logic (`doneCount`/`todoCount` comparisons) reads identically at both levels.
- Rejected: a separate `SubtaskStatus` enum — would be more "correct" in a strict domain-modeling sense (subtask semantics could diverge from task semantics later), but there's no current requirement that justifies the duplication, and Prisma/TypeScript would just be pushing the same three strings through two different types.

**Status cycles through a click on a colored pill (To Do → In Progress → Done → To Do), not a `<select>` dropdown.**
- Why: matches the existing task-row interaction exactly (same `STATUS_BAR_COLOR`/pill pattern from the Gantt chart and task list), so a user who already knows how to change a task's status needs to learn nothing new for subtasks. A click is also a single server-action round trip; a dropdown needs an `onChange` handler wired to either a client-side state + submit button, or an auto-submitting select — more code for the same three-state result.
- Rejected: `<select>` — more explicit about "jump straight to Done," but adds a form-control interaction pattern that doesn't exist anywhere else in the app.

**In Progress subtasks count as half credit toward project progress; To Do = 0, Done = 1.**
- Why: once subtasks can be In Progress (not just done/not-done), counting them as 0 (same as untouched) would make starting work on 4 of 5 subtasks look identical to a task nobody has opened — which contradicts the entire point of adding a third state. Half credit is the simplest value that isn't "0" or "1" and doesn't require a config option nobody asked for.
- Explicitly flagged as a judgment call, not a requirement: the user hadn't specified a weighting for the in-progress state, so this was picked as a reasonable default and called out rather than silently assumed.
- Rejected: 0 credit for In Progress (undercounts real progress) and a configurable weight (speculative complexity for a single number nobody has asked to tune).

**Required start/due dates enforced in two places: the `required` HTML attribute *and* a server-side check in `createTaskAction`.**
- Why: the HTML attribute is just UX (stops most accidental empty submits before a network round-trip); the server check is the actual guarantee, since `required` is trivially bypassed (disabled JS, direct POST, devtools). Verified this matters by testing exactly that bypass path.
- Rejected: relying on the client-side `required` attribute alone — would look enforced in normal use while being unenforced in reality.
- Not done: making `startDate`/`dueDate` `NOT NULL` at the schema level — the database already has real tasks created before this rule existed with null dates; a schema-level constraint would need a backfill/migration decision for that historical data that wasn't asked for. Enforcing only at the point of creation was the narrower, requested change.

**Migrations for schema changes were hand-written (not `prisma migrate dev`) when they needed to move existing data.**
- Why: `prisma migrate dev` refuses to run in this non-interactive shell, and even where it *can* run, Prisma's auto-diff for a type-changing column (`Subtask.done Boolean` → `Subtask.status String`) doesn't know how to map old values to new ones — it just drops the old column and applies the new default to every row. The `Subtask.status` migration was hand-written specifically to run `UPDATE ... SET status = 'DONE' WHERE done = 1` before the table rebuild, which was verified against the real pre-migration data (6 existing subtasks with real `done` values) to confirm nothing was silently reset to `TODO`.
- Rejected: letting the auto-generated migration run as-is — would have silently marked every already-completed subtask as incomplete.

## Removing the Project Leader/Manager concept

**Deleted `projectManagerId` from the schema entirely, rather than keeping the field but no longer auto-assigning it.**
- Why: explicitly requested — "I don't need any Project Leader on the basis of team selection." Leaving the column in place but unused would keep dead UI branches (`{m.userId === project.projectManagerId && ...}`) and a dead form hint ("the first selected member is set as project manager") that no longer describe real behavior, which is worse than removing them.
- Rejected: keeping the field nullable and just never setting it — technically non-breaking, but leaves a concept in the schema and codebase that the product no longer has.

## Libraries used, and why

| Library | Why it's used |
|---|---|
| **Next.js 16 (App Router, Turbopack)** | Server Components + Server Actions let one file own both a page's data fetch and its mutations — the core architectural choice above. Turbopack is the dev-mode default; no separate bundler config needed. |
| **React 19** | Required by Next.js 16; also brings `useActionState`, used for inline server-action error messages on the login/team-member/client-creation forms. |
| **TypeScript** | The whole data model (roles, task/subtask status, project status) is a small closed set of enums and relations — TypeScript catches a mistyped `"IN_PROGRESS"` or a missing `include` at compile time instead of at runtime in production. |
| **Prisma (`prisma` + `@prisma/client`), pinned to 6.19.3** | Typed schema-to-client generation and a migration history; pinned below v7 because v7 changes the driver-adapter API in a way that isn't compatible with how this project is set up, and there was no reason to take on that upgrade mid-feature-work. |
| **SQLite (dev), Postgres-portable schema (prod target)** | Zero-setup local iteration now; the schema is written to move to Postgres for production without a rewrite. |
| **NextAuth (Auth.js) v5, Credentials provider, JWT sessions** | The app only has one login method (email/password against the local `User` table) — Credentials is the minimal provider for that. JWT sessions avoid needing a session table/store, which matters since there's no Redis or similar already in the stack. |
| **bcryptjs** | Password hashing for the Credentials provider. Pure-JS (no native binding to compile) was preferred over `bcrypt` specifically because this is a Windows dev environment, where native-module builds have repeatedly been a source of friction (see the recurring Prisma query-engine file-lock issues in `flow.md`) — a pure-JS hashing lib sidesteps that class of problem entirely. |
| **Tailwind CSS v4** | Every component in this app is a one-off layout (tables, pills, forms) with no shared design system to abstract into named classes — utility classes match that "write it once, inline, move on" style better than maintaining separate CSS/module files per component. |
| **Playwright** (dev/test-only, not a `package.json` dependency — installed in the scratch verification directory) | Used to verify each feature end-to-end against the real dev server and real (temporary) database state, rather than mocking. Chosen because this app's correctness lives in server-action → database → re-render round trips, which unit tests around individual functions wouldn't exercise. |

**Unused dependency worth flagging:** `zod` is listed in `package.json` but is not imported anywhere in `src/`. All input validation in this app is done by hand inside each server action (`if (!name) return;`, the new start/due-date presence check, etc.) rather than through Zod schemas. That's not a decision made *for* this codebase so much as a leftover from scaffolding — worth either wiring in or removing the dependency, but out of scope for the feature work done so far.
