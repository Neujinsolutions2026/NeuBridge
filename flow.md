# Execution Flow

How a request travels through this app: what calls what, in what order, and — at the bottom — exactly which parts of that path were added or changed in the most recent work (task subtasks, per-subtask status, required dates, partial progress, removing Project Manager).

## 1. Every request, top to bottom

```
Browser request
  -> src/middleware.ts            (runs on every route except _next/static, _next/image, favicon.ico, uploads)
       -> auth() from src/lib/auth.ts   (reads/verifies the JWT session cookie)
       -> not logged in + not /login or /api/auth  -> redirect to /login
       -> logged in + path starts with /admin + role != ADMIN -> redirect to /dashboard
       -> otherwise -> NextResponse.next(), request proceeds
  -> matched route's layout.tsx chain
       -> src/app/layout.tsx                 (root: <html>, global CSS)
       -> src/app/(app)/layout.tsx           (authenticated shell: Sidebar + Topbar)
            -> auth() again (Server Component, independent of middleware)
            -> prisma.user.findUnique(...)   confirms the session's user isn't deactivated
            -> prisma.notification.count(...) + prisma.company.findUnique(...) in parallel (Promise.all)
            -> renders <Sidebar> / <Topbar> / {children}
  -> the page.tsx for the matched route (Server Component, does its own Prisma reads)
```

Nothing here changed in this session except what the project page's own query includes (see §3).

## 2. Login

```
GET /login -> src/app/login/page.tsx (renders the form)
POST (form submit) -> src/app/login/actions.ts: loginAction(prevState, formData)
  -> signIn("credentials", { email, password, redirectTo: "/dashboard" })   [next-auth]
       -> Credentials provider's authorize() in src/lib/auth.ts
            -> prisma.user.findUnique({ where: { email } })
            -> reject if missing or deactivatedAt is set
            -> bcrypt.compare(password, user.passwordHash)
            -> returns { id, name, email, role, companyId }
       -> jwt() callback: copies role/companyId/id onto the token
       -> session() callback: copies them from the token onto session.user
  -> on success: redirect to /dashboard (handled by next-auth's signIn)
  -> on failure: AuthError caught, returns "Invalid email or password." back to the form via useActionState
```
Untouched by this session's work.

## 3. Opening a project (`/projects/[id]`)

```
src/app/(app)/projects/[id]/page.tsx
  -> auth()                                          get the session
  -> prisma.project.findUnique({ id }, { include: {
        company, poc, members: { user }, tasks: { assignee, subtasks }, documents, messages, updates, callLogs
     }})
  -> canAccessProject(session, project)  [src/lib/authz.ts]  — Admin: always; Internal: only if on project.members; Client: only if same companyId
  -> not found / forbidden -> notFound() / redirect
  -> computes `staff` / `admin` booleans from the session role, used to conditionally render forms
  -> renders tab bar (Overview / Updates / Communication / Required Documents / Tasks / Calls / Team) — tabs are <Link href="?tab=...">, not client-side state, so each tab click is a fresh server render of this same page.tsx
  -> Tasks tab specifically renders, per task:
        - the task row (name, dates, Delayed badge, status pill or read-only badge, Delete button)
        - <TaskSubtasks projectId taskId subtasks />        (client component)
     and once, below the list:
        - <GanttChart tasks projectId staff />                (client component)
```

### 3a. `TaskSubtasks` (client component, `src/app/(app)/projects/[id]/TaskSubtasks.tsx`)
Purely receives `subtasks` as a prop from the page's single Prisma query above — it does **not** fetch anything itself. Its own state (`open`, via `useState`) only controls whether the checklist is expanded; every actual data change is a `<form action={...}>` pointed at one of three server actions in `actions.ts`.

### 3b. `GanttChart` (client component, `src/app/(app)/projects/[id]/GanttChart.tsx`)
Also just reads the `tasks` prop (status, dates, delayReason) that page.tsx already fetched — plots bars client-side with no extra server call, except the delay-reason `<form>` which calls `setTaskDelayReasonAction`.

## 4. A mutation, end to end (e.g. clicking a subtask's status pill)

This is the shape every mutation in `src/app/(app)/projects/[id]/actions.ts` follows:

