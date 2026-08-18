"use client";

import { useActionState } from "react";
import { createTeamMemberAction } from "../../actions";

export default function NewTeamMemberPage() {
  const [error, formAction, isPending] = useActionState(createTeamMemberAction, undefined);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-lg font-semibold text-gray-900">New Team Member</h1>
      <p className="mt-1 text-sm text-gray-500">
        Creates a login for someone on your team. Internal members only see and work on the projects
        they&apos;re assigned to; Admins can see and manage everything.
      </p>

      <form action={formAction} className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <Field label="Name" name="name" required />
        <Field label="Email (login)" name="email" type="email" required />
        <Field label="Password" name="password" placeholder="Leave blank for default: password123" />

        <label className="block text-xs font-medium text-gray-600">
          Role
          <select name="role" defaultValue="INTERNAL" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900">
            <option value="INTERNAL">Internal (team member — assigned projects only)</option>
            <option value="ADMIN">Admin (full access)</option>
          </select>
        </label>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create Team Member"}
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
