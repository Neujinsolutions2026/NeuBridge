import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ProfilePage() {
  const session = await auth();
  if (!session) return null;

  const company = session.user.companyId
    ? await prisma.company.findUnique({ where: { id: session.user.companyId } })
    : null;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-lg font-semibold text-gray-900">Profile</h1>

      <div className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-6 text-sm">
        <Row label="Name" value={session.user.name ?? "—"} />
        <Row label="Email" value={session.user.email ?? "—"} />
        <Row label="Role" value={session.user.role} />
        {company && <Row label="Company" value={company.name} />}
      </div>

      <ChangePasswordForm />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
