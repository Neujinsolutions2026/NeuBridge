import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject, isAdmin, isStaff } from "@/lib/authz";
import { PhoneIcon } from "@/components/icons";
import { PostUpdateForm } from "./PostUpdateForm";
import { CommunicationThread } from "./CommunicationThread";
import { GanttChart } from "./GanttChart";
import { TaskSubtasks } from "./TaskSubtasks";
import { EditTaskDatesForm } from "./EditTaskDatesForm";
import { AddTaskForm } from "./AddTaskForm";
import { ORG_NAME } from "@/lib/constants";
import {
  updateProjectDetailsAction,
  postMessageAction,
  setDocumentUploadLinkAction,
  setDocumentDeliveryLinkAction,
  addRequiredDocumentAction,
  toggleDocumentStatusAction,
  toggleTaskAction,
  deleteTaskAction,
  logCallAction,
  addProjectMemberAction,
  removeProjectMemberAction,
  setPocAction,
  setClientPocAction,
} from "./actions";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "updates", label: "Updates" },
  { key: "communication", label: "Communication" },
  { key: "documents", label: "Required Documents" },
  { key: "tasks", label: "Tasks" },
  { key: "calls", label: "Calls" },
  { key: "team", label: "Team" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(date: Date) {
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// YYYY-MM-DD, what <input type="date"> needs for its defaultValue.
function toDateInputValue(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab: TabKey = (TABS.find((t) => t.key === tab)?.key ?? "overview");

  const session = await auth();
  if (!session) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      company: { include: { users: true } },
      poc: true,
      clientPoc: true,
      members: { include: { user: true }, orderBy: { createdAt: "asc" } },
      tasks: {
        include: { assignee: true, subtasks: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
      documents: {
        include: { addedBy: true },
        orderBy: { createdAt: "desc" },
      },
      messages: { include: { sender: true, attachments: true }, orderBy: { createdAt: "asc" } },
      updates: { include: { createdBy: true }, orderBy: { createdAt: "desc" } },
      callLogs: { include: { loggedBy: true }, orderBy: { calledAt: "desc" } },
    },
  });

  if (!project) notFound();
  if (!canAccessProject(session, project)) notFound();

  const staff = isStaff(session);
  const admin = isAdmin(session);
  const latestUpdate = project.updates[0];
  const canSendMessage = staff
    ? !project.pocId || project.pocId === session.user.id
    : !project.clientPocId || project.clientPocId === session.user.id;

  const availableStaff = admin
    ? await prisma.user.findMany({
        where: {
          role: { in: ["ADMIN", "INTERNAL"] },
          deactivatedAt: null,
          id: { notIn: project.members.map((m) => m.userId) },
        },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
        ← Back to Projects
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{project.code}</h1>
          <p className="text-sm text-gray-600">{project.name}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-600 sm:grid-cols-4">
          <div>
            <p className="text-xs text-gray-400">Client</p>
            <p>{project.company.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Start Date</p>
            <p>{formatDate(project.startDate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Due Date</p>
            <p>{formatDate(project.dueDate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Progress</p>
            <p>{project.progress}%</p>
          </div>
        </div>
      </div>

      <div className="mt-5 border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/projects/${project.id}?tab=${t.key}`}
              className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium ${
                activeTab === t.key
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === "overview" && (
          <div className="space-y-4">
            {project.status === "ON_HOLD" && project.holdReason && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                <p className="text-sm font-semibold text-amber-800">This project is currently on hold</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{project.holdReason}</p>
              </div>
            )}
            {admin && (
              <details className="rounded-lg border border-gray-200 bg-white p-5">
                <summary className="cursor-pointer text-sm font-semibold text-gray-900">Edit Project Details</summary>
                <form action={updateProjectDetailsAction.bind(null, project.id)} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-gray-600">
                    Project Code
                    <input
                      name="code"
                      defaultValue={project.code}
                      required
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                  <label className="block text-xs font-medium text-gray-600">
                    Project Name
                    <input
                      name="name"
                      defaultValue={project.name}
                      required
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                  <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
                    Description
                    <textarea
                      name="description"
                      defaultValue={project.description ?? ""}
                      rows={2}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                  <label className="block text-xs font-medium text-gray-600">
                    Start Date
                    <input
                      type="date"
                      name="startDate"
                      defaultValue={toDateInputValue(project.startDate)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                  <label className="block text-xs font-medium text-gray-600">
                    Due Date
                    <input
                      type="date"
                      name="dueDate"
                      defaultValue={toDateInputValue(project.dueDate)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                  <button className="sm:col-span-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                    Save Changes
                  </button>
                </form>
              </details>
            )}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-gray-900">Project Summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-gray-400">Description</dt>
                  <dd className="text-gray-700">{project.description ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Overall Progress</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 w-40 rounded-full bg-gray-100">
                      <div className="h-1.5 rounded-full bg-gray-900" style={{ width: `${project.progress}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{project.progress}%</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Expected Completion</dt>
                  <dd className="text-gray-700">{formatDate(project.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Last Updated</dt>
                  <dd className="text-gray-700">{formatDate(project.updatedAt)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-900">This Week&apos;s Update</h2>
              {latestUpdate ? (
                <div className="mt-3 space-y-3 text-sm">
                  {latestUpdate.completed && (
                    <UpdateBlock title="Completed" text={latestUpdate.completed} />
                  )}
                  {latestUpdate.inProgress && (
                    <UpdateBlock title="In Progress" text={latestUpdate.inProgress} />
                  )}
                  {latestUpdate.nextSteps && (
                    <UpdateBlock title="Next Steps" text={latestUpdate.nextSteps} />
                  )}
                  {latestUpdate.risks && <UpdateBlock title="Risks / Issues" text={latestUpdate.risks} />}
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-400">No updates posted yet.</p>
              )}
            </div>
            </div>
          </div>
        )}

        {activeTab === "updates" && (
          <div className="space-y-4">
            {staff && (
              <PostUpdateForm projectId={project.id} progress={project.progress} status={project.status} />
            )}

            <div className="space-y-3">
              {project.updates.map((u) => (
                <div key={u.id} className="rounded-lg border border-gray-200 bg-white p-5">
                  <p className="text-xs text-gray-400">
                    Posted {formatDateTime(u.createdAt)} by {u.createdBy.name}
                  </p>
                  {u.holdReason && (
                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-xs font-semibold text-amber-800">Project put on hold</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-amber-900">{u.holdReason}</p>
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {u.completed && <UpdateBlock title="Completed" text={u.completed} />}
                    {u.inProgress && <UpdateBlock title="In Progress" text={u.inProgress} />}
                    {u.nextSteps && <UpdateBlock title="Next Steps" text={u.nextSteps} />}
                    {u.risks && <UpdateBlock title="Risks / Issues" text={u.risks} />}
                  </div>
                </div>
              ))}
              {project.updates.length === 0 && (
                <p className="text-sm text-gray-400">No updates yet.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "communication" && (
          <div className="rounded-lg border border-gray-200 bg-white">
            <CommunicationThread
              messages={project.messages}
              currentUserId={session.user.id}
              viewerIsClient={session.user.role === "CLIENT"}
              orgName={ORG_NAME}
            />
            {canSendMessage ? (
              <form action={postMessageAction.bind(null, project.id)} className="flex items-end gap-3 border-t border-gray-200 p-4">
                <textarea
                  name="body"
                  rows={2}
                  placeholder="Write a message…"
                  className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
                <input type="file" name="attachment" className="hidden" id="attachment-input" />
                <label htmlFor="attachment-input" className="cursor-pointer rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">
                  📎 Attach
                </label>
                <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                  Send
                </button>
              </form>
            ) : staff ? (
              <p className="border-t border-gray-200 p-4 text-sm text-gray-500">
                Only the Point of Contact (<span className="font-medium text-gray-700">{project.poc?.name}</span>) can send
                messages to the client on this project. You can still read the full conversation above.
              </p>
            ) : (
              <p className="border-t border-gray-200 p-4 text-sm text-gray-500">
                Only your organization&apos;s Point of Contact (
                <span className="font-medium text-gray-700">{project.clientPoc?.name}</span>) can send messages on
                this project. You can still read the full conversation above.
              </p>
            )}
          </div>
        )}

        {activeTab === "documents" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-900">Document Upload Link</h2>
              {staff && project.documentUploadLink ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href={project.documentUploadLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 truncate rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-blue-600 hover:underline"
                  >
                    {project.documentUploadLink}
                  </a>
                  <form action={setDocumentUploadLinkAction.bind(null, project.id)}>
                    <button className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                      Remove
                    </button>
                  </form>
                </div>
              ) : staff ? (
                <form action={setDocumentUploadLinkAction.bind(null, project.id)} className="mt-3 flex flex-wrap gap-2">
                  <input
                    name="documentUploadLink"
                    type="url"
                    placeholder="https://workdrive.zoho.com/folder/..."
                    required
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                    Save
                  </button>
                </form>
              ) : project.documentUploadLink ? (
                <a
                  href={project.documentUploadLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Upload Documents ↗
                </a>
              ) : (
                <p className="mt-2 text-sm text-gray-400">No upload link has been shared yet.</p>
              )}
              <p className="mt-2 text-[11px] text-gray-400">
                All required documents should be uploaded here. Files aren&apos;t stored in this app.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-900">Document Delivery Link</h2>
              {staff && project.documentDeliveryLink ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href={project.documentDeliveryLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 truncate rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-blue-600 hover:underline"
                  >
                    {project.documentDeliveryLink}
                  </a>
                  <form action={setDocumentDeliveryLinkAction.bind(null, project.id)}>
                    <button className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                      Remove
                    </button>
                  </form>
                </div>
              ) : staff ? (
                <form action={setDocumentDeliveryLinkAction.bind(null, project.id)} className="mt-3 flex flex-wrap gap-2">
                  <input
                    name="documentDeliveryLink"
                    type="url"
                    placeholder="https://workdrive.zoho.com/folder/..."
                    required
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                    Save
                  </button>
                </form>
              ) : project.documentDeliveryLink ? (
                <a
                  href={project.documentDeliveryLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  View Documents ↗
                </a>
              ) : (
                <p className="mt-2 text-sm text-gray-400">No documents have been shared with you yet.</p>
              )}
              <p className="mt-2 text-[11px] text-gray-400">
                Documents we send to you (reports, deliverables) will be shared here.
              </p>
            </div>

            {staff && (
              <form action={addRequiredDocumentAction.bind(null, project.id)} className="flex gap-2 rounded-lg border border-gray-200 bg-white p-4">
                <input name="name" placeholder="Required document name" required className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Add</button>
              </form>
            )}

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Document</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Added By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {project.documents.map((d) => (
                    <tr key={d.id}>
                      <td className="px-5 py-3 font-medium text-gray-900">{d.name}</td>
                      <td className="px-5 py-3">
                        <form action={toggleDocumentStatusAction.bind(null, project.id, d.id)}>
                          <button
                            type="submit"
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              d.status === "RECEIVED" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {d.status === "RECEIVED" ? (staff ? "Received" : "Sent") : "Pending"}
                          </button>
                        </form>
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {d.addedBy.name} · {formatDate(d.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {project.documents.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-sm text-gray-400">
                        No required documents yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="space-y-4">
            {staff && <AddTaskForm projectId={project.id} />}
            {staff && (
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                {project.tasks.map((t) => (
                  <div key={t.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className={`text-sm ${t.status === "DONE" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                          {t.name}
                          {!t.startDate && !t.dueDate && (
                            <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                              Unscheduled
                            </span>
                          )}
                          {t.status !== "DONE" && t.dueDate && t.dueDate < new Date() && (
                            <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                              Delayed
                            </span>
                          )}
                        </p>
                        {(t.startDate || t.dueDate) && (
                          <p className="text-xs text-gray-400">
                            {t.startDate ? formatDate(t.startDate) : "—"} → {t.dueDate ? formatDate(t.dueDate) : "—"}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {t.subtasks.length > 0 ? (
                          <span
                            title="Status is derived from subtasks"
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              t.status === "DONE" ? "bg-green-50 text-green-700" : t.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {t.status === "TODO" ? "To Do" : t.status === "IN_PROGRESS" ? "In Progress" : "Done"}
                          </span>
                        ) : (
                          <form action={toggleTaskAction.bind(null, project.id, t.id)}>
                            <button className={`rounded-full px-3 py-1 text-xs font-medium ${
                              t.status === "DONE" ? "bg-green-50 text-green-700" : t.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                            }`}>
                              {t.status === "TODO" ? "To Do" : t.status === "IN_PROGRESS" ? "In Progress" : "Done"}
                            </button>
                          </form>
                        )}
                        <form action={deleteTaskAction.bind(null, project.id, t.id)}>
                          <button className="text-xs font-medium text-red-600 hover:underline">Delete</button>
                        </form>
                      </div>
                    </div>
                    <EditTaskDatesForm projectId={project.id} taskId={t.id} startDate={t.startDate} dueDate={t.dueDate} />
                    <TaskSubtasks projectId={project.id} taskId={t.id} subtasks={t.subtasks} />
                  </div>
                ))}
                {project.tasks.length === 0 && <p className="p-5 text-sm text-gray-400">No tasks yet.</p>}
              </div>
            )}

            <GanttChart tasks={project.tasks} projectId={project.id} staff={staff} />
          </div>
        )}

        {activeTab === "calls" && (
          <div className="space-y-4">
            {staff && (
              <details className="rounded-lg border border-gray-200 bg-white p-5">
                <summary className="cursor-pointer text-sm font-semibold text-gray-900">Log a Call</summary>
                <form action={logCallAction.bind(null, project.id)} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-gray-500 sm:col-span-2">
                    Date &amp; Time
                    <input
                      type="datetime-local"
                      name="calledAt"
                      required
                      defaultValue={new Date().toISOString().slice(0, 16)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs text-gray-500 sm:col-span-2">
                    Participants
                    <input
                      name="participants"
                      required
                      placeholder="e.g. John Smith (client), Neujin Solutions Team"
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs text-gray-500 sm:col-span-2">
                    Summary
                    <textarea name="summary" required rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="block text-xs text-gray-500 sm:col-span-2">
                    Next Steps (optional)
                    <textarea name="nextSteps" rows={2} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </label>
                  <button className="ml-auto rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 sm:col-span-2">
                    Save Call Note
                  </button>
                </form>
              </details>
            )}

            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {project.callLogs.map((c) => (
                <div key={c.id} className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                      <PhoneIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{formatDateTime(c.calledAt)}</p>
                      <p className="text-xs text-gray-400">Logged by {c.loggedBy.name} · With: {c.participants}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{c.summary}</p>
                      {c.nextSteps && (
                        <div className="mt-2 rounded-md bg-gray-50 px-3 py-2">
                          <p className="text-xs font-semibold text-gray-500">Next Steps</p>
                          <p className="whitespace-pre-wrap text-sm text-gray-700">{c.nextSteps}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {project.callLogs.length === 0 && (
                <p className="p-5 text-sm text-gray-400">No calls logged yet.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "team" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-700">
                <span className="text-gray-400">Client Contact: </span>{project.company.name}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-900">Point of Contact</h2>
              <p className="mt-1 text-xs text-gray-400">
                Only the POC can message the client in Communication. Everyone on the team can still read the full
                history, so a new POC can catch up instantly if this changes.
              </p>
              <p className="mt-3 text-sm text-gray-700">
                {project.poc ? (
                  <span className="font-medium text-gray-900">{project.poc.name}</span>
                ) : (
                  <span className="text-gray-400">No POC assigned yet — any team member can message the client.</span>
                )}
              </p>
              {admin && (
                <form action={setPocAction.bind(null, project.id)} className="mt-3 flex flex-wrap items-center gap-2">
                  <select key={project.pocId ?? "none"} name="userId" defaultValue={project.pocId ?? ""} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="">No POC (anyone can message)</option>
                    {project.members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                    Set POC
                  </button>
                </form>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-900">Client Point of Contact</h2>
              <p className="mt-1 text-xs text-gray-400">
                The mirror of POC on the client&apos;s side — useful when a company has more than one client login
                (e.g. a different contact per project). Only they can message staff for this project; everyone else
                from the company can still read the full history.
              </p>
              <p className="mt-3 text-sm text-gray-700">
                {project.clientPoc ? (
                  <span className="font-medium text-gray-900">
                    {project.clientPoc.name} <span className="text-xs text-gray-400">({project.clientPoc.email})</span>
                  </span>
                ) : (
                  <span className="text-gray-400">No client POC assigned yet — any client user from this company can message staff.</span>
                )}
              </p>
              {admin && (
                <form action={setClientPocAction.bind(null, project.id)} className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    key={project.clientPocId ?? "none"}
                    name="userId"
                    defaultValue={project.clientPocId ?? ""}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">No client POC (any client user can message)</option>
                    {project.company.users
                      .filter((u) => u.role === "CLIENT")
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                  </select>
                  <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                    Set Client POC
                  </button>
                </form>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 px-5 py-3">
                <h2 className="text-sm font-semibold text-gray-900">Team Members</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {project.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {m.user.name}
                        {m.userId === project.pocId && (
                          <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            POC
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">{m.user.email}</p>
                    </div>
                    {admin && (
                      <form action={removeProjectMemberAction.bind(null, project.id, m.id)}>
                        <button className="text-xs font-medium text-red-600 hover:underline">Remove</button>
                      </form>
                    )}
                  </div>
                ))}
                {project.members.length === 0 && (
                  <p className="px-5 py-8 text-center text-sm text-gray-400">No team members assigned yet.</p>
                )}
              </div>

              {admin && availableStaff.length > 0 && (
                <form action={addProjectMemberAction.bind(null, project.id)} className="flex items-center gap-2 border-t border-gray-200 p-4">
                  <select name="userId" required className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="">Add team member…</option>
                    {availableStaff.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                  <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                    Add
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UpdateBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500">{title}</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-gray-700">
        {text.split("\n").filter(Boolean).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

