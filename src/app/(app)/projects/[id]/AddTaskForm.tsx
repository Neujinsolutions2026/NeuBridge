"use client";

import { useState } from "react";
import { createTaskAction } from "./actions";

export function AddTaskForm({ projectId }: { projectId: string }) {
  const [unscheduled, setUnscheduled] = useState(false);

  return (
    <form action={createTaskAction.bind(null, projectId)} className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex-1">
        <label className="block text-xs text-gray-500">
          Task name
          <input name="name" placeholder="New task name" required className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="text-xs text-gray-500">
        Start {!unscheduled && <span className="text-red-600">*</span>}
        <input
          type="date"
          name="startDate"
          required={!unscheduled}
          disabled={unscheduled}
          className="mt-1 block rounded-md border border-gray-300 px-2 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
        />
      </label>
      <label className="text-xs text-gray-500">
        Due {!unscheduled && <span className="text-red-600">*</span>}
        <input
          type="date"
          name="dueDate"
          required={!unscheduled}
          disabled={unscheduled}
          className="mt-1 block rounded-md border border-gray-300 px-2 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
        />
      </label>
      <label className="flex items-center gap-1.5 pb-2 text-xs text-gray-500">
        <input
          type="checkbox"
          name="unscheduled"
          checked={unscheduled}
          onChange={(e) => setUnscheduled(e.target.checked)}
          className="rounded border-gray-300"
        />
        Unscheduled (no dates yet)
      </label>
      <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Add Task</button>
    </form>
  );
}
