import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/authz";
import { removeTeamMemberAction } from "./actions";

export default async function AdminPage() {
  const session = await auth();
  if (!session || !isAdmin(session)) redirect("/dashboard");

  const [companies, projects, team] = await Promise.all([
    prisma.company.findMany({
      include: { users: true, _count: { select: { projects: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.project.findMany({ include: { company: true }, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "INTERNAL"] }, deactivatedAt: null },
      include: { _count: { select: { projectMemberships: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Admin</h1>
        <div className="flex gap-2">
          <Link href="/admin/companies/new" className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            + New Client
          </Link>
          <Link href="/admin/team/new" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            + New Team Member
          </Link>
          <Link href="/admin/projects/new" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            + New Project
          </Link>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Clients</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Company</th>
                <th className="px-5 py-3 font-medium">Contact(s)</th>
                <th className="px-5 py-3 font-medium">Projects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {c.users.map((u) => `${u.name} <${u.email}>`).join(", ") || "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{c._count.projects}</td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-sm text-gray-400">
                    No clients yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Team Members</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Assigned Projects</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {team.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-5 py-3 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3 text-gray-500">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${u.role === "ADMIN" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                      {u.role === "ADMIN" ? "Admin" : "Internal"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {u.role === "ADMIN" ? "All projects" : u._count.projectMemberships}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {u.id !== session.user.id && (
                      <form action={removeTeamMemberAction.bind(null, u.id)}>
                        <button className="text-xs font-medium text-red-600 hover:underline">Remove</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {team.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">
                    No team members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Projects</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 font-medium text-gray-900">{p.code}</td>
                  <td className="px-5 py-3 text-gray-600">{p.name}</td>
                  <td className="px-5 py-3 text-gray-500">{p.company.name}</td>
                  <td className="px-5 py-3 text-gray-500">{p.status}</td>
                  <td className="px-5 py-3">
                    <Link href={`/projects/${p.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">
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