```
User clicks the pill inside <TaskSubtasks>
  -> browser submits the <form action={cycleSubtaskStatusAction.bind(null, projectId, taskId, subtaskId)}>
  -> Next.js invokes the server action: cycleSubtaskStatusAction(projectId, taskId, subtaskId, [implicit FormData])
       -> requireProjectAccess(projectId)
            -> auth()                                        get session
            -> prisma.project.findUnique({ id: projectId }, { include: { members } })
            -> canAccessProject(session, project)             throw "Forbidden" if not allowed
            -> returns { session, project }
       -> isStaff(session)  [src/lib/authz.ts]                throw if a Client somehow got this far
       -> prisma.subtask.findUnique({ id: subtaskId })         confirm it exists and belongs to taskId
       -> compute next status (TODO -> IN_PROGRESS -> DONE -> TODO)
       -> prisma.subtask.update({ id: subtaskId }, { status: next })
       -> recomputeTaskStatus(taskId)
            -> prisma.subtask.findMany({ where: { taskId } })
            -> derive: all DONE -> DONE; all TODO -> TODO; else -> IN_PROGRESS
            -> prisma.task.update({ id: taskId }, { status })
       -> recalculateProjectProgress(projectId)
            -> prisma.task.findMany({ where: { projectId } }, { include: subtasks })
            -> per task: subtasked tasks get partial credit (DONE=1, IN_PROGRESS=0.5, TODO=0, averaged over its subtasks); non-subtasked tasks get 1 or 0 from task.status
            -> progress = round(sum of task credits / task count * 100)
            -> prisma.project.update({ id: projectId }, { progress })
       -> revalidatePath(`/projects/${projectId}`)
  -> Next.js re-runs src/app/(app)/projects/[id]/page.tsx's Server Component (the query in §3, fresh)
  -> new RSC payload streamed to the browser; React reconciles — the pill's new color/label, the subtask's strikethrough, and the project's progress % (wherever it's displayed) all update from this one round trip, no client-side state was hand-updated
```

`addSubtaskAction` and `deleteSubtaskAction` follow the identical chain, swapping the middle mutation (`prisma.subtask.create` / `prisma.subtask.delete`) but calling the same `recomputeTaskStatus` -> `recalculateProjectProgress` -> `revalidatePath` sequence afterward, in that order, every time.

## 5. Creating a task

```
Tasks tab "Add Task" form -> createTaskAction(projectId, formData)
  -> requireProjectAccess(projectId)  (same as above)
  -> isStaff(session)
  -> read name / startDateRaw / dueDateRaw from formData
  -> if any of the three is missing -> return (no-op; nothing is created, no error shown)
  -> prisma.task.create({ projectId, name, startDate: new Date(startDateRaw), dueDate: new Date(dueDateRaw) })
  -> recalculateProjectProgress(projectId)   (a fresh task with no subtasks is 0 credit -> pulls average down correctly)
  -> revalidatePath(`/projects/${projectId}`)
```

## 6. Toggling a task manually (only reachable for tasks with zero subtasks)

```
Task row's status pill -> toggleTaskAction(projectId, taskId)
  -> requireProjectAccess(projectId) -> isStaff(session)
  -> prisma.task.findUnique({ id: taskId }, { include: { subtasks: { select: { id: true } } } })
  -> if task.subtasks.length > 0 -> return (no-op — the UI shouldn't have rendered a clickable pill for this task at all, since page.tsx swaps it for a read-only <span> once subtasks exist; this is the second guard, in case that branch is ever bypassed)
  -> otherwise cycle TODO -> IN_PROGRESS -> DONE -> TODO
  -> prisma.task.update(...) -> recalculateProjectProgress(projectId) -> revalidatePath(...)
```

## 7. Admin: creating a project

```
src/app/(app)/admin/projects/new/page.tsx (form: code, name, description, companyId, startDate, dueDate, memberIds[])
  -> POST -> createProjectAction(formData)  in src/app/(app)/admin/actions.ts
       -> requireAdmin()  -> auth() + isAdmin(session) check
       -> prisma.project.create({ code, name, description, companyId, startDate, dueDate,
             members: { create: memberIds.map(userId => ({ userId })) } })
       -> redirect("/admin")
```
No `projectManagerId` is set anywhere in this path (see §9 — this line used to read `projectManagerId: memberIds[0] ?? session.user.id` and no longer does).

