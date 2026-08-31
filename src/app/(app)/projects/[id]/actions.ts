"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject, isAdmin, isClient, isStaff } from "@/lib/authz";
import { saveUploadedFile } from "@/lib/storage";

async function requireProjectAccess(projectId: string) {
  const session = await auth();
  if (!session) throw new Error("Not authenticated");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: { select: { userId: true } } },
  });
  if (!project) throw new Error("Project not found");
  if (!canAccessProject(session, project)) throw new Error("Forbidden");

  return { session, project };
}

export async function postMessageAction(projectId: string, formData: FormData) {
  const { session, project } = await requireProjectAccess(projectId);

  // Once a POC is assigned, only they may message the client on staff's
  // behalf - everyone else on the team can still read the full thread.
  if (isStaff(session) && project.pocId && project.pocId !== session.user.id) {
    throw new Error("Only the Point of Contact can send messages on this project");
  }
  // Mirror of the above for the client's side: once a company has more than
  // one client user (e.g. a different contact per project), only that
  // project's client POC may message staff - others from the company can
  // still read the thread.
  if (isClient(session) && project.clientPocId && project.clientPocId !== session.user.id) {
    throw new Error("Only your organization's Point of Contact can send messages on this project");
  }

  const body = (formData.get("body") as string | null)?.trim();
  const file = formData.get("attachment") as File | null;
  if (!body && (!file || file.size === 0)) return;

  const message = await prisma.message.create({
    data: {
      projectId,
      senderId: session.user.id,
      body: body || "(attachment)",
    },
  });

  if (file && file.size > 0) {
    const { filePath, fileName } = await saveUploadedFile(file);
    await prisma.messageAttachment.create({
      data: { messageId: message.id, filePath, fileName },
    });
  }

  await notifyCompanyStaffAndClient(projectId, session.user.id, `New message on ${(await prisma.project.findUnique({ where: { id: projectId } }))?.code}`);

  revalidatePath(`/projects/${projectId}`);
}

