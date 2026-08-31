"use client";

import { useActionState } from "react";
import { createClientContactAction } from "../../../../actions";

export function NewClientContactForm({ companyId }: { companyId: string }) {
  const [error, formAction, isPending] = useActionState(createClientContactAction.bind(null, companyId), undefined);

  return (
    <form action={formAction} className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <Field label="Contact Name" name="contactName" required />
      <Field label="Email (login)" name="email" type="email" required />
      <Field label="Password" name="password" placeholder="Leave blank for default: password123" />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
      >
        {isPending ? "Creating…" : "Add Contact"}
      </button>
    </form>
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
