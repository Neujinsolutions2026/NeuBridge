"use client";

import { useState } from "react";
import { setTaskDelayReasonAction } from "./actions";

type GanttTask = {
  id: string;
  name: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  startDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  delayReason: string | null;
};

const STATUS_BAR_COLOR: Record<GanttTask["status"], string> = {
  TODO: "bg-gray-400",
  IN_PROGRESS: "bg-blue-500",
  DONE: "bg-green-500",
};

const LABEL_COL = "w-40";
const TRACK_GAP = "gap-3";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function GanttChart({
  tasks,
  projectId,
  staff,
}: {
  tasks: GanttTask[];
  projectId: string;
  staff: boolean;
}) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const today = startOfDay(new Date());

  // A task needs a due date to be placed on the timeline at all. If it has
  // no start date, default one to when it was created rather than hiding it.
  const plotted = tasks
    .filter((t) => t.dueDate)
    .map((t) => {
      const due = startOfDay(t.dueDate as Date);
      let start = startOfDay(t.startDate ?? t.createdAt);
      if (start > due) start = due;
      const overdue = t.status !== "DONE" && due < today;
      return { ...t, start, due, overdue };
    });
  const unscheduled = tasks.filter((t) => !t.dueDate);

  if (plotted.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Gantt Chart</h2>
        <p className="mt-2 text-sm text-gray-400">
          Add a due date to at least one task to see it plotted on a timeline here.
        </p>
      </div>
    );
  }

  let rangeStart = new Date(Math.min(...plotted.map((t) => t.start.getTime())));
  let rangeEnd = new Date(Math.max(...plotted.map((t) => t.due.getTime())));
  // Pad a day on each side so bars never touch the very edge of the chart.
  rangeStart = new Date(rangeStart.getTime() - 24 * 60 * 60 * 1000);
  rangeEnd = new Date(rangeEnd.getTime() + 24 * 60 * 60 * 1000);
  const totalMs = rangeEnd.getTime() - rangeStart.getTime();
  const pct = (date: Date) => ((date.getTime() - rangeStart.getTime()) / totalMs) * 100;

  const TICK_COUNT = 6;
  const ticks = Array.from({ length: TICK_COUNT }, (_, i) =>
    new Date(rangeStart.getTime() + (totalMs * i) / (TICK_COUNT - 1))
  );
  const todayPct = today >= rangeStart && today <= rangeEnd ? pct(today) : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Gantt Chart</h2>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-400" /> To Do</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500" /> In Progress</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-500" /> Done</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" /> Delayed</span>
          <span className="flex items-center gap-1"><span className="h-2 w-0.5 bg-amber-400" /> Today</span>
        </div>
      </div>

      {/* Date scale header, aligned to the same track column as the rows below */}
      <div className={`mt-4 flex ${TRACK_GAP}`}>
        <div className={`${LABEL_COL} shrink-0`} />
        <div className="relative h-4 flex-1">
          {ticks.map((tick, i) => (
            <span
              key={i}
              className="absolute top-0 -translate-x-1/2 text-[10px] text-gray-400 first:translate-x-0 last:-translate-x-full"
              style={{ left: `${pct(tick)}%` }}
            >
              {formatDate(tick)}
            </span>
          ))}
        </div>
      </div>

      {/* Rows, with a shared gridline overlay behind them so every bar lines
          up against a labeled date. */}
      <div className="relative mt-2">
        <div
          className="pointer-events-none absolute inset-y-0 right-0"
          style={{ left: "calc(10rem + 0.75rem)" }}
        >
          {ticks.map((tick, i) => (
            <div
              key={i}
              className="absolute inset-y-0 w-px bg-gray-100"
              style={{ left: `${pct(tick)}%` }}
            />
          ))}
          {todayPct !== null && (
            <div className="absolute inset-y-0 w-px bg-amber-400" style={{ left: `${todayPct}%` }} />
          )}
        </div>

        <div className="space-y-2">
          {plotted.map((t) => {
            const leftPct = pct(t.start);
            const widthPct = Math.max(pct(t.due) - pct(t.start), 2);
            const isOpen = openTaskId === t.id;

            return (
              <div key={t.id}>
                <div className={`flex items-center ${TRACK_GAP}`}>
                  <p className={`${LABEL_COL} shrink-0 truncate text-xs text-gray-700`} title={t.name}>
                    {t.name}
                    {t.overdue && <span className="ml-1.5 text-[10px] font-medium text-red-600">Delayed</span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => t.overdue && setOpenTaskId(isOpen ? null : t.id)}
                    title={`${formatDate(t.start)} → ${formatDate(t.due)}`}
                    className={`relative h-5 flex-1 rounded bg-gray-50 ${t.overdue ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 rounded ${t.overdue ? "bg-red-500" : STATUS_BAR_COLOR[t.status]}`}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    />
                  </button>
                </div>

                {isOpen && t.overdue && (
                  <div className="ml-43 mt-1.5 rounded-md border border-red-100 bg-red-50 p-3">
                    <p className="text-xs font-semibold text-red-800">
                      Why is &quot;{t.name}&quot; delayed?
                    </p>
                    {staff ? (
                      <form action={setTaskDelayReasonAction.bind(null, projectId, t.id)} className="mt-2 flex flex-wrap gap-2">
                        <textarea
                          name="delayReason"
                          defaultValue={t.delayReason ?? ""}
                          rows={2}
                          placeholder="Explain the delay — the client will see this."
                          className="flex-1 rounded-md border border-red-200 bg-white px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
                        />
                        <button className="self-start rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800">
                          Save
                        </button>
                      </form>
                    ) : (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-red-900">
                        {t.delayReason || "No reason has been provided yet."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {unscheduled.length > 0 && (
        <p className="mt-3 text-[11px] text-gray-400">
          {unscheduled.length} task{unscheduled.length === 1 ? "" : "s"} without a due date not shown here:{" "}
          {unscheduled.map((t) => t.name).join(", ")}
        </p>
      )}
    </div>
  );
}
