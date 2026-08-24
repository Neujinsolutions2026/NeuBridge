"use client";

import { useActionState, useRef, useEffect } from "react";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = { status: "idle" };

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-gray-900">Change Password</h2>
      <form ref={formRef} action={formAction} className="mt-4 space-y-4">
        <Field label="Current Password" name="currentPassword" />
        <Field label="New Password" name="newPassword" />
        <Field label="Confirm New Password" name="confirmPassword" />

        {state.status === "error" && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{state.message}</p>
        )}
        {state.status === "success" && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">{state.message}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {isPending ? "Updating…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, name }: { label: string; name: string }) {
  return (
    <label className="block text-xs font-medium text-gray-600">
      {label}
      <input
        name={name}
        type="password"
        required
        autoComplete={name === "currentPassword" ? "current-password" : "new-password"}
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
      />
    </label>
  );
}