export async function updateProjectDetailsAction(projectId: string, formData: FormData) {
  const { session } = await requireProjectAccess(projectId);
  if (!isAdmin(session)) throw new Error("Only admins can edit project details");

  const code = (formData.get("code") as string | null)?.trim();
  const name = (formData.get("name") as string | null)?.trim();
  if (!code || !name) return;

  const description = (formData.get("description") as string | null)?.trim() || null;
  const startDateRaw = formData.get("startDate") as string | null;
  const dueDateRaw = formData.get("dueDate") as string | null;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      code,
      name,
      description,
      startDate: startDateRaw ? new Date(startDateRaw) : null,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function setDocumentUploadLinkAction(projectId: string, formData: FormData) {
  const { session } = await requireProjectAccess(projectId);
  if (!isStaff(session)) throw new Error("Only staff can set the upload link");

  const link = (formData.get("documentUploadLink") as string | null)?.trim() || null;
  await prisma.project.update({ where: { id: projectId }, data: { documentUploadLink: link } });

  revalidatePath(`/projects/${projectId}`);
}

export async function setDocumentDeliveryLinkAction(projectId: string, formData: FormData) {
  const { session } = await requireProjectAccess(projectId);
  if (!isStaff(session)) throw new Error("Only staff can set the delivery link");

  const link = (formData.get("documentDeliveryLink") as string | null)?.trim() || null;
  await prisma.project.update({ where: { id: projectId }, data: { documentDeliveryLink: link } });

  revalidatePath(`/projects/${projectId}`);
}

export async function addRequiredDocumentAction(projectId: string, formData: FormData) {
  const { session } = await requireProjectAccess(projectId);
  if (!isStaff(session)) throw new Error("Only staff can add required documents");

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return;

  await prisma.document.create({
    data: { projectId, name, status: "PENDING", addedById: session.user.id },
  });

  await notifyCompanyStaffAndClient(projectId, session.user.id, `Document requested from client: "${name}"`);

  revalidatePath(`/projects/${projectId}`);
}

export async function toggleDocumentStatusAction(projectId: string, documentId: string) {
  const { session } = await requireProjectAccess(projectId);

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document || document.projectId !== projectId) throw new Error("Document not found");

  const next = document.status === "PENDING" ? "RECEIVED" : "PENDING";
  await prisma.document.update({ where: { id: documentId }, data: { status: next } });

  if (next === "RECEIVED") {
    await notifyCompanyStaffAndClient(projectId, session.user.id, `Document received: "${document.name}"`);
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function createTaskAction(projectId: string, formData: FormData) {
  const { session } = await requireProjectAccess(projectId);
  if (!isStaff(session)) throw new Error("Only staff can create tasks");

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return;

  const unscheduled = formData.get("unscheduled") === "on";
  const startDateRaw = formData.get("startDate") as string | null;
  const dueDateRaw = formData.get("dueDate") as string | null;
  // Scheduled tasks need both dates to be plotted on the Gantt chart and
  // judged for delay. Unscheduled tasks are created without them on
  // purpose (e.g. backlog work with no timeline yet) and simply show up
  // in the Gantt chart's "unscheduled" list instead of on the timeline.
  if (!unscheduled && (!startDateRaw || !dueDateRaw)) return;

  await prisma.task.create({
    data: {
      projectId,
      name,
      startDate: unscheduled ? null : new Date(startDateRaw as string),
      dueDate: unscheduled ? null : new Date(dueDateRaw as string),
    },
  });

  await recalculateProjectProgress(projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function toggleTaskAction(projectId: string, taskId: string) {
  const { session } = await requireProjectAccess(projectId);
  if (!isStaff(session)) throw new Error("Only staff can update tasks");

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { subtasks: { select: { id: true } } },
  });
  if (!task) return;
  // Once a task has subtasks, its status is derived from them - manual
  // toggling is ignored so the two mechanisms can't fight each other.
  if (task.subtasks.length > 0) return;

  const next = task.status === "DONE" ? "TODO" : task.status === "TODO" ? "IN_PROGRESS" : "DONE";
  await prisma.task.update({ where: { id: taskId }, data: { status: next } });

  await recalculateProjectProgress(projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function addSubtaskAction(projectId: string, taskId: string, formData: FormData) {
  const { session } = await requireProjectAccess(projectId);
  if (!isStaff(session)) throw new Error("Only staff can add subtasks");

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.projectId !== projectId) return;

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return;

  await prisma.subtask.create({ data: { taskId, name } });

  await recomputeTaskStatus(taskId);
  await recalculateProjectProgress(projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function cycleSubtaskStatusAction(projectId: string, taskId: string, subtaskId: string) {
  const { session } = await requireProjectAccess(projectId);
  if (!isStaff(session)) throw new Error("Only staff can update subtasks");

  const subtask = await prisma.subtask.findUnique({ where: { id: subtaskId } });
  if (!subtask || subtask.taskId !== taskId) return;

  const next = subtask.status === "DONE" ? "TODO" : subtask.status === "TODO" ? "IN_PROGRESS" : "DONE";
  await prisma.subtask.update({ where: { id: subtaskId }, data: { status: next } });

  await recomputeTaskStatus(taskId);
  await recalculateProjectProgress(projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteSubtaskAction(projectId: string, taskId: string, subtaskId: string) {
  const { session } = await requireProjectAccess(projectId);
  if (!isStaff(session)) throw new Error("Only staff can delete subtasks");

  const subtask = await prisma.subtask.findUnique({ where: { id: subtaskId } });
  if (!subtask || subtask.taskId !== taskId) return;

  await prisma.subtask.delete({ where: { id: subtaskId } });

  await recomputeTaskStatus(taskId);
  await recalculateProjectProgress(projectId);
  revalidatePath(`/projects/${projectId}`);
}

// Derives a task's status from its subtasks: all Done -> Done, all To Do ->
// To Do, any other mix (including any subtask In Progress) -> In Progress.
// No-op for tasks with no subtasks, which keep being toggled by hand.
async function recomputeTaskStatus(taskId: string) {
  const subtasks = await prisma.subtask.findMany({ where: { taskId }, select: { status: true } });
  if (subtasks.length === 0) return;

  const doneCount = subtasks.filter((s) => s.status === "DONE").length;
  const todoCount = subtasks.filter((s) => s.status === "TODO").length;
  const status = doneCount === subtasks.length ? "DONE" : todoCount === subtasks.length ? "TODO" : "IN_PROGRESS";
  await prisma.task.update({ where: { id: taskId }, data: { status } });
}

export async function deleteTaskAction(projectId: string, taskId: string) {
  const { session } = await requireProjectAccess(projectId);
  if (!isStaff(session)) throw new Error("Only staff can delete tasks");

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.projectId !== projectId) return;

  await prisma.task.delete({ where: { id: taskId } });

  await recalculateProjectProgress(projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function setTaskDelayReasonAction(projectId: string, taskId: string, formData: FormData) {
  const { session } = await requireProjectAccess(projectId);
  if (!isStaff(session)) throw new Error("Only staff can explain a delayed task");

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.projectId !== projectId) return;

  const delayReason = (formData.get("delayReason") as string | null)?.trim() || null;
  await prisma.task.update({ where: { id: taskId }, data: { delayReason } });

  revalidatePath(`/projects/${projectId}`);
}

// Progress is fully derived from task completion - never entered by hand.
// Every task is worth an equal share of the project (1 / task count). A task
// with subtasks contributes that share proportionally to how done its
// subtasks are (Done = full credit, In Progress = half credit, To Do = no
// credit), instead of only counting once the whole task flips to Done.
//
// Project status mirrors that: reaching 100% marks the project Completed
// automatically, and dropping back below 100% (a task got reopened, or a
// new task was added) reverts it to In Progress - the same "derived, not
// typed in by hand" treatment as progress itself. On Hold is left alone
// either way, since that's an explicit staff decision progress shouldn't
// silently override.
async function recalculateProjectProgress(projectId: string) {
  const [tasks, project] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      select: { status: true, subtasks: { select: { status: true } } },
    }),
    prisma.project.findUnique({ where: { id: projectId }, select: { status: true } }),
  ]);
  if (!project) return;

  const totalFraction =
    tasks.length === 0
      ? 0
      : tasks.reduce((sum, t) => {
          if (t.subtasks.length > 0) {
            const credit = t.subtasks.reduce(
              (c, s) => c + (s.status === "DONE" ? 1 : s.status === "IN_PROGRESS" ? 0.5 : 0),
              0
            );
            return sum + credit / t.subtasks.length;
          }
          return sum + (t.status === "DONE" ? 1 : 0);
        }, 0);

  const progress = tasks.length === 0 ? 0 : Math.round((totalFraction / tasks.length) * 100);

  let status: typeof project.status | undefined;
  if (project.status !== "ON_HOLD") {
    if (progress === 100 && project.status !== "COMPLETED") status = "COMPLETED";
    else if (progress < 100 && project.status === "COMPLETED") status = "IN_PROGRESS";
  }

  await prisma.project.update({ where: { id: projectId }, data: { progress, ...(status ? { status } : {}) } });
}

export async function postUpdateAction(projectId: string, formData: FormData) {
  const { session } = await requireProjectAccess(projectId);
  if (!isStaff(session)) throw new Error("Only staff can post updates");

  // Completed is derived automatically from 100% task progress (see
  // recalculateProjectProgress) - never accepted directly here, in case a
  // request bypasses the form's disabled dropdown for it.
  const statusRaw = formData.get("status") as string | null;
  const status = statusRaw === "COMPLETED" ? null : statusRaw;
  const holdReason = (formData.get("holdReason") as string | null)?.trim() || null;

  // On Hold requires a justification - reject the whole update rather than
  // silently saving a status change with no explanation.
  if (status === "ON_HOLD" && !holdReason) return;

  await prisma.projectUpdate.create({
    data: {
      projectId,
      completed: (formData.get("completed") as string) || null,
      inProgress: (formData.get("inProgress") as string) || null,
      nextSteps: (formData.get("nextSteps") as string) || null,
      risks: (formData.get("risks") as string) || null,
      holdReason: status === "ON_HOLD" ? holdReason : null,
      createdById: session.user.id,
    },
  });

  await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(status ? { status: status as never } : {}),
      holdReason: status === "ON_HOLD" ? holdReason : null,
    },
  });

  await notifyCompanyStaffAndClient(
    projectId,
    session.user.id,
    status === "ON_HOLD" ? "Project put on hold" : "New weekly status update posted"
  );

  revalidatePath(`/projects/${projectId}`);
}

