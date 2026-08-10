"use client";

import { X, Calendar, HardDrive, Download, Tag } from "lucide-react";
import { formatBytes, formatAge } from "@/lib/utils";
import type { ProwlarrSearchResult } from "@/lib/prowlarr";

interface Props {
  result: ProwlarrSearchResult;
  showIndexer?: boolean;
  onClose: () => void;
  onGrab: () => void;
}

export default function ResultDetailModal({ result, showIndexer = false, onClose, onGrab }: Props) {
  const ageSeconds = result.publishDate
    ? Math.floor((Date.now() - new Date(result.publishDate).getTime()) / 1000)
    : 0;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-4 border-b border-border">
          <h2 className="flex-1 text-base font-semibold text-foreground leading-snug break-words pr-2">
            {result.title}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row min-h-[280px]">
          <div className="sm:w-1/3 bg-muted/30 border-b sm:border-b-0 sm:border-r border-border flex items-center justify-center p-6 min-h-[220px]">
            {result.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.posterUrl}
                alt=""
                className="max-h-72 w-full object-contain rounded-lg shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="text-sm text-muted-foreground text-center">No cover available</div>
            )}
          </div>

          <div className="sm:w-2/3 p-5 space-y-4">
            {result.categories?.length > 0 && (
              <div className="flex flex-wrap gap-1">
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

            <div className="grid grid-cols-2 gap-4">
              <MetaStat icon={Calendar} label="Age" value={formatAge(ageSeconds)} />
              <MetaStat icon={HardDrive} label="Size" value={result.size ? formatBytes(result.size) : "—"} />
              <MetaStat icon={Download} label={showIndexer ? "Indexer Grabs" : "Grabs"} value={String(result.grabs ?? 0)} />
              {showIndexer && result.indexer && (
                <MetaStat icon={Tag} label="Indexer" value={result.indexer} />
              )}
            </div>

            {result.description && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Description
                </h3>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {result.description}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 flex items-center justify-between border-t border-border">
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
