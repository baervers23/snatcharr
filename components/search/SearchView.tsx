"use client";

import { useState, useCallback, useRef } from "react";
import { Search, X, Filter, Loader2 } from "lucide-react";
import { cn, formatBytes, formatAge, CATEGORY_GROUPS } from "@/lib/utils";
import { toast } from "sonner";
import ResultDetailModal from "./ResultDetailModal";
import GrabConfirmModal from "./GrabConfirmModal";
import type { ProwlarrSearchResult } from "@/lib/prowlarr";

interface SearchResult extends ProwlarrSearchResult {
  id: string;
}

export default function SearchView() {
  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [grabTarget, setGrabTarget] = useState<SearchResult | null>(null);
  const [grabbingId, setGrabbingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleCategory = useCallback((ids: number[]) => {
    setSelectedCategories((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      if (allSelected) return prev.filter((c) => !ids.includes(c));
      return [...new Set([...prev, ...ids])];
    });
  }, []);

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
    setSelectedCategories([]);
    inputRef.current?.focus();
  };

  const handleSearch = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!query.trim()) return;

      setLoading(true);
      setSearched(true);

      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (selectedCategories.length) {
          params.set("categories", selectedCategories.join(","));
        }

        const response = await fetch(`/api/search?${params}`);
        const data = (await response.json()) as { results?: SearchResult[]; error?: string };

        if (!response.ok) {
          toast.error(data.error ?? "Search failed");
          setResults([]);
          return;
        }

        setResults((data.results ?? []).map((r, i) => ({ ...r, id: r.guid ?? String(i) })));
      } catch {
        toast.error("Search failed. Please try again.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [query, selectedCategories],
  );

  const handleGrab = async (result: SearchResult) => {
    setGrabTarget(result);
  };

  const confirmGrab = async (result: SearchResult, clientId: string) => {
    setGrabTarget(null);
    setGrabbingId(result.id);
    try {
      const response = await fetch("/api/grabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guid: result.guid,
          downloadUrl: result.downloadUrl,
          title: result.title,
          size: result.size,
          indexer: result.indexer,
          category: result.categories?.[0]?.name,
          categoryId: result.categories?.[0]?.id,
          ageSeconds: result.guid
            ? Math.floor((Date.now() - new Date(result.publishDate).getTime()) / 1000)
            : undefined,
          downloadClientId: clientId,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Grab failed");
        return;
      }

      toast.success(`"${result.title}" sent to download client`);
    } catch {
      toast.error("Grab failed. Please try again.");
    } finally {
      setGrabbingId(null);
    }
  };

  const isCategoryGroupSelected = (ids: number[]) => ids.some((id) => selectedCategories.includes(id));

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              className="nv-input w-full pl-10 pr-10 py-3 text-base"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search NZBs..."
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>
      </form>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Filter className="h-3 w-3" /> Categories:
        </span>
        {CATEGORY_GROUPS.map((group) => {
          const active = isCategoryGroupSelected(group.ids);
          return (
            <button
              key={group.label}
              onClick={() => toggleCategory(group.ids)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:border-primary/50 hover:text-foreground",
              )}
            >
              {group.label}
            </button>
          );
        })}
        {selectedCategories.length > 0 && (
          <button
            onClick={() => setSelectedCategories([])}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Searching indexers...</p>
          </div>
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No results found for &quot;{query}&quot;</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Try different keywords or categories</p>
        </div>
      )}

      {!loading && !searched && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground">Enter a search term to find NZBs</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="nv-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium">{results.length} results</span>
            {selectedCategories.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Filtered by {selectedCategories.length} categor{selectedCategories.length > 1 ? "ies" : "y"}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="nv-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th className="hidden md:table-cell">Category</th>
                  <th className="hidden sm:table-cell">Age</th>
                  <th>Size</th>
                  <th className="hidden lg:table-cell">Grabs</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <ResultRow
                    key={result.id}
                    result={result}
                    onDetail={() => setSelectedResult(result)}
                    onGrab={() => handleGrab(result)}
                    isGrabbing={grabbingId === result.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedResult && (
        <ResultDetailModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
          onGrab={() => {
            setSelectedResult(null);
            handleGrab(selectedResult);
          }}
        />
      )}

      {grabTarget && (
        <GrabConfirmModal
          result={grabTarget}
          onClose={() => setGrabTarget(null)}
          onConfirm={(clientId) => confirmGrab(grabTarget, clientId)}
        />
      )}
    </div>
  );
}

function ResultRow({
  result,
  onDetail,
  onGrab,
  isGrabbing,
}: {
  result: SearchResult;
  onDetail: () => void;
  onGrab: () => void;
  isGrabbing: boolean;
}) {
  const ageSeconds = result.publishDate
    ? Math.floor((Date.now() - new Date(result.publishDate).getTime()) / 1000)
    : 0;

  const category = result.categories?.[0]?.name ?? "—";

  return (
    <tr>
      <td className="max-w-xs lg:max-w-md xl:max-w-lg">
        <div className="flex items-start gap-3">
          {result.posterUrl && (
            <button
              onClick={onDetail}
              className="hidden sm:block shrink-0 w-10 h-10 rounded overflow-hidden bg-muted hover:ring-2 ring-primary/50 transition-all"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.posterUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </button>
          )}
          <div className="min-w-0">
            <button
              onClick={onDetail}
              className="text-left text-sm font-medium text-foreground hover:text-primary line-clamp-2 transition-colors"
            >
              {result.title}
            </button>
          </div>
        </div>
      </td>
      <td className="hidden md:table-cell">
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {category}
        </span>
      </td>
      <td className="hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
        {formatAge(ageSeconds)}
      </td>
      <td className="text-sm text-muted-foreground whitespace-nowrap">
        {result.size ? formatBytes(result.size) : "—"}
      </td>
      <td className="hidden lg:table-cell text-sm text-muted-foreground">
        {result.grabs ?? "—"}
      </td>
      <td className="text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onGrab();
          }}
          disabled={isGrabbing}
          className={cn(
            "px-3 py-1.5 rounded text-xs font-semibold transition-all",
            isGrabbing
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
          )}
        >
          {isGrabbing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Grab"}
        </button>
      </td>
    </tr>
  );
}
