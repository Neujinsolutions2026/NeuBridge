import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma, ProjectStatus } from "@prisma/client";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
  OVERDUE: "Overdue",
};

const STATUS_STYLE: Record<ProjectStatus, string> = {
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-green-50 text-green-700",
  ON_HOLD: "bg-amber-50 text-amber-700",
  OVERDUE: "bg-red-50 text-red-700",
};

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) return null;

  const isStaff = session.user.role === "ADMIN" || session.user.role === "INTERNAL";
  const where: Prisma.ProjectWhereInput =
    session.user.role === "ADMIN"
      ? {}
      : session.user.role === "INTERNAL"
      ? { members: { some: { userId: session.user.id } } }
      : {
          companyId: session.user.companyId ?? "",
          OR: [{ clientPocId: null }, { clientPocId: session.user.id }],
        };

  const projects = await prisma.project.findMany({
    where,
    include: { company: true },
    orderBy: { updatedAt: "desc" },
  });

  const overdueCount = projects.filter(
    (p) => p.status !== "COMPLETED" && p.dueDate && p.dueDate < new Date()
  ).length;

  const stats = [
    { label: "Total Projects", value: projects.length },
    { label: "In Progress", value: projects.filter((p) => p.status === "IN_PROGRESS").length },
    { label: "Completed", value: projects.filter((p) => p.status === "COMPLETED").length },
    { label: "On Hold", value: projects.filter((p) => p.status === "ON_HOLD").length },
    { label: "Overdue Tasks", value: overdueCount },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-semibold text-gray-900">
        Welcome, {session.user.name}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {session.user.role === "ADMIN"
          ? "Here is an overview of all client projects."
          : session.user.role === "INTERNAL"
          ? "Here is an overview of the projects you're assigned to."
          : "Here is an overview of your projects."}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {isStaff ? "All Projects" : "My Projects"}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Project Code</th>
                <th className="px-5 py-3 font-medium">Project Name</th>
                {isStaff && <th className="px-5 py-3 font-medium">Client</th>}
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Progress</th>
                <th className="px-5 py-3 font-medium">Due Date</th>
                <th className="px-5 py-3 font-medium">Last Update</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{p.code}</td>
                  <td className="px-5 py-3 text-gray-700">{p.name}</td>
                  {isStaff && <td className="px-5 py-3 text-gray-700">{p.company.name}</td>}
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full bg-gray-900"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(p.dueDate)}</td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(p.updatedAt)}</td>
                  <td className="px-5 py-3">
                    <Link href={`/projects/${p.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={isStaff ? 8 : 7} className="px-5 py-8 text-center text-sm text-gray-400">
                    No projects yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
