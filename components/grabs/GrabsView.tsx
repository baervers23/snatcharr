"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, RefreshCw, Eye, EyeOff, Archive, Clock, Loader2, CheckCircle2, XCircle, PauseCircle, AlertCircle, Key, FileDown, FolderOpen, Trash2 } from "lucide-react";
import { cn, formatBytes, formatSpeed } from "@/lib/utils";
import { toast } from "sonner";
import type { Grab } from "@/lib/db/schema";
import { formatDistanceToNow } from "date-fns";

interface GrabFileEntry {
  index: number;
  relativePath: string;
  name: string;
  sizeBytes: number;
}

interface GrabWithUser extends Grab {
  user?: { username: string };
}

const STATUS_ICONS = {
  queued: <Clock className="h-4 w-4 text-muted-foreground" />,
  downloading: <Download className="h-4 w-4 text-primary animate-bounce" />,
  processing: <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />,
  paused: <PauseCircle className="h-4 w-4 text-yellow-400" />,
  failed: <XCircle className="h-4 w-4 text-red-400" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-400" />,
  expired: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
};

const STATUS_LABELS = {
  queued: "Queued",
  downloading: "Downloading",
  processing: "Processing",
  paused: "Paused",
  failed: "Failed",
  completed: "Completed",
  expired: "Expired",
};

export default function GrabsView({ isAdmin = false, userId }: { isAdmin?: boolean; userId: string }) {
  const [grabList, setGrabList] = useState<GrabWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGrabs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const response = await fetch("/api/grabs");
      const data = (await response.json()) as { grabs?: GrabWithUser[] };
      setGrabList(data.grabs ?? []);
    } catch {
      if (!silent) toast.error("Failed to load grabs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGrabs();
    // Auto-refresh every 10 seconds if any are downloading
    const interval = setInterval(() => {
      setGrabList((prev) => {
        if (
          prev.some((g) =>
            ["downloading", "processing", "queued"].includes(g.status ?? ""),
          )
        ) {
          fetchGrabs(true);
        }
        return prev;
      });
    }, 10_000);
    return () => clearInterval(interval);
  }, [fetchGrabs]);

  async function deleteGrab(grab: GrabWithUser) {
    const canDelete = isAdmin || grab.userId === userId;
    if (!canDelete) return;
    if (!confirm(`Delete grab "${grab.title}"?`)) return;
    try {
      const response = await fetch(`/api/grabs/${grab.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setGrabList((prev) => prev.filter((g) => g.id !== grab.id));
      toast.success("Grab deleted");
    } catch {
      toast.error("Failed to delete grab");
    }
  }

  async function toggleVisibility(grab: GrabWithUser) {
    try {
      const response = await fetch(`/api/grabs/${grab.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !grab.isPublic }),
      });
      if (!response.ok) throw new Error();
      setGrabList((prev) =>
        prev.map((g) => (g.id === grab.id ? { ...g, isPublic: !g.isPublic } : g)),
      );
    } catch {
      toast.error("Failed to update visibility");
    }
  }

  const active = grabList.filter((g) =>
    ["queued", "downloading", "processing", "paused"].includes(g.status ?? ""),
  );
  const completed = grabList.filter((g) => g.status === "completed");
  const failed = grabList.filter((g) => g.status === "failed" || g.status === "expired");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Grabs & Downloads</h1>
        <button
          onClick={() => fetchGrabs(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground nv-card hover:bg-accent/30 transition-colors"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {grabList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Download className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground">No grabs yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Search for content and click &quot;Grab&quot; to start downloading
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <GrabSection title="Active" icon={<Download className="h-4 w-4 text-primary" />} items={active} onToggleVisibility={toggleVisibility} onDelete={deleteGrab} isAdmin={isAdmin} userId={userId} />
          )}
          {completed.length > 0 && (
            <GrabSection title="Completed" icon={<CheckCircle2 className="h-4 w-4 text-green-400" />} items={completed} onToggleVisibility={toggleVisibility} onDelete={deleteGrab} isAdmin={isAdmin} userId={userId} />
          )}
          {failed.length > 0 && (
            <GrabSection title="Failed / Expired" icon={<XCircle className="h-4 w-4 text-red-400" />} items={failed} onToggleVisibility={toggleVisibility} onDelete={deleteGrab} isAdmin={isAdmin} userId={userId} />
          )}
        </div>
      )}
    </div>
  );
}

function GrabSection({
  title,
  icon,
  items,
  onToggleVisibility,
  onDelete,
  isAdmin,
  userId,
}: {
  title: string;
  icon: React.ReactNode;
  items: GrabWithUser[];
  onToggleVisibility: (g: GrabWithUser) => void;
  onDelete: (g: GrabWithUser) => void;
  isAdmin: boolean;
  userId: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {icon}
        {title}
        <span className="font-normal">({items.length})</span>
      </div>
      <div className="nv-card divide-y divide-border overflow-hidden">
        {items.map((grab) => (
          <GrabRow key={grab.id} grab={grab} onToggleVisibility={onToggleVisibility} onDelete={onDelete} canDelete={isAdmin || grab.userId === userId} />
        ))}
      </div>
    </div>
  );
}

