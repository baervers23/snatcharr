"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, RefreshCw, Eye, EyeOff, Archive, ExternalLink, Clock, Loader2, CheckCircle2, XCircle, PauseCircle, AlertCircle } from "lucide-react";
import { cn, formatBytes, formatSpeed } from "@/lib/utils";
import { toast } from "sonner";
import type { Grab } from "@/lib/db/schema";
import { formatDistanceToNow } from "date-fns";

interface GrabWithUser extends Grab {
  user?: { username: string };
}

const STATUS_ICONS = {
  queued: <Clock className="h-4 w-4 text-muted-foreground" />,
  downloading: <Download className="h-4 w-4 text-primary animate-bounce" />,
  paused: <PauseCircle className="h-4 w-4 text-yellow-400" />,
  failed: <XCircle className="h-4 w-4 text-red-400" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-400" />,
  expired: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
};

const STATUS_LABELS = {
  queued: "Queued",
  downloading: "Downloading",
  paused: "Paused",
  failed: "Failed",
  completed: "Completed",
  expired: "Expired",
};

export default function GrabsView() {
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
        if (prev.some((g) => g.status === "downloading" || g.status === "queued")) {
          fetchGrabs(true);
        }
        return prev;
      });
    }, 10_000);
    return () => clearInterval(interval);
  }, [fetchGrabs]);

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

  const active = grabList.filter((g) => ["queued", "downloading", "paused"].includes(g.status ?? ""));
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
            <GrabSection title="Active" icon={<Download className="h-4 w-4 text-primary" />} items={active} onToggleVisibility={toggleVisibility} />
          )}
          {completed.length > 0 && (
            <GrabSection title="Completed" icon={<CheckCircle2 className="h-4 w-4 text-green-400" />} items={completed} onToggleVisibility={toggleVisibility} />
          )}
          {failed.length > 0 && (
            <GrabSection title="Failed / Expired" icon={<XCircle className="h-4 w-4 text-red-400" />} items={failed} onToggleVisibility={toggleVisibility} />
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
}: {
  title: string;
  icon: React.ReactNode;
  items: GrabWithUser[];
  onToggleVisibility: (g: GrabWithUser) => void;
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
          <GrabRow key={grab.id} grab={grab} onToggleVisibility={onToggleVisibility} />
        ))}
      </div>
    </div>
  );
}

function GrabRow({
  grab,
  onToggleVisibility,
}: {
  grab: GrabWithUser;
  onToggleVisibility: (g: GrabWithUser) => void;
}) {
  const status = grab.status ?? "queued";
  const progress = (grab.progress ?? 0) * 100;

  return (
    <div className="p-4 hover:bg-accent/20 transition-colors">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">{STATUS_ICONS[status as keyof typeof STATUS_ICONS]}</div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground line-clamp-1">{grab.title}</p>
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full shrink-0",
                status === "completed" && "bg-green-500/15 text-green-400",
                status === "downloading" && "bg-primary/15 text-primary",
                status === "queued" && "bg-muted text-muted-foreground",
                status === "failed" && "bg-red-500/15 text-red-400",
                status === "expired" && "bg-muted text-muted-foreground",
                status === "paused" && "bg-yellow-500/15 text-yellow-400",
              )}
            >
              {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
            </span>
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

          {/* Progress bar */}
          {(status === "downloading" || status === "queued") && (
            <div className="space-y-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{progress.toFixed(1)}%</span>
                {grab.speed && grab.speed > 0 && <span>{formatSpeed(grab.speed)}</span>}
                {grab.downloadedBytes && grab.sizeBytes && (
                  <span>
                    {formatBytes(grab.downloadedBytes)} / {formatBytes(grab.sizeBytes)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Completed actions */}
          {status === "completed" && (
            <div className="flex items-center gap-3 pt-1">
              {grab.downloadToken && grab.downloadTokenExpiresAt && (
                <>
                  <a
                    href={`/api/grabs/${grab.id}/download?token=${grab.downloadToken}`}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Archive className="h-3 w-3" />
                    Download Archive
                  </a>
                  {grab.expiresAt && (
                    <span className="text-xs text-muted-foreground">
                      Expires{" "}
                      {formatDistanceToNow(new Date(grab.expiresAt), { addSuffix: true })}
                    </span>
                  )}
                </>
              )}

              <button
                onClick={() => onToggleVisibility(grab)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                title={grab.isPublic ? "Make private" : "Make public"}
              >
                {grab.isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {grab.isPublic ? "Public" : "Private"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
