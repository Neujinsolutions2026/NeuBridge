import { prisma } from "@/lib/prisma";
import { createProjectAction } from "../../actions";

export default async function NewProjectPage() {
  const [companies, staff] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "INTERNAL"] }, deactivatedAt: null },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-lg font-semibold text-gray-900">New Project</h1>
      <p className="mt-1 text-sm text-gray-500">Create a project and assign it to a client company.</p>

      <form action={createProjectAction} className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <label className="block text-xs font-medium text-gray-600">
          Client
          <select name="companyId" required className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900">
            <option value="">Select a client…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <Field label="Project Code" name="code" placeholder="e.g. NS-2026-020" required />
        <Field label="Project Name" name="name" required />

        <label className="block text-xs font-medium text-gray-600">
          Description
          <textarea name="description" rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date" name="startDate" type="date" />
          <Field label="Due Date" name="dueDate" type="date" />
        </div>

        <fieldset className="block text-xs font-medium text-gray-600">
          <legend className="mb-1">Team Members</legend>
          <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-gray-300 p-3">
            {staff.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm font-normal text-gray-700">
                <input type="checkbox" name="memberIds" value={u.id} className="rounded border-gray-300" />
                {u.name} <span className="text-xs text-gray-400">({u.email})</span>
              </label>
            ))}
            {staff.length === 0 && <p className="text-sm text-gray-400">No staff members yet.</p>}
          </div>
          <p className="mt-1 text-[11px] text-gray-400">Select one or more.</p>
        </fieldset>

        <button className="w-full rounded-md bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-800">
          Create Project
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-medium text-gray-600">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
      />
    </label>
  );
}