## 8. Notification fan-out (used by several actions above)

```
notifyCompanyStaffAndClient(projectId, actingUserId, message)   [private helper, bottom of actions.ts]
  -> prisma.project.findUnique({ id: projectId })
  -> prisma.user.findMany({ id != actingUserId AND (same companyId OR role=ADMIN OR is a projectMembership on this project) })
  -> prisma.notification.createMany(...)
```
Called by `postMessageAction`, `addRequiredDocumentAction`, `toggleDocumentStatusAction` (only on RECEIVED), `postUpdateAction`, `logCallAction`. Not touched by this session's work — subtask/task mutations deliberately do **not** call this; only Communication/Documents/Updates/Calls generate notifications.

---

## 9. Exactly which parts of the path were added or modified in this session

**New files:**
- `src/app/(app)/projects/[id]/TaskSubtasks.tsx` — new client component, rendered from `page.tsx`'s Tasks tab per task (§3).

**Modified functions, in `src/app/(app)/projects/[id]/actions.ts`:**
- `createTaskAction` — now reads `startDateRaw`/`dueDateRaw` before the name check and rejects the whole submission (`return`) if either is missing, in addition to name. Previously dates were optional and defaulted to `null`.
- `toggleTaskAction` — query changed from `prisma.task.findUnique({ id })` to include `subtasks: { select: { id: true } }`, with a new guard (`if (task.subtasks.length > 0) return;`) inserted before the status-cycle logic.
- `addSubtaskAction`, `cycleSubtaskStatusAction` (originally `toggleSubtaskAction`), `deleteSubtaskAction` — all three new, all following the create/update/delete -> `recomputeTaskStatus` -> `recalculateProjectProgress` -> `revalidatePath` chain in §4.
- `recomputeTaskStatus` — new private helper; derives a task's status from its subtasks' `status` field (originally from a `done` boolean, before the three-state migration).
- `recalculateProjectProgress` — changed twice: first to weight each task equally and give subtasked tasks partial credit by `done` fraction; then again to change that credit function from binary (done/not) to three-way (`DONE`=1, `IN_PROGRESS`=0.5, `TODO`=0) once subtasks gained a status instead of a boolean.

**Modified functions, in `src/app/(app)/admin/actions.ts`:**
- `createProjectAction` — no longer sets `projectManagerId` on the created project.
- `removeTeamMemberAction` — no longer clears `projectManagerId` when deactivating a user (the field doesn't exist anymore).

**Modified rendering, in `src/app/(app)/projects/[id]/page.tsx`:**
- The `prisma.project.findUnique` include changed: `tasks` now also includes `subtasks`; `projectManager: true` was removed entirely.
- The Tasks tab's task-row JSX: the status pill is now conditional — a real `<form>`-wrapped button only when `t.subtasks.length === 0`, otherwise a non-interactive `<span>` with the same styling; `<TaskSubtasks>` is rendered under every row regardless.
- The "Add Task" form's `startDate`/`dueDate` `<input>`s gained `required`.
- The Team tab's per-member row no longer renders the "Project Manager" badge block.

**Modified form copy, in `src/app/(app)/admin/projects/new/page.tsx`:**
- The team-selection hint text no longer says "The first selected member is set as project manager."

**Schema/migration, `prisma/schema.prisma`:**
- `Subtask.done Boolean` -> `Subtask.status TaskStatus @default(TODO)` (reusing the `Task`'s own enum — see `decision.md`).
- `Project.projectManagerId` / `Project.projectManager` relation removed; `User.managedProjects` removed.
- Two hand-written migrations applied for these (`.../prisma/migrations/20260817100509_remove_project_manager/` and `.../20260817120000_subtask_status/`), the second of which explicitly preserves prior `done` values by mapping them to `status` before dropping the old column (see §"Migrations" in `decision.md`).

**Seed data, `prisma/seed.ts`:**
- No longer passes `projectManagerId: pm.id` when creating seeded projects.