export async function logCallAction(projectId: string, formData: FormData) {
  const { session } = await requireProjectAccess(projectId);
  if (!isStaff(session)) throw new Error("Only staff can log a call");

  const calledAtRaw = formData.get("calledAt") as string | null;
  const participants = (formData.get("participants") as string | null)?.trim();
  const summary = (formData.get("summary") as string | null)?.trim();
  const nextSteps = (formData.get("nextSteps") as string | null)?.trim() || null;

  if (!calledAtRaw || !participants || !summary) return;

  await prisma.callLog.create({
    data: {
      projectId,
      calledAt: new Date(calledAtRaw),
      participants,
      summary,
      nextSteps,
      loggedById: session.user.id,
    },
  });

  await notifyCompanyStaffAndClient(projectId, session.user.id, "A call was logged");

  revalidatePath(`/projects/${projectId}`);
}

export async function addProjectMemberAction(projectId: string, formData: FormData) {
  const { session } = await requireProjectAccess(projectId);
  if (!isAdmin(session)) throw new Error("Only admins can manage the project team");

  const userId = formData.get("userId") as string | null;
  if (!userId) return;

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: {},
    create: { projectId, userId },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectMemberAction(projectId: string, memberId: string) {
  const { session, project } = await requireProjectAccess(projectId);
  if (!isAdmin(session)) throw new Error("Only admins can manage the project team");

  const member = await prisma.projectMember.findUnique({ where: { id: memberId } });
  await prisma.projectMember.delete({ where: { id: memberId } });

  // Don't leave the POC pointing at someone no longer on the team.
  if (member && member.userId === project.pocId) {
    await prisma.project.update({ where: { id: projectId }, data: { pocId: null } });
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function setPocAction(projectId: string, formData: FormData) {
  const { session, project } = await requireProjectAccess(projectId);
  if (!isAdmin(session)) throw new Error("Only admins can set the Point of Contact");

  const userId = (formData.get("userId") as string | null) || null;

  // The POC must be someone currently on the project's team.
  if (userId && !project.members.some((m) => m.userId === userId)) {
    throw new Error("The Point of Contact must be a member of the project team");
  }

  await prisma.project.update({ where: { id: projectId }, data: { pocId: userId } });
  revalidatePath(`/projects/${projectId}`);
}

export async function setClientPocAction(projectId: string, formData: FormData) {
  const { session, project } = await requireProjectAccess(projectId);
  if (!isAdmin(session)) throw new Error("Only admins can set the Client Point of Contact");

  const userId = (formData.get("userId") as string | null) || null;

  // The client POC must be a CLIENT user from this project's own company -
  // a company can have several client logins (e.g. one per project), so
  // this can differ project to project even for the same company.
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "CLIENT" || user.companyId !== project.companyId) {
      throw new Error("The Client Point of Contact must be a client user from this project's company");
    }
  }

  await prisma.project.update({ where: { id: projectId }, data: { clientPocId: userId } });
  revalidatePath(`/projects/${projectId}`);
}

async function notifyCompanyStaffAndClient(projectId: string, actingUserId: string, message: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return;

  const recipients = await prisma.user.findMany({
    where: {
      id: { not: actingUserId },
      OR: [
        { companyId: project.companyId },
        { role: "ADMIN" },
        { projectMemberships: { some: { projectId } } },
      ],
    },
    select: { id: true },
  });

  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((r) => ({ userId: r.id, projectId, message })),
  });
}
