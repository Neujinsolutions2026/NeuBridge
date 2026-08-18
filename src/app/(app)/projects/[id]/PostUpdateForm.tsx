"use client";

import { useState } from "react";
import { postUpdateAction } from "./actions";

function UpdateTextarea({ name, label }: { name: string; label: string }) {
  return (
    <label className="block text-xs text-gray-500">
      {label}
      <textarea name={name} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
    </label>
  );
}

export function PostUpdateForm({
  projectId,
  progress,
  status,
}: {
  projectId: string;
  progress: number;
  status: string;
}) {
  const [selectedStatus, setSelectedStatus] = useState(status);

  return (
    <form action={postUpdateAction.bind(null, projectId)} className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">Post Weekly Update</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UpdateTextarea name="completed" label="Completed" />
        <UpdateTextarea name="inProgress" label="In Progress" />
        <UpdateTextarea name="nextSteps" label="Next Steps" />
        <UpdateTextarea name="risks" label="Risks / Issues" />
      </div>

      {selectedStatus === "ON_HOLD" && (
        <label className="mt-3 block text-xs text-gray-600">
          Justification for Hold <span className="text-red-600">*</span>
          <textarea
            name="holdReason"
            required
            rows={3}
            placeholder="Explain why the project is being put on hold — the client will see this."
            className="mt-1 w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
          />
        </label>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="text-xs text-gray-500">
          Progress: <span className="font-medium text-gray-900">{progress}%</span>{" "}
          <span className="text-gray-400">(calculated automatically from task completion)</span>
        </p>
        <label className="text-xs text-gray-500">
          Status
          <select
            name="status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="ml-2 rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="OVERDUE">Overdue</option>
          </select>
        </label>
        <button className="ml-auto rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800">
          Publish Update
        </button>
      </div>
    </form>
  );
}
