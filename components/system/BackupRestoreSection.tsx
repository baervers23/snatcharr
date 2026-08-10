"use client";

import { Download, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function BackupRestoreSection({ canDownloadBackup }: { canDownloadBackup: boolean }) {
  const [restoring, setRestoring] = useState(false);

  async function exportBackup() {
    try {
      const res = await fetch("/api/settings/backup");
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `snatcharr-settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Settings backup downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function restoreBackup(file: File) {
    if (
      !confirm(
        "Restore all settings from backup? Indexers, download clients, and apps will be replaced.",
      )
    ) {
      return;
    }
    setRestoring(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const res = await fetch("/api/settings/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Restore failed");
      toast.success("Settings restored");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="nv-card p-5 space-y-3">
      <h3 className="text-sm font-semibold">Backup &amp; restore</h3>
      <p className="text-xs text-muted-foreground">
        Export all settings, indexers, download clients, and additional apps to a JSON file.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {canDownloadBackup ? (
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition-colors"
            onClick={exportBackup}
          >
            <Download className="h-4 w-4" />
            Export backup
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only the primary administrator (user ID 1) can download backups.
          </p>
        )}
        <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer">
          <Upload className="h-4 w-4" />
          {restoring ? "Restoring…" : "Restore backup"}
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            disabled={restoring}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void restoreBackup(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}
