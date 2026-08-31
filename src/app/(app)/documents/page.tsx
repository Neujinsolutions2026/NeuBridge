import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { FolderTile } from "@/components/FolderTile";
import { Breadcrumb } from "@/components/Breadcrumb";

export default async function DocumentsPage() {
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

  const projects = await prisma.project.findMany({
    where: projectWhere,
    include: { _count: { select: { documents: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Required Documents" }]} />
      <p className="mt-1 text-sm text-gray-500">
        Files live on Zoho — this just tracks what&apos;s needed, what&apos;s been shared, and what&apos;s still pending.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <FolderTile
              key={p.id}
              href={`/documents/${p.id}`}
              label={p.name}
              sublabel={p.code}
              count={p._count.documents}
            />
          ))}
        </div>
        {projects.length === 0 && <p className="text-sm text-gray-400">No projects yet.</p>}
      </div>
    </div>
  );
}
