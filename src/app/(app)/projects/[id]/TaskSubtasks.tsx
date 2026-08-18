"use client";

import { useState } from "react";
import { addSubtaskAction, cycleSubtaskStatusAction, deleteSubtaskAction } from "./actions";

type Subtask = { id: string; name: string; status: "TODO" | "IN_PROGRESS" | "DONE" };

const STATUS_LABEL: Record<Subtask["status"], string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

const STATUS_CLASS: Record<Subtask["status"], string> = {
  TODO: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  DONE: "bg-green-50 text-green-700",
};

export function TaskSubtasks({
  projectId,
  taskId,
  subtasks,
}: {
  projectId: string;
  taskId: string;
  subtasks: Subtask[];
}) {
  const [open, setOpen] = useState(subtasks.length > 0);
  const doneCount = subtasks.filter((s) => s.status === "DONE").length;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] font-medium text-gray-500 hover:text-gray-800"
      >
        {open ? "▾" : "▸"} Subtasks{subtasks.length > 0 ? ` (${doneCount}/${subtasks.length})` : ""}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5 rounded-md border border-gray-100 bg-gray-50 p-3">
          {subtasks.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2">
              <span className={`text-xs ${s.status === "DONE" ? "text-gray-400 line-through" : "text-gray-700"}`}>
                {s.name}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <form action={cycleSubtaskStatusAction.bind(null, projectId, taskId, s.id)}>
                  <button className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_CLASS[s.status]}`}>
                    {STATUS_LABEL[s.status]}
                  </button>
                </form>
                <form action={deleteSubtaskAction.bind(null, projectId, taskId, s.id)}>
                  <button className="text-[11px] font-medium text-red-500 hover:underline">Remove</button>
                </form>
              </div>
            </div>
          ))}
          {subtasks.length === 0 && <p className="text-xs text-gray-400">No subtasks yet.</p>}

          <form action={addSubtaskAction.bind(null, projectId, taskId)} className="mt-2 flex gap-2">
            <input
              name="name"
              placeholder="Add a subtask"
              required
              className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
            />
            <button className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800">
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