function GrabRow({
  grab,
  onToggleVisibility,
  onDelete,
  canDelete,
}: {
  grab: GrabWithUser;
  onToggleVisibility: (g: GrabWithUser) => void;
  onDelete: (g: GrabWithUser) => void;
  canDelete: boolean;
}) {
  const status = grab.status ?? "queued";
  const progress = (grab.progress ?? 0) * 100;

  const [showKey, setShowKey] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [files, setFiles] = useState<GrabFileEntry[] | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  async function toggleFiles() {
    const next = !showFiles;
    setShowFiles(next);
    if (next) {
      setLoadingFiles(true);
      setFilesError(null);
      try {
        const res = await fetch(`/api/grabs/${grab.id}/files`, { cache: "no-store" });
        const data = (await res.json()) as { files?: GrabFileEntry[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load files");
        setFiles(data.files ?? []);
        if (data.error) setFilesError(data.error);
      } catch (err) {
        setFilesError(err instanceof Error ? err.message : "Failed to load files");
        setFiles([]);
      } finally {
        setLoadingFiles(false);
      }
    }
  }

  return (
    <div className="p-4 hover:bg-accent/20 transition-colors">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">{STATUS_ICONS[status as keyof typeof STATUS_ICONS]}</div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground line-clamp-1 flex items-center gap-2">
              <span className="truncate">{grab.title}</span>
              {grab.source === "manual" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  Manual
                </span>
              )}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {grab.nzbPassword && (
                <div className="relative">
                  <button
                    onClick={() => setShowKey((v) => !v)}
                    className="p-1 rounded text-yellow-400/80 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
                    title="Show NZB password"
                  >
                    <Key className="h-3.5 w-3.5" />
                  </button>
                  {showKey && (
                    <div className="absolute right-0 top-full mt-1 z-30 bg-popover border border-border rounded-md shadow-lg p-2 min-w-44">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">NZB Password</p>
                      <code className="block text-xs font-mono text-foreground break-all select-all bg-muted px-2 py-1 rounded">
                        {grab.nzbPassword}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(grab.nzbPassword ?? "");
                          toast.success("Password copied");
                        }}
                        className="mt-1.5 text-xs text-primary hover:underline"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              )}
              {canDelete && (
                <button
                  onClick={() => onDelete(grab)}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete grab"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  status === "completed" && "bg-green-500/15 text-green-400",
                  status === "downloading" && "bg-primary/15 text-primary",
                  status === "processing" && "bg-amber-500/15 text-amber-400",
                  status === "queued" && "bg-muted text-muted-foreground",
                  status === "failed" && "bg-red-500/15 text-red-400",
                  status === "expired" && "bg-muted text-muted-foreground",
                  status === "paused" && "bg-yellow-500/15 text-yellow-400",
                )}
              >
                {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
              </span>
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {grab.sizeBytes && <span>{formatBytes(grab.sizeBytes)}</span>}
            {grab.category && (
              <span className="bg-muted px-1.5 py-0.5 rounded">{grab.category}</span>
            )}
            {grab.user?.username && <span>by {grab.user.username}</span>}
            <span>{formatDistanceToNow(new Date(grab.queuedAt ?? Date.now()))} ago</span>
          </div>

          {grab.downloadClientMessage && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs",
                grab.downloadClientAlert === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300",
              )}
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div className="min-w-0">
                {grab.downloadClientStatus && (
                  <p className="font-medium mb-0.5">{grab.downloadClientStatus}</p>
                )}
                <p className="break-words">{grab.downloadClientMessage}</p>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {(status === "downloading" || status === "queued" || status === "processing") && (
            <div className="space-y-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    status === "processing" ? "bg-amber-400 animate-pulse" : "bg-primary",
                  )}
                  style={{ width: `${status === "processing" ? 100 : progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {status === "processing"
                    ? "Moving files to download folder…"
                    : `${progress.toFixed(1)}%`}
                </span>
                {status === "downloading" && grab.speed && grab.speed > 0 && (
                  <span>{formatSpeed(grab.speed)}</span>
                )}
                {status !== "processing" && grab.downloadedBytes && grab.sizeBytes && (
                  <span>
                    {formatBytes(grab.downloadedBytes)} / {formatBytes(grab.sizeBytes)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Completed actions */}
          {status === "completed" && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={toggleFiles}
                  className="flex items-center gap-1.5 text-xs text-foreground hover:text-primary transition-colors"
                >
                  <FolderOpen className="h-3 w-3" />
                  {showFiles ? "Hide files" : "Browse files"}
                </button>
                <a
                  href={`/api/download?id=${grab.id}`}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Archive className="h-3 w-3" />
                  Zip all &amp; download
                </a>
                {grab.expiresAt && (
                  <span className="text-xs text-muted-foreground">
                    Expires {formatDistanceToNow(new Date(grab.expiresAt), { addSuffix: true })}
                  </span>
                )}

                <button
                  onClick={() => onToggleVisibility(grab)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                  title={grab.isPublic ? "Hide from other users" : "Make visible to other users"}
                >
                  {grab.isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {grab.isPublic ? "Public" : "Hidden"}
                </button>
              </div>

              {showFiles && (
                <div className="rounded-md border border-border bg-background/50 divide-y divide-border">
                  {loadingFiles ? (
                    <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading files…
                    </div>
                  ) : filesError ? (
                    <div className="p-3 text-xs text-yellow-400">{filesError}</div>
                  ) : files && files.length > 0 ? (
                    files.map((f) => (
                      <a
                        key={f.index}
                        href={`/api/download?id=${grab.id}&file=${f.index}`}
                        className="flex items-center gap-2 p-2.5 text-xs hover:bg-accent/30 transition-colors"
                      >
                        <FileDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate text-foreground">{f.relativePath}</span>
                        <span className="text-muted-foreground shrink-0">{formatBytes(f.sizeBytes)}</span>
                      </a>
                    ))
                  ) : (
                    <div className="p-3 text-xs text-muted-foreground">No files found.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
