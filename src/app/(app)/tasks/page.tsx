import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const STATUS_STYLE = {
  TODO: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  DONE: "bg-green-50 text-green-700",
} as const;

export default async function TasksPage() {
  const session = await auth();
  if (!session) return null;

  const projectWhere: Prisma.ProjectWhereInput =
    session.user.role === "ADMIN"
      ? {}
      : session.user.role === "INTERNAL"
      ? { members: { some: { userId: session.user.id } } }
      : {
          companyId: session.user.companyId ?? "",
          OR: [{ clientPocId: null }, { clientPocId: session.user.id }],
        };

  const tasks = await prisma.task.findMany({
    where: { project: projectWhere },
    include: { project: true, assignee: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-lg font-semibold text-gray-900">Tasks</h1>
      <p className="mt-1 text-sm text-gray-500">All tasks across your projects.</p>

      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3 font-medium">Task</th>
              <th className="px-5 py-3 font-medium">Project</th>
              <th className="px-5 py-3 font-medium">Assignee</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">{t.name}</td>
                <td className="px-5 py-3 text-gray-600">{t.project.code}</td>
                <td className="px-5 py-3 text-gray-500">{t.assignee?.name ?? "Unassigned"}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[t.status]}`}>
                    {t.status === "TODO" ? "To Do" : t.status === "IN_PROGRESS" ? "In Progress" : "Done"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <Link href={`/projects/${t.project.id}?tab=tasks`} className="text-xs font-medium text-blue-600 hover:underline">
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">
                  No tasks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
