"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { Search, X, Filter, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { cn, formatBytes, formatAge, CATEGORY_GROUPS, resolveCategoryLabel, type CategoryGroup } from "@/lib/utils";
import { toast } from "sonner";
import ResultDetailModal from "./ResultDetailModal";
import GrabConfirmModal from "./GrabConfirmModal";
import type { ProwlarrSearchResult } from "@/lib/prowlarr";

interface SearchResult extends ProwlarrSearchResult {
  id: string;
}

type SortKey = "title" | "category" | "age" | "size" | "grabs";
type SortDir = "asc" | "desc";

export default function SearchView({
  isAdmin = false,
  canPickDownloader = false,
  enabledCategories,
}: {
  isAdmin?: boolean;
  canPickDownloader?: boolean;
  enabledCategories?: string[];
}) {
  const visibleGroups = enabledCategories
    ? CATEGORY_GROUPS.filter((g) => enabledCategories.includes(g.label))
    : CATEGORY_GROUPS;
  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<CategoryGroup | null>(null);
  const [selectedSubs, setSelectedSubs] = useState<number[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [grabTarget, setGrabTarget] = useState<SearchResult | null>(null);
  const [grabbingId, setGrabbingId] = useState<string | null>(null);
  const [grabbedGuids, setGrabbedGuids] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("grabs");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const inputRef = useRef<HTMLInputElement>(null);

  // Effective category IDs sent to the API: chosen subcategories, else the whole
  // main group, else none (search everything).
  const effectiveCategories =
    selectedSubs.length > 0
      ? selectedSubs
      : selectedGroup
        ? selectedGroup.ids
        : [];

  const toggleSort = useCallback(
    (key: SortKey) => {
      setPage(1);
      if (key === sortKey) {
        // Same column → just flip the direction (single, safe state update).
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir(key === "title" || key === "category" ? "asc" : "desc");
      }
    },
    [sortKey],
  );

  function selectMainGroup(group: CategoryGroup) {
    setPage(1);
    if (selectedGroup?.label === group.label) {
      // Clicking the active group clears the whole filter.
      setSelectedGroup(null);
      setSelectedSubs([]);
    } else {
      // Switching main group always resets the subcategory selection.
      setSelectedGroup(group);
      setSelectedSubs([]);
    }
  }

  function toggleSub(ids: number[]) {
    setPage(1);
    setSelectedSubs((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      if (allSelected) return prev.filter((c) => !ids.includes(c));
      return [...new Set([...prev, ...ids])];
    });
  }

  const sortedResults = useMemo(() => {
    const arr = [...results];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (sortKey) {
        case "title":
          av = a.title?.toLowerCase() ?? "";
          bv = b.title?.toLowerCase() ?? "";
          break;
        case "category":
          av = a.categories?.[0]?.name?.toLowerCase() ?? "";
          bv = b.categories?.[0]?.name?.toLowerCase() ?? "";
          break;
        case "age":
          av = a.publishDate ? new Date(a.publishDate).getTime() : 0;
          bv = b.publishDate ? new Date(b.publishDate).getTime() : 0;
          break;
        case "size":
          av = a.size ?? 0;
          bv = b.size ?? 0;
          break;
        case "grabs":
        default:
          av = a.grabs ?? 0;
          bv = b.grabs ?? 0;
          break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [results, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedResults.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedResults = useMemo(
    () => sortedResults.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sortedResults, currentPage, pageSize],
  );

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
    setSelectedGroup(null);
    setSelectedSubs([]);
    setPage(1);
    inputRef.current?.focus();
  };

  const handleSearch = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!query.trim()) return;

      setLoading(true);
      setSearched(true);
      setPage(1);

      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (effectiveCategories.length) {
          params.set("categories", effectiveCategories.join(","));
        }

        const response = await fetch(`/api/search?${params}`);
        const data = (await response.json()) as { results?: SearchResult[]; pageSize?: number; error?: string };

        if (data.pageSize) setPageSize(data.pageSize);

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
    [query, selectedGroup, selectedSubs],
  );

  const handleGrab = async (result: SearchResult) => {
    if (isAdmin || canPickDownloader) {
      setGrabTarget(result);
    } else {
      await confirmGrab(result);
    }
  };

  const confirmGrab = async (result: SearchResult, clientId?: string) => {
    if (grabbedGuids.has(result.guid) || grabbingId === result.id) {
      toast.info("Already grabbed");
      return;
    }
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
          ...(isAdmin && result.indexer ? { indexer: result.indexer } : {}),
          category: result.categories?.[0]?.name,
          categoryId: result.categories?.[0]?.id,
          ageSeconds: result.guid
            ? Math.floor((Date.now() - new Date(result.publishDate).getTime()) / 1000)
            : undefined,
          ...(clientId ? { downloadClientId: clientId } : {}),
          ...(isAdmin && result.indexerId ? { indexerId: result.indexerId } : {}),
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Grab failed");
        return;
      }

      setGrabbedGuids((prev) => new Set(prev).add(result.guid));
      toast.success(`Grab started — "${result.title}" queued for download`);
    } catch {
      toast.error("Grab failed. Please try again.");
    } finally {
      setGrabbingId(null);
    }
  };

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
              placeholder="What are you looking for?"
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

      {/* Main category chips */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Filter className="h-3 w-3" /> Categories:
        </span>
        {visibleGroups.map((group) => {
          const active = selectedGroup?.label === group.label;
          return (
            <button
              key={group.label}
              onClick={() => selectMainGroup(group)}
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
        {selectedGroup && (
          <button
            onClick={() => {
              setSelectedGroup(null);
              setSelectedSubs([]);
              setPage(1);
            }}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Subcategory chips (multi-select) — shown once a main category is active */}
      {selectedGroup && selectedGroup.subcategories.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center pl-4 border-l-2 border-primary/30">
          <span className="text-xs text-muted-foreground">{selectedGroup.label}:</span>
          {selectedGroup.subcategories.map((sub) => {
            const active = sub.ids.every((id) => selectedSubs.includes(id));
            return (
              <button
                key={sub.label}
                onClick={() => toggleSub(sub.ids)}
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all",
                  active
                    ? "bg-primary/80 text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground",
                )}
              >
                {sub.label}
              </button>
            );
          })}
          {selectedSubs.length > 0 && (
            <button
              onClick={() => {
                setSelectedSubs([]);
                setPage(1);
              }}
              className="px-2 py-0.5 text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{isAdmin ? "Searching indexers..." : "Searching..."}</p>
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
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <span className="text-sm font-medium">
              {results.length} results
              {totalPages > 1 && (
                <span className="text-muted-foreground font-normal"> · page {currentPage}/{totalPages}</span>
              )}
            </span>
            {effectiveCategories.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Filtered by {effectiveCategories.length} categor{effectiveCategories.length > 1 ? "ies" : "y"}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="nv-table">
              <thead>
                <tr>
                  <SortHeader label="Title" sortKey="title" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Category" sortKey="category" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                  <SortHeader label="Age" sortKey="age" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="hidden sm:table-cell" />
                  <SortHeader label="Size" sortKey="size" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  {isAdmin && (
                    <th className="hidden lg:table-cell text-xs text-muted-foreground">Indexer</th>
                  )}
                  <SortHeader
                    label={isAdmin ? "Indexer Grabs" : "Grabs"}
                    sortKey="grabs"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedResults.map((result) => (
                  <ResultRow
                    key={result.id}
                    result={result}
                    showIndexer={isAdmin}
                    onDetail={() => setSelectedResult(result)}
                    onGrab={() => handleGrab(result)}
                    isGrabbing={grabbingId === result.id}
                    alreadyGrabbed={grabbedGuids.has(result.guid)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedResults.length)} of {sortedResults.length}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {selectedResult && (
        <ResultDetailModal
          result={selectedResult}
          showIndexer={isAdmin}
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

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 select-none hover:text-foreground transition-colors",
          active ? "text-foreground font-semibold" : "text-muted-foreground",
        )}
      >
        {label}
        {active &&
          (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

function ResultRow({
  result,
  showIndexer,
  onDetail,
  onGrab,
  isGrabbing,
  alreadyGrabbed,
}: {
  result: SearchResult;
  showIndexer: boolean;
  onDetail: () => void;
  onGrab: () => void;
  isGrabbing: boolean;
  alreadyGrabbed: boolean;
}) {
  const ageSeconds = result.publishDate
    ? Math.floor((Date.now() - new Date(result.publishDate).getTime()) / 1000)
    : 0;

  const category = resolveCategoryLabel(result.categories);

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
      {showIndexer && (
        <td className="hidden lg:table-cell text-xs text-muted-foreground max-w-[120px] truncate" title={result.indexer}>
          {result.indexer || "—"}
        </td>
      )}
      <td className="text-sm whitespace-nowrap">
        <span className={cn("font-medium", (result.grabs ?? 0) > 0 ? "text-foreground" : "text-muted-foreground")}>
          {result.grabs ?? 0}
        </span>
      </td>
      <td className="text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onGrab();
          }}
          disabled={isGrabbing || alreadyGrabbed}
          className={cn(
            "px-3 py-1.5 rounded text-xs font-semibold transition-all",
            isGrabbing || alreadyGrabbed
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
          )}
        >
          {isGrabbing ? <Loader2 className="h-3 w-3 animate-spin" /> : alreadyGrabbed ? "Grabbed" : "Grab"}
        </button>
      </td>
    </tr>
  );
}
