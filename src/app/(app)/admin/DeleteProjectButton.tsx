"use client";

import { deleteProjectAction } from "./actions";

export function DeleteProjectButton({ projectId, projectLabel }: { projectId: string; projectLabel: string }) {
  return (
    <form
      action={deleteProjectAction.bind(null, projectId)}
      onSubmit={(e) => {
        if (!confirm(`Delete "${projectLabel}"? This permanently removes its tasks, documents, messages, and history. This can't be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <button className="text-xs font-medium text-red-600 hover:underline">Delete</button>
    </form>
  );
}
