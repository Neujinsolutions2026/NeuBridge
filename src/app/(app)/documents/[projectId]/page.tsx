import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/authz";
import { Breadcrumb } from "@/components/Breadcrumb";
import { toggleDocumentStatusAction } from "@/app/(app)/projects/[id]/actions";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth();
  if (!session) return null;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: { select: { userId: true } },
      documents: { include: { addedBy: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) notFound();
  if (!canAccessProject(session, project)) notFound();

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Documents", href: "/documents" }, { label: project.name }]} />
      <p className="mt-1 text-sm text-gray-500">{project.code}</p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Document Upload Link</h2>
        {project.documentUploadLink ? (
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
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3 font-medium">Document</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Added By</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {project.documents.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">{d.name}</td>
                <td className="px-5 py-3">
                  <form action={toggleDocumentStatusAction.bind(null, project.id, d.id)}>
                    <button
                      type="submit"
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        d.status === "RECEIVED" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {d.status === "RECEIVED" ? "Received" : "Pending"}
                    </button>
                  </form>
                </td>
                <td className="px-5 py-3 text-gray-500">
                  {d.addedBy.name} · {formatDate(d.createdAt)}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/projects/${project.id}?tab=documents`} className="text-xs font-medium text-gray-500 hover:underline">
                    Open in project →
                  </Link>
                </td>
              </tr>
            ))}
            {project.documents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-400">
                  No required documents yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
