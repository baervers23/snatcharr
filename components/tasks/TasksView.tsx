"use client";

import type { AppSettings, BackgroundTask, TaskIntervalUnit } from "@/lib/db/settings-shared";
import {
  DEFAULT_BACKGROUND_TASKS,
  formatTaskInterval,
  intervalPartsToMs,
  msToIntervalParts,
} from "@/lib/db/settings-shared";
import { cn } from "@/lib/utils";
import { Loader2, Play, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  settings: Partial<AppSettings>;
  embedded?: boolean;
}

export default function TasksView({ settings: initialSettings, embedded = false }: Props) {
  const [tasks, setTasks] = useState<BackgroundTask[]>(
    Array.isArray(initialSettings.backgroundTasks)
      ? initialSettings.backgroundTasks
      : DEFAULT_BACKGROUND_TASKS,
  );
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  function updateTask(id: string, patch: Partial<BackgroundTask>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function updateInterval(id: string, amount: number, unit: TaskIntervalUnit) {
    updateTask(id, { intervalMs: intervalPartsToMs(amount, unit) });
  }

  async function runTask(id: string) {
    setRunningId(id);
    try {
      const response = await fetch(`/api/tasks/${id}/run`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { error?: string; lastRunAt?: string };
      if (!response.ok) throw new Error(data.error ?? "Run failed");
      if (data.lastRunAt) {
        updateTask(id, { lastRunAt: data.lastRunAt });
      }
      toast.success("Task completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run task");
    } finally {
      setRunningId(null);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backgroundTasks: tasks }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Save failed");
      toast.success("Tasks saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save tasks");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("space-y-4", !embedded && "max-w-3xl mx-auto space-y-6")}>
      {!embedded && (
        <div>
          <h1 className="text-xl font-semibold">Background Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scheduled jobs that run while Snatcharr is running.
          </p>
        </div>
      )}

      {embedded && (
        <p className="text-sm text-muted-foreground">
          Scheduled jobs that run while Snatcharr is running. Changes take effect immediately.
        </p>
      )}

      <div className="nv-card p-5 space-y-4">
        {embedded && <h2 className="text-base font-semibold">Background Tasks</h2>}

        {tasks.map((task) => {
          const { amount, unit } = msToIntervalParts(task.intervalMs);
          const isRunning = runningId === task.id;
          return (
            <div key={task.id} className="p-4 border border-border rounded-md space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{task.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                  {task.lastRunAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last run: {new Date(task.lastRunAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => runTask(task.id)}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs border border-border rounded hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    Run
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTask(task.id, { enabled: !task.enabled })}
                    className={cn("relative w-10 h-5 rounded-full", task.enabled ? "bg-primary" : "bg-muted")}
                    aria-label={task.enabled ? "Disable task" : "Enable task"}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                        task.enabled && "translate-x-5",
                      )}
                    />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Run every</span>
                <input
                  className="nv-input w-20"
                  type="number"
                  min={1}
                  value={amount}
                  disabled={!task.enabled}
                  onChange={(e) => updateInterval(task.id, parseInt(e.target.value) || 1, unit)}
                />
                <select
                  className="nv-input w-28"
                  value={unit}
                  disabled={!task.enabled}
                  onChange={(e) => updateInterval(task.id, amount, e.target.value as TaskIntervalUnit)}
                >
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
                <span className="text-xs text-muted-foreground">({formatTaskInterval(task.intervalMs)})</span>
              </div>
            </div>
          );
        })}

        <div className="flex justify-end pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
