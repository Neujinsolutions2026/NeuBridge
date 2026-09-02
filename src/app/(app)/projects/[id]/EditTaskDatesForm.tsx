"use client";

import { useState } from "react";
import { updateTaskDatesAction } from "./actions";

function toDateInputValue(date: Date | null) {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}

export function EditTaskDatesForm({
  projectId,
  taskId,
  startDate,
  dueDate,
}: {
  projectId: string;
  taskId: string;
  startDate: Date | null;
  dueDate: Date | null;
}) {
  const [open, setOpen] = useState(false);
  const [unscheduled, setUnscheduled] = useState(!startDate && !dueDate);

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] font-medium text-gray-500 hover:text-gray-800"
      >
        {open ? "▾" : "▸"} Edit Dates
      </button>

      {open && (
        <form
          action={updateTaskDatesAction.bind(null, projectId, taskId)}
          className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-gray-100 bg-gray-50 p-3"
        >
          <label className="text-xs text-gray-500">
            Start {!unscheduled && <span className="text-red-600">*</span>}
            <input
              type="date"
              name="startDate"
              defaultValue={toDateInputValue(startDate)}
              required={!unscheduled}
              disabled={unscheduled}
              className="mt-1 block rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs disabled:bg-gray-100 disabled:text-gray-400"
            />
          </label>
          <label className="text-xs text-gray-500">
            Due {!unscheduled && <span className="text-red-600">*</span>}
            <input
              type="date"
              name="dueDate"
              defaultValue={toDateInputValue(dueDate)}
              required={!unscheduled}
              disabled={unscheduled}
              className="mt-1 block rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs disabled:bg-gray-100 disabled:text-gray-400"
            />
          </label>
          <label className="flex items-center gap-1.5 pb-1.5 text-xs text-gray-500">
            <input
              type="checkbox"
              name="unscheduled"
              checked={unscheduled}
              onChange={(e) => setUnscheduled(e.target.checked)}
              className="rounded border-gray-300"
            />
            Unscheduled
          </label>
          <button className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800">
            Save
          </button>
        </form>
      )}
    </div>
  );
}
