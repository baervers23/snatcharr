"use client";

import { Download, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/client";

export default function BackupRestoreSection({ canDownloadBackup }: { canDownloadBackup: boolean }) {
  const t = useT();
  const [restoring, setRestoring] = useState(false);

  async function exportBackup() {
    try {
      const res = await fetch("/api/settings/backup");
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? t("system.exportFailed"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `snatcharr-settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("system.exportOk"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("system.exportFailed"));
    }
  }

  async function restoreBackup(file: File) {
    if (
      !confirm(
        t("system.restoreConfirm"),
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
      if (!res.ok) throw new Error(data.error ?? t("system.restoreFailed"));
      toast.success(t("system.restoreOk"));
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("system.restoreFailed"));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="nv-card p-5 space-y-3">
      <h3 className="text-sm font-semibold">{t("system.backupRestore")}</h3>
      <p className="text-xs text-muted-foreground">
        {t("system.exportDesc")}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {canDownloadBackup ? (
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition-colors"
            onClick={exportBackup}
          >
            <Download className="h-4 w-4" />
            {t("system.exportBackup")}
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("system.adminOnlyBackup")}
          </p>
        )}
        <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer">
          <Upload className="h-4 w-4" />
          {restoring ? t("system.restoring") : t("system.restore")}
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
