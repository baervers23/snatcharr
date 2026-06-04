"use client";

import { X, Calendar, HardDrive, Download, Tag } from "lucide-react";
import { formatBytes, formatAge } from "@/lib/utils";
import type { ProwlarrSearchResult } from "@/lib/prowlarr";

interface Props {
  result: ProwlarrSearchResult;
  onClose: () => void;
  onGrab: () => void;
}

export default function ResultDetailModal({ result, onClose, onGrab }: Props) {
  const ageSeconds = result.publishDate
    ? Math.floor((Date.now() - new Date(result.publishDate).getTime()) / 1000)
    : 0;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-border">
          {result.posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.posterUrl}
              alt=""
              className="w-20 h-20 rounded object-cover shrink-0 bg-muted"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground leading-snug break-words">
              {result.title}
            </h2>
            {result.categories?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {result.categories.map((c) => (
                  <span
                    key={c.id}
                    className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Metadata grid */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-border">
          <MetaStat icon={Calendar} label="Age" value={formatAge(ageSeconds)} />
          <MetaStat icon={HardDrive} label="Size" value={result.size ? formatBytes(result.size) : "—"} />
          <MetaStat icon={Download} label="Grabs" value={String(result.grabs ?? 0)} />
          <MetaStat icon={Tag} label="Indexer" value={result.indexer ?? "—"} />
        </div>

        {/* Description */}
        {result.description && (
          <div className="p-5 border-b border-border">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Description
            </h3>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {result.description}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="p-5 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
          <button
            onClick={onGrab}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Download className="h-4 w-4" />
            Grab this NZB
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
